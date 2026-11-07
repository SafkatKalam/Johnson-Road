# Decision and change rules

Backend contributor: Adrishikhar Barua. Adrishikhar works only on the backend. Do not describe him as the project owner or infer authority over frontend or project-wide decisions. Use the full name in formal records; Adrishikhar is the short name supplied in the request. Implementation work for him is scoped to the backend and its supporting documentation unless explicitly expanded.

Date: 2026-11-07 (Asia/Dhaka).
Decided by: Adrishikhar Barua.
Status: Decided — rule creation and application requested in this conversation.
Recorded by: Codex.

## Required record

Every future change must have a record in the affected document's change history or in a linked change record. Code changes may use one accompanying Markdown record for the whole change; do not add repetitive attribution comments to every code line.

Record:

- Date: actual date of the change, YYYY-MM-DD, using Asia/Dhaka unless otherwise stated.
- Requested by: Adrishikhar Barua, when supported by the request.
- Decision ID: existing ID such as O72, or a new unique ID.
- Status: Proposed, Open, Decided, Implemented or Verified, with separate approval and implementation status where necessary.
- Decided by: Adrishikhar Barua only when explicit approval exists; otherwise write Pending approval.
- Decision: precisely what was approved, including its limits.
- Evidence: conversation instruction or existing approved decision record.
- Changed by: the actual editor, for example Codex.
- Files and reason: what changed and why.
- Verification: checks actually performed, their results, and anything untested.

Example:

> Date: 2026-11-07 | Decision: O72 | Status: Decided
> Decided by: Adrishikhar Barua
> Decision: Use PostgreSQL for local development of the new schema.
> Evidence: SCOPE.md, section 9, existing dated decision.
> Implementation: Pending; existing code still uses SQLite.
> Recorded by: Codex

## Accuracy and approval

1. A proposed default is not approval. Never label an assistant recommendation as decided by Adrishikhar Barua.
2. Approval of a particular decision does not approve an entire draft, a code change, an installation, a deletion or deployment.
3. Keep original decision dates. When an old record is corrected, record the correction date separately. If the original date or approver is unknown, say Unknown instead of inventing it.
4. Review findings are attributed to the reviewer. Tests passing or failing are observations, not decisions made by Adrishikhar Barua.
5. A decision can be approved while its implementation is pending. A draft document may contain individually approved decisions.
6. Never replace sample application identities with Adrishikhar Barua's name merely to satisfy this documentation rule.

## Consistency and precedence

Use the existing approved, dated decision record when reconciling older contradictory defaults or proposals. Cite that record. Current explicit instructions from Adrishikhar Barua take precedence over older project decisions. If two approvals conflict and their intended order or scope is unclear, ask before implementing.

Update all affected descriptions, tables, diagrams, SQL comments and acceptance tests when an approved decision changes. Preserve accurate statements about existing code and historical alternatives, clearly labelled as such. Do not change working SQL merely to correct its comments.

Do not automatically mark related open items as decided. For example, approving the retry model does not approve every job-state transition or timeout.

## Rule application record

| Date | Requested / decided by | Change | Editor | Verification |
|---|---|---|---|---|
| 2026-11-07 | Adrishikhar Barua | Created this rule and linked it from root AGENTS.md so future repository work reads it | Codex | Checked file contents and Git diff; no application changes |
| 2026-11-07 | Adrishikhar Barua | Decided: identify Adrishikhar as a backend contributor, remove the incorrect project-owner attribution, and clarify backend work scope. Evidence: explicit correction in this conversation | Codex | Checked both rule files for consistent role wording; application code unchanged |

Existing documents have not been globally relabelled or approved by adoption of this rule. Their outstanding contradictions are listed in [the review record](DOCUMENTATION_REVIEW.md).
