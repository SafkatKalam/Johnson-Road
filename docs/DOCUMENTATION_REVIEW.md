# Documentation review record

Date: 2026-11-07 (Asia/Dhaka).
Requested by: Adrishikhar Barua.
Reviewed and recorded by: Codex.
Status: Findings recorded; corrections pending. These findings are not new product decisions.
Decision rule: [DECISION_RULES.md](DECISION_RULES.md).

## Confirmed issues

| Area | Evidence | Problem and required correction |
|---|---|---|
| Database | SCOPE section 9 versus REQUIREMENTS O2 and ARCHITECTURE sections 2 and 11.2 | Approved PostgreSQL local development conflicts with target SQLite wording. Preserve descriptions of the current SQLite code. Production hosting remains undecided. |
| Data ownership | SCOPE section 1 versus section 9; ARCHITECTURE section 15 | O48 is decided B, yet prose still calls it open or a default only. Label option A as historical. |
| Profile acceptance tests | REQUIREMENTS 1.25 and 1.26 versus SCOPE O48 | Tests still expect profile and organisation rows in Supabase. Under B these records belong in backend PostgreSQL; Supabase supplies authentication. These tests need reconciliation. |
| Accepted decisions | SCOPE section 9 versus DATA_MODEL sections 4.5, 4.6 and 11; schema.sql comments | O42, O57, O66 and O72 are decided in existing records but still called Open elsewhere. Update all references without approving unrelated O28 or O9 wholesale. |
| Precedence | SCOPE introduction versus blueprint database statements | Older defaults conflict with dated approvals. Apply the decision rule and cite the approval when correcting them. |
| Verification | REQUIREMENTS 6.1 | Earlier read-only review wording omits subsequent checks. Latest checks in this conversation: typecheck passed; lint failed with 21 errors and 2 warnings. Record these as dated observations. |
| Sprint plan | docs/sprints/SPRINT-03.md | File is empty. SCOPE O6 proposes documenting Sprint 2 first. Do not invent or approve a Sprint 3 plan to fill the placeholder. |
| SQL validation | schema.sql header | SQL explicitly remains unexecuted and unvalidated. This is an unresolved verification requirement, not proof that the SQL is broken. No database was created or modified during review. |
| Getting started | Root README.md and docs directory | Root README contains only a title; no documentation index exists. Reading order, approval status and precedence need a guide. |
| Model files | ARCHITECTURE section 5.6 versus git ls-files | Both backend/yolov8n.pt and backend/yolo11n.pt are tracked. Replace the unknown/unverified statement; tracking alone is not a defect or permission to remove files. |

## Limits

This record consolidates the documentation checks and source comparisons performed in this conversation. It is not certification of every SQL constraint, proposed API or end-to-end workflow. The backend, database schema and production behavior were not executed or proven by this review. A missing psql command establishes only that it was unavailable on the shell PATH, not that PostgreSQL is absent everywhere on the system.

## Change record

Date: 2026-11-07 | Requested by: Adrishikhar Barua | Recorded by: Codex.
Change: Created a review record and applied the requested name/date/status convention.
Approval: The request authorizes the attribution rule; substantive product decisions remain as recorded in SCOPE section 9. Recommendations here remain pending.
