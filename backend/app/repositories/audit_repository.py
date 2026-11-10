"""Append-only audit record (audit_events). Written for every account or organisation change and every refusal."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.request_context import get_request_id


def record(
    db: Session,
    *,
    action: str,
    organization_id: Any = None,
    actor_user_id: Any = None,
    actor_kind: str = "user",
    entity_type: str | None = None,
    entity_id: Any = None,
    outcome: str = "success",
    reason_code: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Add one audit row in the CALLER's transaction (so it commits or rolls back with the change it describes).

    `details` is for small facts such as an old and a new role. Never put secrets or tokens in it.
    """
    db.execute(
        text(
            """INSERT INTO audit_events (organization_id, actor_user_id, actor_kind, action, entity_type, entity_id, outcome,
                                         reason_code, request_id, details)
               VALUES (:org, :actor, :kind, :action, :etype, :eid, :outcome, :reason, :rid, CAST(:details AS jsonb))"""
        ),
        {
            "org": organization_id,
            "actor": actor_user_id,
            "kind": actor_kind,
            "action": action,
            "etype": entity_type,
            "eid": str(entity_id) if entity_id is not None else None,
            "outcome": outcome,
            "reason": reason_code,
            "rid": get_request_id(),
            "details": json.dumps(details or {}),
        },
    )


REPEAT_WINDOW_SECONDS = 60


def record_refusal(db: Session, **kwargs: Any) -> None:
    """A refused request, committed on its own (nothing else is being changed).

    The same person being refused for the same reason on the same thing is written once per minute, not once per
    request: audit_events can never be pruned (it is append-only), so a script hammering a refused action must not be
    able to grow it without limit.
    """
    repeat = db.execute(
        text(
            """SELECT 1 FROM audit_events
               WHERE outcome = 'refused' AND actor_user_id IS NOT DISTINCT FROM :actor AND action = :action
                 AND reason_code IS NOT DISTINCT FROM :reason AND entity_id IS NOT DISTINCT FROM :eid
                 AND occurred_at > now() - make_interval(secs => :window) LIMIT 1"""
        ),
        {"actor": kwargs.get("actor_user_id"), "action": kwargs["action"], "reason": kwargs.get("reason_code"),
         "eid": str(kwargs["entity_id"]) if kwargs.get("entity_id") is not None else None, "window": REPEAT_WINDOW_SECONDS},
    ).first()
    if not repeat:
        record(db, outcome="refused", **kwargs)
    db.commit()
