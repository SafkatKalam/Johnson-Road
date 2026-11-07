# Documentation review record

<!-- Adrishikhar - 7 November 2026, 17:32 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: reconcile the reviewed documentation gaps and record verification honestly. -->
Date: 2026-11-07 (Asia/Dhaka).
Requested and approved by: Adrishikhar Barua — backend contributor.
Edited and checked by: Codex.
Status: Documentation corrections applied; backend implementation and PostgreSQL execution validation remain pending.
Evidence: instruction to fix the reviewed gaps and place dated attribution comments above changes.
Decision rule: [DECISION_RULES.md](DECISION_RULES.md).

## Corrections applied

| Area | Resolution | Location |
|---|---|---|
| Database and precedence | PostgreSQL locally and in production; hosting still open. Dated approved decisions override earlier blueprint defaults. Current SQLite code remains accurately labelled as built. | SCOPE, REQUIREMENTS, ARCHITECTURE, DATA_MODEL |
| Accepted decisions | O42, O57, O66 and O72 reconciled; O48 backend ownership reflected in profile acceptance checks. Unrelated open items remain open. | Same documents and schema.sql |
| Counting and totals | FD1–FD2: line crossing or zone presence; valid bucket direction/shape; method-labelled sums and separate dashboard totals. | LOW_LEVEL_DESIGN section 18, DATA_MODEL, schema.sql |
| Storage | FD3: nested generated keys allowed only in defined categories; traversal containment checks; attempt-specific artifacts. | LOW_LEVEL_DESIGN sections 6.2 and 18 |
| Metadata | FD4: scoped PATCH contract, freeze after first job except notes, serialize queue/edit, immutable job/report snapshots. | LOW_LEVEL_DESIGN, DATA_MODEL, schema.sql |
| Worker recovery | FD5: independent supervision, deadlines and cancellation; all writes check attempt ownership; completion/recovery locks. Timing values remain open. | LOW_LEVEL_DESIGN, DATA_MODEL |
| Notifications | FD6: same transaction as state transition; rollback and duplicate prevention. | LOW_LEVEL_DESIGN, DATA_MODEL |
| Retention | FD7: no automatic audit/result deletion; delete eligible object before marking it; active temporary files protected. | LOW_LEVEL_DESIGN, DATA_MODEL, schema.sql |
| Multi-video workflow | FD8: one video per workflow; no coordinate copying between videos. | LOW_LEVEL_DESIGN |
| Model tracking | Both backend/yolov8n.pt and backend/yolo11n.pt confirmed tracked with git ls-files. | ARCHITECTURE |
| Verification wording | Updated to the checks actually rerun below. | REQUIREMENTS 6.1 |

## Checks and remaining work

- Frontend type checking: `npm run typecheck` passed on 2026-11-07.
- Frontend lint: `npm run lint` failed with 21 errors and 2 warnings on 2026-11-07. These are existing frontend issues; no frontend code was changed. Examples: unused AuthLayout in App.tsx and the fetchMembers dependency warning in OrganizationPage.tsx.
- Documentation and draft SQL: reviewed changes and searched for superseded rules; `git diff --check` passed.
- SQL remains an unexecuted draft, not an executable migration approved for use. No database was created or modified. `psql` was not found on the shell PATH; that does not prove PostgreSQL is absent elsewhere.
- Runtime proof for FD1–FD8 remains required; test scenarios are listed in LOW_LEVEL_DESIGN section 18. Schema checks alone do not enforce every service invariant.
- Sprint 3 has a status placeholder, not an approved delivery plan. Dates, assignments and implementation completion are not invented.
- The root README remains title-only. This task is confined to docs; the reading order below provides the guide inside the existing documentation.

## Reading order and conflict rule

1. DECISION_RULES.md: attribution and approval rules.
2. SCOPE.md: product boundary and dated approved decisions in section 9.
3. REQUIREMENTS.md: requirements and acceptance conditions.
4. ARCHITECTURE.md: components and current-versus-target behavior.
5. DATA_MODEL.md and schema.sql: proposed data model and unexecuted PostgreSQL draft.
6. LOW_LEVEL_DESIGN.md: implementation contracts; section 18 contains approved FD1–FD8 corrections and required tests.
7. ROADMAP.md and sprints/: planning only; a placeholder or draft is not implementation evidence.

Dated approved decisions override earlier blueprint statements and draft defaults. Approval of an individual decision does not approve the whole document. Current code, implemented behavior and verified behavior are separate claims.

## Scope and rollback

All changes in this correction are under docs. No application code, database, system settings or installed software changed. No commit or push was performed. Undo by reversing only this correction's diff; no database migration rollback is needed.


<!-- Adrishikhar - 7 November 2026, 17:40 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: reconcile six inconsistencies confirmed by the follow-up review.
Evidence: explicit instruction "okay fix this issues too". -->
## Follow-up corrections — 2026-11-07, 17:40 (Asia/Dhaka)

1. FD2: added the analytics method filter and `countsByMethod` response contract; removed the promise of unchanged count-bearing frontend types and aligned data-model mappings.
2. FD8: upload state now holds exactly one video; selection, replacement and Continue rules agree across the workflow and requirements.
3. FD5: architecture and requirements now describe independent supervisor cancellation with cooperative stop and configured termination grace.
4. FD4/O19: metadata storage and types are marked decided; edit freezing and snapshot rules are referenced consistently. O68 timezone choices remain open.
5. FD3: the data-model storage summary now includes all generated nested key categories and their validation rules; the JSON inventory includes metadata snapshots.
6. Sprint status: SCOPE now describes Sprint 3 as a planning placeholder, not an empty file or approved execution plan.

Scope: existing documentation only; no application code or SQL changed in this follow-up. Frontend type adaptation and runtime behavior remain implementation work. Verification: structural/local-link checks, targeted contradiction checks and `git diff --check`; PostgreSQL execution remains unverified. Earlier lint/typecheck results were not rerun for these documentation-only changes. Rollback: reverse only this follow-up diff.


<!-- Adrishikhar - 7 November 2026, 17:45 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD9–FD12: correct upload ordering, decoder failure handling, saved classes and stale crossing evidence. Runtime implementation pending. -->
## Processing design corrections — 2026-11-07, 17:45 (Asia/Dhaka)

Approved by Adrishikhar Barua through the instruction "fix" following the four findings and two stale statements; edited by Codex.

- FD9: all upload metadata is validated before promotion/ready commit; success notification commits with ready. A lost response after commit does not undo success.
- FD10: only verified clean EOF permits completion; ambiguous reads and decoder/I/O failures cannot publish partial success.
- FD11: configuration saves resolve class defaults once. The SQL draft requires a nonempty array with no database default; the service validates class names. Existing databases would need a separately reviewed migration; none was applied.
- FD12: the counter clears stale candidates and uses the latest crossing in the current excursion, preventing false endpoint crossings after a wobble. Other O79 geometry settings remain open.
- Updated the SQL O19 comment and validation statements to distinguish static checks from unperformed PostgreSQL execution.

Verification: targeted static checks and a small simulation of the documented counter rules; Markdown/local-link checks and git diff --check. Backend, decoder adapters and PostgreSQL remain unexecuted. Required runtime cases are listed in LOW_LEVEL_DESIGN under FD9–FD12. No application code changed, no commit or installation performed. Rollback: reverse this correction's document/draft-schema diff only.


<!-- Adrishikhar - 7 November 2026, 17:54 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD13–FD21: resolve the consolidated contract and verification findings. Documentation only; runtime implementation pending. -->
## Consolidated contract corrections — 2026-11-07, 17:54 (Asia/Dhaka)

Evidence: Adrishikhar Barua approved the consolidated findings with "fix"; Codex edited existing documents only.

| Decision | Correction |
|---|---|
| FD13 | Unknown/underestimated frame totals become NULL atomically; completion records actual counts; SQL bound retained |
| FD14 | Invitations before membership use email; no organisation notifications to non-members |
| FD15 | Ready/receiving/failed upload replay states distinguished; failed retries use new keys; pre-insert rejection and post-commit disconnect handling aligned |
| FD16 | Dashboard compatibility, list envelopes and pre-membership profile-edit permission aligned; approved contracts distinguished from proposals |
| FD17 | Dedicated deterministic regeneration endpoint; server assigns successor version under job lock |
| FD18 | Deferred guards explicitly forced or committed in isolated tests |
| FD19 | Filename extension and detected content must both pass; generated storage names remain independent of client paths |
| FD20 | Separate request_id, job_id and attempt_no; no invented job IDs for unrelated requests |
| FD21 | Retention locks source upload and skips queued/running jobs; queue/rerun/retry check deletion marker and storage existence |

Also corrected SCOPE D5's old Supabase data-store instruction, verification status wording, new error catalogue entries and upload-step references. Earlier review records describe their historical passes; this follow-up supersedes conflicting descriptions. No runtime implementation, SQL constraint changes, database execution, installations or commits in this follow-up. SQL comments clarify FD13/FD21 only.

Verification: document/table/link/anchor checks, targeted contradiction assertions, illustrative progress/retry/regeneration/retention decision checks, and git diff --check. These checks do not run PostgreSQL or prove concurrency behavior. Required runtime tests remain pending. Rollback reverses only this follow-up diff.
