# Johnson Road — Feature-by-feature implementation plan

<!-- Adrishikhar - 7 November 2026, 18:26 (Asia/Dhaka) · Plan creation approved
Requested/approved by: Adrishikhar Barua. Recorded and written by: Codex.
Decision ID: PLAN-01. Evidence: request to include account features, use an agent for a full check, and create an implementation Markdown file with requirements and a plan.
Decision: create this planning document. Individual feature implementation, new product scope, purchases, installations and deployment are not approved by this request.
Files and reason: docs/IMPLEMENTATION_PLAN.md; consolidate the complete delivery checklist with dependencies and acceptance gates.
Verification: static document and coverage checks are recorded at the end; no application or database execution is claimed. -->

Date: 2026-11-07, 18:26 (Asia/Dhaka). Status: **Proposed implementation sequence; document creation approved.**

Backend contributor: **Adrishikhar Barua**. Adrishikhar is not designated the project owner. Frontend work is coordination with the frontend developer, not an assignment to Adrishikhar. Client acceptance, commercial decisions and operations need their responsible people identified before delivery.

## 1. Purpose, scope and document precedence

<!-- Adrishikhar - 7 November 2026, 19:07 (Asia/Dhaka) · Documentation updated
Requested by: Adrishikhar Barua. Changed by: Codex.
Decision references: PREP-01 and EMAIL-01 in PREREQUISITES.md.
Change: link the requested prerequisite register, record Resend selection, and clarify upload-readiness and client-acceptance gates against existing FD9 and REQ 6.18.
Verification: documentation checks only; implementation remains pending. -->

Before each feature, check [Prerequisites and remaining decisions](PREREQUISITES.md). Resend is selected for email (EMAIL-01); configuration and delivery remain unverified. Its proposed Supabase SMTP and backend invitation integrations still require feature-level approval.

Deliver the complete agreed client product feature by feature, starting locally and progressing through a verified user journey to production handover. This includes sign up, email verification, sign in, sessions, sign out, password recovery, onboarding, profiles, organisations, projects, upload, configuration, analysis, results, reports and operations.

This is a delivery map, not a replacement specification. Read [Decision rules](DECISION_RULES.md), [Scope](SCOPE.md), [Requirements](REQUIREMENTS.md), [Architecture](ARCHITECTURE.md), [Data model](DATA_MODEL.md), [Low-level design](LOW_LEVEL_DESIGN.md) and the [draft schema](schema.sql). Existing approved dated decisions take precedence over older proposals. This plan does not mark open O-items as decided or certify draft SQL. In LOW_LEVEL_DESIGN, use the heading **Approved backend flow corrections** when locating FD1–FD8; that file currently repeats section number 18. FD9–FD21 are embedded in their relevant sections.

Requirement references below use IDs from REQUIREMENTS. Historical “As built” rows describe problems or existing scaffolding to inspect, not behavior to preserve when it contradicts the target. A referenced proposal remains a proposal. New commercial-delivery checkpoints below are proposals prompted by the client's intended sale; they do not amend product scope automatically.

## 2. Current baseline — code read, not end-to-end tested

<!-- Adrishikhar - 7 November 2026, 19:31 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Decision ID: PREP-02 in PREREQUISITES.md. Evidence: "fix" following the readiness review.
Change: link scoped local audit and update F02/F04/F05 preparation for missing frontend configuration and unverified Python/PostgreSQL compatibility.
Implementation: documentation updated; setup and application implementation pending.
Verification: document structure, feature references, local links and whitespace checked; no runtime readiness claim. -->

The [local validation evidence recorded on 7 November 2026](PREREQUISITES.md#local-validation-evidence) supplements this source-code baseline: software and GPU detection succeeded, but the checked Python lacks core packages, frontend Vite does not load the required connection settings, and the local PostgreSQL listener has not been tested with the project schema. Use those scoped results before F02/F04/F05 setup; preserve earlier review results as historical evidence.

| Area | Evidence | Planning consequence |
|---|---|---|
| Identity | [auth context](../frontend/src/lib/auth.tsx) and [auth service](../frontend/src/services/auth.service.ts) use jr-auth and a fixed user | Real sign-in/session/sign-out integration remains work |
| Account routes | [App.tsx](../frontend/src/App.tsx) has account screens but no reset-password completion route | Screens existing does not mean account journeys work; fix onboarding guard self-redirect when real needsOnboarding becomes true |
| Backend | [main.py](../backend/app/main.py) registers the mock-oriented routers and AI startup | Token protection, persistent business services and production-safe health details are pending |
| Database | [database.py](../backend/app/database/database.py) uses SQLite; docs/schema.sql is unexecuted PostgreSQL | Implement and validate the approved PostgreSQL transition; do not treat the draft as an applied migration |
| Upload/jobs | [upload service](../backend/app/services/upload_service.py) uses client filename text, reads the whole upload and runs processing through BackgroundTasks | Separate safe upload from queueing; persist jobs and enforce FD contracts |
| AI | [frame reader](../backend/app/ai/frame_reader.py) reports six frames; [counter](../backend/app/ai/counter.py) returns track count; [tracker](../backend/app/ai/trackers/bytetrack_tracker.py) creates IDs per detection | Real decoding, tracking and geometric counting must replace placeholders |
| Model integration | [YOLO detector](../backend/app/ai/detectors/yolo_detector.py) omits required class_id; yolov8n.pt and yolo11n.pt exist | Resolve D1/D2 and verify the exact weights/device; no accuracy claim yet |
| UI and roadmap | [roadmap](../ROADMAP.md) marks authentication/login checked despite mock code; dashboards and workflows retain sample data | Use demonstrated behavior, not old checkbox labels, as completion evidence |
| Previous checks | DOCUMENTATION_REVIEW records typecheck passed and lint failed with 21 errors and 2 warnings on 2026-11-07 | Historical evidence only; rerun appropriate checks after implementation changes |

Local hardware observed in this conversation: Windows laptop, i7-13700HX, about 16 GB RAM, RTX 5060 Laptop GPU with about 8 GB VRAM. Python GPU compatibility and throughput are **unverified**. The M4 Mac mini is user-reported; RAM, storage and connectivity are unknown. Neither AWS nor Mac mini production storage is approved. Local folders and local PostgreSQL are the development direction; actual installation/configuration requires approval.

## 3. How each feature will be delivered

1. Select one feature below and inspect its requirements, relevant code, open choices and dependencies.
2. Present a concrete plan: affected files/API/data, frontend coordination, errors, edge cases, tests and rollback. Obtain Adrishikhar's explicit approval before code changes.
3. Implement only that approved feature. Split a large feature into small reviewable substeps; do not bundle the whole phase into one change.
4. Run meaningful unit/API/integration checks appropriate to it. Use database tests for constraints and concurrency; use representative footage for AI claims. Do not substitute documentation checks for runtime proof.
5. Demonstrate the feature, record exact evidence and remaining limitations, and update its status. A commit remains a separate user action unless explicitly requested.
6. Begin dependent features only after their prerequisites pass. Missing client choices block the dependent behavior, not unrelated work.

Every feature starts **Not started or partial; unverified**, according to the baseline. Use statuses Planned, Approved to implement, In progress, Blocked by a named decision, and Verified. All checkboxes below remain unchecked because this plan performs no implementation.

Definition of done for every feature: success and meaningful failure cases pass; organisation/role checks are enforced where applicable; schema and consumer contracts agree; no fake success or invented metrics; logs help diagnose failures without leaking secrets; required checks and documentation are current; frontend changes pass their lint/typecheck gate. Database changes include migration and rollback/preservation evidence. No private media or credentials enter Git.

## 4. Delivery stages and milestones

| Stage | Features | Demonstration before proceeding |
|---|---|---|
| A — Foundations | F01–F06 | Reproducible development baseline, tested database foundation, model feasibility evidence |
| B — Accounts and organisation | F07–F19 | Register, verify as policy requires, sign in, onboard/join, refresh, sign out, sign back in; permissions proven |
| C — Projects and video setup | F20–F27 | Create project, upload one real video, preview, save metadata and geometry, review real choices |
| D — Processing and results | F28–F36 | Queue one configured video; detect, track, count, retrieve annotated output; cancellation/retry/recovery tested |
| E — Reporting and app completeness | F37–F42 | Reconciled dashboard/reports, notifications, audit, real UI states and accessibility |
| F — Validation and client delivery | F43–F51 | Agreed quality/performance/security gates, deployment proof, client acceptance and handover |

This sequence is proposed and does not silently approve O6/O13 or rewrite historical sprint commitments. The model feasibility experiment F04 can occur before account implementation using a local authorized fixture; it is not a publicly exposed bypass of authentication. No feature is released to clients before permission and isolation checks pass.

## 5. Feature checklist, requirements and implementation steps

### Stage A — Foundations

#### F01 — Client requirements and acceptance agreement

- [ ] **Requirement:** confirm supported videos/classes, desired counts, accuracy measurement, processing delay, upload volume, users, privacy, retention, delivery model and support expectations. Sources: REQ 5.23–5.24, 6.17–6.19; NFR-12; O8/O17/O37/O44/O47. Commercial acceptance is a proposed delivery checkpoint.
- **Current:** numerical targets and production choices are unresolved; pretrained weights are not accuracy evidence.
- **Plan/dependencies:** no prerequisites. Gather representative permitted footage; define a written acceptance dataset, metrics and pass levels with the client before promising an outcome. Identify who can approve client scope.
- **Verify:** every promise has a measurable test, responsible approver and workload definition; undecided items remain explicit. Dataset use/upload requires authorization.

#### F02 — Baseline, configuration and development setup

- [ ] **Requirement:** reproducible API/frontend startup, environment configuration, stable paths and useful missing-setting errors. Sources: REQ 1.30, 4.41, 5.28, 6.1–6.2, 6.7–6.9, 6.20–6.23; NFR-3/NFR-5; D2, O14.
- **Current:** checked Python 3.14.6 lacks core backend packages; project venv lacks a Windows executable. Node/npm are detected, but frontend Vite loads none of the three required connection settings; root .env does not establish frontend readiness. Relative paths and historical frontend lint failures remain.
- **Plan/dependencies:** after F01 scope inventory, use P01/P02 and the dated [local evidence](PREREQUISITES.md#local-validation-evidence); recheck changed inputs. Propose compatible environment/dependency versions, env example, loader and path handling for approval. Coordinate frontend env placement/public-key validation without exposing values. Keep API and worker dependency boundaries explicit.
- **Verify:** approved clean environment can start the intended components; configuration errors are actionable; no secret values enter examples or logs. Record exact commands and versions; coordinate frontend baseline fixes.

#### F03 — Test foundation and diagnostic API contracts

- [ ] **Requirement:** shared error shapes, response models, request IDs, safe logging and contract tests. Sources: REQ 4.2–4.9, 4.32–4.37, 6.3–6.6; NFR-7/NFR-9/NFR-11; FD16/FD20, O26/O56/O87.
- **Current:** default errors, incomplete processing fields and no established project test suite.
- **Plan/dependencies:** F02. Establish meaningful baseline tests, typed status/error responses, pagination contracts and request/job/attempt correlation. Agree handling of legacy routes before changing consumers.
- **Verify:** unknown IDs produce agreed errors; responses match contracts; private details are absent; new/migrated lists use FD16 envelopes. Existing legacy exceptions are tested until retired by approval.

#### F04 — Pretrained model and local GPU feasibility

- [ ] **Requirement:** load the intended model, include class_id, record device/model identity and process a short permitted sample. Sources: REQ 5.25–5.32, 6.10–6.11, 6.20–6.23; D1/D2, O14/O37.
- **Current:** two weight files, RTX 5060 Laptop GPU and partial YOLO integration exist; torch/Ultralytics are absent from the checked Python interpreter. Python GPU use and accuracy are unverified.
- **Plan/dependencies:** F02/F03, P07 and authorized fixture. Apply the [compatibility gate](PREREQUISITES.md#local-validation-evidence) before proposing package/device setup; installed Python alone is not compatibility evidence. After approval, fix the detector construction defect and run isolated inference before a full product pipeline. Keep CPU fallback explicit, never silently switch models.
- **Verify:** fake-box regression returns correct class_id; actual model/device are recorded; a short real clip produces inspectable detections with time/memory evidence. This does not certify tracking or line counts.

#### F05 — PostgreSQL, migrations and repositories

- [ ] **Requirement:** PostgreSQL locally/production, persistent records, tested invariants and transactions. Sources: REQ 2.4, 3.42, 6.14; DATA_MODEL invariants 1–31; O48/O57/O72, O63/O71/O76; FD18.
- **Current:** application still uses SQLite; local PostgreSQL 18.4 accepts connections, but project login/database/schema are untested. SQL draft targets PostgreSQL 16; no applied migration path.
- **Plan/dependencies:** F02/F03 and P06; decide supported PostgreSQL version using the [compatibility gate](PREREQUISITES.md#local-validation-evidence), then approve specific setup and migration approach. Do not infer incompatibility or install another server solely from the version difference. Validate schema on an isolated empty database of the selected version, correct demonstrated defects, establish numbered/versioned migrations and repositories. Review any existing data before migration.
- **Verify:** constraints and actual commit boundaries pass, including forcing deferred guards; permissions and rollback behavior are proven. Do not claim deferred triggers tested from rollback-only tests. No production database is touched by a local validation plan.

#### F06 — Health, readiness and worker boundary

- [ ] **Requirement:** truthful API, database, queue and AI readiness. Sources: REQ 4.24, 5.26, 6.20–6.21; NFR-16, O4.
- **Current:** health exposes runtime details; AI is imported into API startup; separate worker is absent.
- **Plan/dependencies:** F02–F05. Separate API liveness from processing readiness; define safe public health fields and privileged diagnostics; update the worker readiness checks as F29 is built.
- **Verify:** API survives intended worker/model outages and reports degraded processing honestly; public responses reveal no model file paths or credentials.

### Stage B — Accounts and organisation

#### F07 — Backend identity validation and current-user endpoint

- [ ] **Requirement:** validate Supabase identity and load backend-owned profile/membership. Sources: REQ 1.25, 4.10, 4.30–4.31; AC-10–AC-14; O48, O1/O51/O65; FD16.
- **Current:** backend routes have no authentication; browser uses a fixed identity.
- **Plan/dependencies:** F03/F05. Agree token verification details; resolve the authenticated subject to a backend user. Permit signed-in pre-membership account/onboarding/invite endpoints as FD16 specifies; require membership elsewhere.
- **Verify:** missing, expired, malformed and wrong-issuer/audience tokens fail; caller-supplied roles/org IDs grant no access; first-call user creation is safe under concurrency.

#### F08 — Sign up

- [ ] **Requirement:** real account registration with truthful success/error feedback. Sources: REQ 1.1, 1.20, 1.30; AU-2, O11/O41.
- **Current:** registration calls Supabase directly; the overall identity flow is mock-based and unverified.
- **Plan/dependencies:** F07 and agreed verification policy. Coordinate frontend auth-service registration and provider settings; keep credentials with the identity provider and business profiles in backend PostgreSQL.
- **Verify:** valid registration, invalid input, repeated submission, existing-email provider responses and unavailable provider are handled without false account creation or misleading success.

#### F09 — Email verification and resend

- [ ] **Requirement:** display real verification state and support resend/callback handling. Sources: REQ 1.8–1.10, 1.20; AU-4, O11.
- **Current:** page and redirects depend on mock identity; whether verification blocks login remains open.
- **Plan/dependencies:** F08; decide O11 before enforcing a gate. Coordinate permitted callback destinations and resend behavior; ensure unverified users are not redirected past verification accidentally.
- **Verify:** valid, expired and reused links, resend errors and refresh are handled; UI and backend enforce the same approved policy. No promise of verification before a provider confirms it.

#### F10 — Sign in

- [ ] **Requirement:** verify actual credentials and load the real account. Sources: REQ 1.4–1.7, 1.20, 1.25; AU-1/AU-6.
- **Current:** any nonempty email/password sets jr-auth in two code paths.
- **Plan/dependencies:** F07–F09. Replace both mock auth paths through one service; coordinate account loading and the correct verification/onboarding/home destination.
- **Verify:** correct credentials succeed; wrong credentials fail; no fixed user remains; network failure and double-clicks do not create false signed-in state.

#### F11 — Session restoration, refresh and protected navigation

- [ ] **Requirement:** real session survives allowed refresh/reload and expires safely; protected API checks are independent of route guards. Sources: REQ 1.6–1.7, 4.10, 4.30–4.31, 6.4–6.5; FR-14.
- **Current:** localStorage flag acts as authority; onboarding route can redirect to itself once needsOnboarding becomes real.
- **Plan/dependencies:** F10. Coordinate provider session subscription, loading/refresh handling and separate signed-in/no-membership navigation. Agree expiry/revocation behavior rather than assume immediate JWT invalidation.
- **Verify:** page refresh, new tab, token refresh failure, expired token, removed membership and direct URLs behave correctly; onboarding does not loop; browser flag tampering never authorizes API access.

#### F12 — Sign out

- [ ] **Requirement:** end the intended provider session and clear private browser state. Sources: REQ 1.5, 1.7, 6.4; session/sign-out detail explicitly requested in this conversation.
- **Current:** logout only removes jr-auth.
- **Plan/dependencies:** F10/F11. Agree current-device versus all-device scope, provider-failure handling and access-token validity window. Coordinate session termination, cancellation of polling and clearing cached profile/org/results data.
- **Verify:** logout then Back/refresh reveals no protected cached data; another account receives no previous account data; refresh-token/session behavior and any remaining access-token window match the agreed policy. Do not claim all tokens become instantly unusable without proof.

#### F13 — Forgot password and reset completion

- [ ] **Requirement:** request reset mail and finish with a new password. Sources: REQ 1.2–1.3, 1.20; AU-3, GAP-2.
- **Current:** reset-email request exists; reset-completion route does not.
- **Plan/dependencies:** F07/F11 and approved callback configuration. Coordinate recovery route, provider recovery session, new-password validation and service calls; never place recovery tokens in logs.
- **Verify:** permitted recovery changes the password; invalid/expired/reused links fail safely; old password stops working; other-session policy is documented and tested, not assumed.

#### F14 — Change password and profile

- [ ] **Requirement:** persisted name/avatar handling and password change with truthful feedback. Sources: REQ 1.14, 1.22–1.29; D5, O27/O41.
- **Current:** mock user IDs, duplicated types and direct Supabase profile writes; save errors can be ignored.
- **Plan/dependencies:** F07/F10/F11. Backend profile GET/PATCH uses real identity and approved editable fields; coordinate canonical user types and provider password change. Decide current-password verification and avatar storage/input rules before implementation.
- **Verify:** edits survive reload; rejected save never says Saved; protected role/org fields cannot be edited through profile; password change follows O27 and provider errors are safely translated.

#### F15 — Onboarding and first organisation

- [ ] **Requirement:** first member and organisation creation are atomic. Sources: REQ 1.11–1.13, 1.34; AC-10/AC-11; D5; SCOPE finding F11; O48/O67.
- **Current:** needsOnboarding is fixed false; separate direct Supabase writes have a membership bootstrapping problem.
- **Plan/dependencies:** F05/F07/F11. Create organisation, owner membership and permitted profile changes in one backend transaction; coordinate onboarding guard and invite-acceptance alternative.
- **Verify:** failure leaves no partial organisation; concurrent/repeated onboarding cannot create conflicting memberships; next sign-in loads actual membership. Confirm one-organisation policy before enforcing it.

#### F16 — Organisation details, preferences and usage

- [ ] **Requirement:** real organisation name/preferences/member context and truthful usage/plan display. Sources: REQ 1.15, 1.18–1.19, 1.28, 1.31; AC-9, O39.
- **Current:** placeholder organisation ID and direct provider-table access.
- **Plan/dependencies:** F15/F17. Build scoped organisation reads/updates and agreed usage metrics; coordinate screen services. Define storage, job and preference fields before extending the schema; show no invented quotas or invoices.
- **Verify:** authorized edits persist; unauthorized/cross-org edits fail; usage reconciles with source records. Plan limits remain unset until approved and backend-enforced if introduced.

#### F17 — Roles, member management and ownership protections

- [ ] **Requirement:** organisation isolation, member removal/role changes and owner protection. Sources: REQ 1.35, 4.31; AC-1–AC-17; SCOPE finding F12; O15/O67.
- **Current:** frontend role labels and Supabase rules exist; backend permissions are absent.
- **Plan/dependencies:** F07/F15; approve unresolved permission cells. Implement explicit capabilities and service checks; prevent admin self-promotion and loss of the last owner. Agree ownership-transfer/suspension rules before enabling them.
- **Verify:** role matrix tests include cross-org reads/writes, guessed IDs, changed memberships, self-escalation and concurrent owner changes. Hidden buttons alone are never an authorization control.

#### F18 — Invitations and acceptance

- [ ] **Requirement:** invite, list, revoke/expire and accept membership invitations. Sources: REQ 1.16–1.17, 1.28, 1.35; FD14, O38/O69/O74.
- **Current:** direct invitation-related UI writes; complete backend acceptance/delivery is absent.
- **Plan/dependencies:** F07/F15/F17 and prerequisite P05. Implement hashed invite tokens and authorised roles; agree recipient identity checks, lifetime and delivery/retry mechanism. Resend is selected by EMAIL-01; integration is pending. Pre-membership invitations use email, not organisation notifications.
- **Verify:** valid acceptance works for eligible accounts; wrong email, expiry, replay, revoked invite and already-member cases are defined and tested. Delivery failure is visible/retryable; do not claim email received merely from row creation.

#### F19 — Settings, preferences and support

- [ ] **Requirement:** real permitted user preferences, reduced motion and a truthful support/troubleshooting page. Sources: REQ 1.21, 1.32–1.33; NFR-14; O45/O59.
- **Current:** local-state settings and sample support text; billing/API-key and session/MFA UI affordances are not implemented product promises.
- **Plan/dependencies:** F14/F16; F42 for UI validation. Agree which settings persist per user, organisation or device and their storage; coordinate existing UI. Obtain support contact and support responsibilities before client delivery.
- **Verify:** supported preferences persist at the agreed scope; reduced motion honors OS/in-app choices; unsupported controls are clearly handled. No fake ticket, API key, payment, MFA or session-management success.

### Stage C — Projects and video setup

#### F20 — Projects, search, history and detail

- [ ] **Requirement:** create/list/search/read/rename/archive projects; store location, description, owner/defaults and show uploads/jobs/reports/history. Sources: REQ 2.1–2.8, 4.11–4.12, 4.25; PJ-1–PJ-5.
- **Current:** sample services/repositories and an unregistered duplicate router.
- **Plan/dependencies:** F05/F07/F17. Implement scoped repositories and service API, pagination/filtering, history and a real location-suggestion source. Decide duplicate-router retirement explicitly; no file deletion is implicit.
- **Verify:** permission failures, invalid IDs, empty/search pages, archive behavior and linked history work; archived-project rules are agreed. Global search is a separate scope question, not automatically covered by project search.

#### F21 — Storage interface and protected media access

- [ ] **Requirement:** separate source/output storage, safe generated keys and least-privilege access. Sources: REQ 4.13–4.14, 4.20, 4.50–4.51; NFR-1–NFR-4/NFR-18; FD3, O3/O82.
- **Current:** local uploads directory with client filename included in paths.
- **Plan/dependencies:** F02/F07/F17/F20. Implement a local storage adapter behind the planned interface; authorize preview/download access; validate nested UUID key patterns and resolved containment. Future cloud adapter must retain these contracts.
- **Verify:** traversal, absolute paths, malformed keys and symlink/reparse escapes fail; another organisation cannot retrieve media; unavailable storage and absent objects are distinguished. Production signed-link lifetime stays an open choice.

#### F22 — Streamed upload and validation

- [ ] **Requirement:** one video upload separate from job creation, bounded memory, filename/content/reader checks, configured size/duration limits and idempotent retry. Sources: REQ 2.21, 2.33, 2.40–2.43, 2.55–2.56, 4.13–4.14, 4.39, 4.50–4.54; FD8/FD9/FD15/FD19; D3/D4, O8/O18/O86.
- **Current:** whole-file read, no enforced video limits, processing immediately scheduled.
- **Plan/dependencies:** F20/F21 and approved limits/formats. Inspect bounded prefix; create receiving row safely; stream temp data; fully validate with reader after streaming; validate all supplied metadata and generate/store the real preview before promotion or ready status (FD9). Only after those gates pass, promote and commit ready/audit/notice. Bring the initial validation/preview subset of F23 and reader subset of F30 into this feature; neither may be deferred until after a ready upload is published.
- **Verify:** oversize, forged extension, corrupt/empty video, late multipart fields, invalid metadata, preview failure, interrupted transfer, race on key and lost response after commit. Metadata or preview failure cannot publish ready or a success notice. Ready replay reuses row; receiving starts no second writer; confirmed failed retry gets a new key. No job is created by upload alone.

#### F23 — Metadata, preview and eligible upload removal

- [ ] **Requirement:** measured properties, real preview, typed metadata and protected editing/deletion. Sources: REQ 2.14–2.16, 2.28, 2.44–2.45, 4.14; FD4/FD21, O68/O85.
- **Current:** wizard invents duration/resolution and metadata inputs lack real persistence.
- **Plan/dependencies:** F22 already performs initial metadata validation and preview generation before ready. This feature exposes measured details/protected preview, integrates their display, reuses validation for metadata edits, freezes metadata except notes after first job and locks upload for edit/queue races. Delete only an eligible upload with no job.
- **Verify:** actual frame dimensions match preview/geometry; invalid time fails; queued source cannot be removed; concurrent queue/edit/delete follows the locks; historical snapshots do not change with notes. Camera timezone/preview-position decisions remain explicit.

#### F24 — Analysis settings and configuration versions

- [ ] **Requirement:** supported model/tracker/classes/options, explicit saved defaults and immutable used configurations. Sources: REQ 2.23–2.25, 2.29–2.31, 4.15, 4.38, 5.22, 5.25; FD4/FD11; O20–O23.
- **Current:** several controls are decorative; settings are read from environment/import state.
- **Plan/dependencies:** F04/F05/F23. Save validated configuration versions; resolve omitted classes once; expose only supported models/trackers; copy defaults into saved fields. Decide automatic reports and advanced controls separately.
- **Verify:** unsupported class/model/tracker and invalid options fail; concurrent saves yield distinct versions; locked settings cannot mutate; retries preserve saved values when defaults change. No plate anonymization claim.

#### F25 — Draw and save counting lines

- [ ] **Requirement:** lines have distinct normalized endpoints and ordered direction semantics. Sources: REQ 2.16, 2.27, 2.45–2.47, 4.38; O42/O66, FD1.
- **Current:** drawing uses a placeholder canvas and component-local state.
- **Plan/dependencies:** F23/F24; coordinate frontend canvas data ownership. Backend validates normalized points/direction and returns saved geometry. Use the uploaded video's actual frame, not another video's coordinates.
- **Verify:** line round-trip survives preview resizing; zero-length/out-of-range geometry fails; forward/backward agrees with point order; keyboard drawing is covered by F42.

#### F26 — Draw and save zones

- [ ] **Requirement:** persist valid polygons in normalized coordinates; support line-plus-zone and zone-only configurations. Sources: REQ 2.26, 2.45–2.47, 4.38; FD1, O28/O79/O80.
- **Current:** polygon points remain inside a placeholder UI component.
- **Plan/dependencies:** F23/F24. Validate geometry and sort order; coordinate preview editing; agree geometry boundaries and self-intersection policy before enforcing proposed rules.
- **Verify:** too few/out-of-range points fail; overlap and no-zone line mode are supported; no-lines/no-zones is rejected; geometry is not copied across unrelated videos.

#### F27 — Complete upload wizard integration

- [ ] **Requirement:** preserve nine steps, require exactly one ready video, prevent skipped validation and show real review choices. Sources: REQ 2.10–2.17, 2.20–2.22, 2.32, 2.40–2.56; FR-1–FR-7; FD8/FD15, O24/O25/O29.
- **Current:** sample files, invented estimates and Queue only navigates.
- **Plan/dependencies:** F20–F26; queue action completes with F28. Coordinate service calls and state reset on video replacement; agree draft refresh behavior; show only measured/server-provided values.
- **Verify:** picker/drop share validation; replacement clears geometry and dependent state; back/forward gates, retry, refresh policy and real job navigation work. No invented price, GPU-hour or queue estimate remains.

### Stage D — Processing and results

#### F28 — Durable jobs, queue and lifecycle

- [ ] **Requirement:** create/list/read a job from upload plus configuration; safe idempotency and persistent states. Sources: REQ 2.49, 3.1–3.6, 3.30–3.42, 4.16–4.17; FD4/FD16/FD21; O7/O9/O24/O56.
- **Current:** in-memory jobs, incompatible processing fields and mixed processing/running words.
- **Plan/dependencies:** F05/F17/F24–F26; agree remaining state contract. Lock upload before job, check source marker/existence, save snapshot, lock configuration and create queued job atomically. Migrate consumers together.
- **Verify:** repeated/concurrent creation has one job; absent source gives 410, infrastructure failure 503; no cross-org configuration reuse; restart/refresh preserves state; invalid transitions and missing jobs return agreed errors.

#### F29 — Worker claim, supervision and progress

- [ ] **Requirement:** isolated execution, independent heartbeat/cancel/deadline checks and fenced writes. Sources: REQ 3.5–3.6, 3.39–3.44, 5.17–5.19; FD5/FD13/FD20; O4/O46/O50/O81.
- **Current:** synchronous pipeline invoked through API BackgroundTasks; fixed progress/FPS.
- **Plan/dependencies:** F06/F28. Start with a stub engine to prove queue ownership, then connect F30–F34. Claim atomically; create attempt in same transaction; fence all writes by job/attempt/worker/running; configure timing only after approval.
- **Verify:** two workers claim once; slow model/storage work does not stop supervisor checks; estimated total overrun clears total atomically; unknown total has no false ETA; 100 percent occurs only on completed commit.

#### F30 — Real video reader and frame detector

- [ ] **Requirement:** bounded ordered batches, real frame/time references, frame skip, supported class filtering and verified clean EOF. Sources: REQ 4.55, 5.1–5.6, 5.14, 5.28–5.32; FD10/FD11; O14/O77.
- **Current:** fixed frame batch; detector passes the complete path to predict and materializes results.
- **Plan/dependencies:** F04/F24; choose/validate reader adapter. Build batch interface for frames/indices/times; apply saved settings and distinguish decode failure from EOF. Integrate with F29 after unit tests.
- **Verify:** short/empty/corrupt/truncated videos, irregular estimates and skipping behave correctly; memory is bounded; ambiguous read failure never publishes completed results; model selection/file identity is explicit.

#### F31 — Vehicle tracking

- [ ] **Requirement:** stable IDs across frames with the chosen supported tracker. Sources: REQ 5.7–5.8; O20/O78.
- **Current:** placeholder trackers allocate new IDs per detection; pipeline tracker is reused.
- **Plan/dependencies:** F30. Agree and implement tested adapters for supported tracker names; construct/reset state per job; maintain observations needed by counter. Do not silently substitute another algorithm.
- **Verify:** controlled motion, disappearance/occlusion, multiple vehicles, class changes and two consecutive jobs demonstrate expected identity handling; document fragmentation limitations on real footage.

#### F32 — Line-crossing counting

- [ ] **Requirement:** once per track per line in allowed direction, with finite segment and jitter behavior. Sources: REQ 5.9–5.10, 5.23; FD1/FD12, O66/O79.
- **Current:** counter is len(tracks).
- **Plan/dependencies:** F25/F31; agree remaining count-point/band choices. Implement signed side, current-excursion crossing candidate and finite intersection; discard stale/reversed candidates; retain event time until class finalization.
- **Verify:** forward/backward/both, repeated crossing, first seen on line, wobble, reverse inside band, path around endpoint, multiple lines and exact bucket boundaries have expected counts. Compare a manual short-video count.

#### F33 — Zone presence and zone attribution

- [ ] **Requirement:** no-lines mode counts a track once per zone, including first-frame presence; line mode attributes one zone by approved ordering. Sources: REQ 2.46–2.47, 5.10–5.11, 3.23; FD1/FD2.
- **Current:** no real zone-aware counting.
- **Plan/dependencies:** F26/F31/F32 shared observation model. Implement zone presence with not_applicable direction; for line events use intersection attribution and (sort_order, id) tie-breaking; keep methods distinct.
- **Verify:** initial presence, leave/re-enter, overlapping zones, line crossing outside all configured zones and no-zone line mode. Explain that new IDs after lost tracks can count again; totals are estimates, not unique global vehicles.

#### F34 — Aggregation, provenance and atomic completion

- [ ] **Requirement:** class/direction/time/geometry buckets; immutable context; no partial successful results. Sources: REQ 3.23, 3.33, 4.19, 5.11–5.12, 5.20–5.25; FD1/FD2/FD4/FD5/FD13/FD18; O34/O44/O68.
- **Current:** counts only appear in transient job logs; no real aggregation.
- **Plan/dependencies:** F28–F33; agree clock/bucket rules. Finalize class while preserving event timestamps, validate method/bucket shape, store model/hash/device/code provenance and counts with completed job/attempt in one fenced transaction.
- **Verify:** bucket sums reconcile; forced deferred constraints actually run; stale worker/cancel race cannot complete; failed transaction leaves no partial final result; repeated-run tolerance is measured then agreed.

#### F35 — Annotated output and results access

- [ ] **Requirement:** viewable video/frames, authorized result retrieval and stored artifact metadata. Sources: REQ 3.19, 4.19–4.20, 5.15, 5.21, 5.27; FD3/FD5, O36/O77.
- **Current:** annotated output is not produced; existing video UI is placeholder-based.
- **Plan/dependencies:** F21/F30–F34. Produce optional annotation in attempt-specific paths; publish artifact records on successful completion; coordinate results playback and downloads. Agree codecs/evidence quantity and output defaults.
- **Verify:** output is playable and aligns boxes/IDs/lines with frames; cancelled/failed attempts expose no final evidence; wrong organisation/missing artifact errors are clear. Live detection preview during processing is not promised by this file.

#### F36 — Cancel, retry, rerun and restart recovery

- [ ] **Requirement:** durable failure history, safe stopping, retryability and stale-worker recovery. Sources: REQ 3.7–3.10, 3.32–3.45, 4.18, 5.18–5.19, 6.15; FD5/FD13/FD21; O40/O46/O57/O81.
- **Current:** controls are decorative; no persistent attempts/recovery policy.
- **Plan/dependencies:** F28/F29/F34/F35. Decide timeouts/retry limits/codes; cancel queued directly and running after confirmed stop; retry same job with new attempt; rerun new job; preserve snapshots and check source under upload lock.
- **Verify:** blocked engine, supervisor crash, stale worker after retry, double click, cancel-versus-complete, missing source and failed cleanup. No orphan attempt overwrites current progress or artifacts; no partial success is shown. Pause remains excluded/open.

### Stage E — Reporting and application completeness

#### F37 — Dashboard and analytics

- [ ] **Requirement:** truthful organisation KPIs, activity, comparisons, class/time series and links. Sources: REQ 2.8, 3.12–3.16, 3.25, 4.22; FD2; O17/O34.
- **Current:** sample figures and services.
- **Plan/dependencies:** F20/F34. Query agreed latest completed jobs per upload and requested period/filter; separate line and zone totals; provide loading/empty/stale/error states through frontend coordination.
- **Verify:** reruns do not double count; filtered totals match matching report selections; mixed methods never become one unique-vehicle KPI; empty periods and timezone boundaries follow agreed interpretation.

#### F38 — Reports, regeneration and CSV/PDF exports

- [ ] **Requirement:** completed-job reports with filters, method, confidence, evidence and analysis version. Sources: REQ 3.17–3.24, 4.21; FD2/FD4/FD17, O22/O31/O83.
- **Current:** fake download/share feedback and sample report data; browser print exists.
- **Plan/dependencies:** F34/F35/F37. Normalize report options; create v1 or deterministic source-version successor under job lock; use snapshot metadata; build and authorize cached CSV/PDF exports. Automatic report option remains O22.
- **Verify:** concurrent/repeated creation/regeneration gives one intended row/notice; filters reconcile with buckets; export metadata remains truthful; generation/storage failures show errors. Excel/public sharing remain outside approved implementation until decided.

#### F39 — In-app notifications

- [ ] **Requirement:** scoped unread/history lists and read actions for upload/job/report outcomes. Sources: REQ 1.21, 3.11, 4.23; FD6/FD14/FD16, O84.
- **Current:** sample notification panel.
- **Plan/dependencies:** F07/F17 and domain transactions F22/F34/F36/F38. Add notification insert to corresponding state transaction; reuse existing record on retries; coordinate polling/read state. This is part of each emitting feature's completion, not optional deferred reliability.
- **Verify:** notification insert failure rolls back the associated transition; replay sends no duplicate record; other users/orgs cannot read notices; invite email delivery stays separate.

#### F40 — Audit and project activity history

- [ ] **Requirement:** append-only actor/action/outcome history with safe request/job/attempt correlation. Sources: REQ 2.6, 4.42; AC-14; NFR-7/NFR-11/NFR-16; FD7/FD20, O71.
- **Current:** incomplete in-memory logs; no durable audit integration.
- **Plan/dependencies:** F03/F05/F07. Add audit hooks as each feature is built, including refusal/sign-in event handling from trustworthy evidence; use restricted database roles. Finish audit query/history coverage here.
- **Verify:** no fabricated successful sign-in events from untrusted browser claims; relevant transitions have audit rows; secrets/tokens are absent; update/delete/truncate protections and non-owner connection privileges are tested.

#### F41 — Retention, orphan cleanup and controlled deletion

- [ ] **Requirement:** approved media retention, safe temporary cleanup and protected historical records. Sources: REQ 4.14, 4.43, 6.15; NFR-8; AC-1/AC-17; FD3/FD7/FD21, O10/O73/O76.
- **Current:** no comprehensive cleanup/retention implementation; periods unresolved.
- **Plan/dependencies:** F21/F28/F35/F36/F40. Keep automatic retention disabled until periods approved; serialize source deletion with queue/retry, skip active jobs and delete object before marker. Design any organisation purge separately with explicit authorization and backup consequences.
- **Verify:** active upload/attempt is never removed by age alone; storage/database partial failures retry safely; missing source blocks new analysis; completed evidence is preserved. No automatic audit/results deletion or report-file retention without separately approved policy/schema support.

#### F42 — Complete frontend coordination and usability

- [ ] **Requirement:** all existing routes, typed service integration, truthful states, keyboard access, responsive layouts and reduced motion. Sources: REQ 1.20–1.23, 2.51–2.54, 3.15, 6.4–6.6; FR-1–FR-14; NFR-13–NFR-15.
- **Current:** mocks, direct provider calls, duplicate types, large page components and untested accessibility.
- **Plan/dependencies:** coordinate incrementally with F08–F41, then complete a full route review. Preserve approved visual design, consolidate types/services, split components without redesign, stop polling on unmount/sign-out and resolve frontend lint gates with the frontend developer.
- **Verify:** full account-to-export journey and every route; keyboard lines/zones, focus/labels, narrow layouts and OS/in-app reduced motion; loading/empty/stale/offline/error states. Resolve mock GlobalSearch through a scope decision; do not ship it as real search.

### Stage F — Validation and client delivery

#### F43 — Accuracy, repeatability and optional model improvement

- [ ] **Requirement:** demonstrate client-agreed detection/tracking/counting quality and reproducibility. Sources: REQ 3.23, 5.23–5.25, 6.10–6.11, 6.18; NFR-6/NFR-10; AC-16; O37/O44.
- **Current:** no benchmark; reported low accuracy has not been measured on client footage.
- **Plan/dependencies:** F01/F30–F35. Compare manual ground truth against separate detection, tracking and counting metrics across representative conditions; record exact model/config/device. Diagnose errors before proposing model replacement or offline fine-tuning.
- **Verify:** agreed acceptance dataset passes or a concrete limitation/change request is recorded; confidence scores are not called accuracy. Offline dataset collection/training needs separate approval; training inside the product stays out of scope.

#### F44 — Load, performance and fault testing

- [ ] **Requirement:** measured latency/throughput/resources and recoverable failures. Sources: REQ 6.3–6.6, 6.15, 6.17; NFR-12/NFR-16; O17/O43/O46/O50/O81.
- **Current:** no verified concurrency/capacity limits.
- **Plan/dependencies:** F01/F22/F29/F36/F38/F41. Test representative duration/resolution, simultaneous uploads/jobs, storage outages, worker/API restarts, malformed inputs and disk exhaustion; approve capacity/rate/timeout values from evidence.
- **Verify:** target workload meets agreed limits; API remains responsive; memory remains bounded; queued work/history survive failures; recovery never publishes duplicate results. Benchmark the selected production hardware again before sizing promises.

#### F45 — Security and privacy release review

- [ ] **Requirement:** validated identity/role isolation, safe uploads, least-privilege storage, secrets, encryption and abuse limits. Sources: REQ 4.30–4.43, 5.27, 6.13; AC-1–AC-17; NFR-1–NFR-9/NFR-18.
- **Current:** known unauthenticated routes and unsafe upload behavior block client release.
- **Plan/dependencies:** F07–F41; security checks are also required within each feature. Review all exposed/legacy routes, download URLs, CORS, credential handling, worker privileges and agreed rate limits; validate sign-out/revocation expectations.
- **Verify:** cross-org and role negative tests pass; malicious upload/path tests pass; secrets and private footage are excluded from repo/logs; production transport/storage controls are demonstrated. No face/plate/identity recognition is enabled.

#### F46 — Commercial-use and delivery review

- [ ] **Requirement:** confirm the proposed sale/distribution/hosting arrangement is compatible with actual model, code and third-party licences and data permissions. Source: client-sale discussion; proposed delivery gate, not a legal conclusion.
- **Current:** no licence or contractual clearance established by this plan.
- **Plan/dependencies:** start during F01/F04; finalize before F49/F50. Inventory exact dependencies/weight provenance and intended deployment; obtain appropriate licence/legal review and identify attribution/source/distribution obligations where applicable.
- **Verify:** written disposition for the actual versions and delivery model; required licences/permissions and notices are documented. Do not infer commercial permission merely from a downloadable pretrained file.

#### F47 — Production architecture and cost decision

- [ ] **Requirement:** choose hosting, managed persistence/media, GPU capacity and operational responsibilities. Sources: REQ 6.16–6.17; O2/O3/O5/O47; client-sale discussion.
- **Current:** no provider selected; personal laptop/M4 storage and cloud options were discussed only.
- **Plan/dependencies:** F01/F43/F44/F46. Compare measured workload against budget, data location/privacy, availability, retention and recovery needs. Choose hosted versus client-installed delivery explicitly; on-site storage would need approval of any departure from current managed-production target.
- **Verify:** cost estimate includes storage, transfers, processing, backups and support; approved architecture names responsible operators and failure/recovery behavior. No AWS purchase or internet exposure is authorized here.

#### F48 — CI, packaging and reproducible releases

- [ ] **Requirement:** automated lint/typecheck/tests/contracts/smoke checks and reproducible deployment packages. Sources: REQ 6.6–6.9, 6.12–6.14, 6.20–6.23; O5/O14/O63/O87.
- **Current:** no established delivery pipeline; historical frontend lint fails.
- **Plan/dependencies:** introduce checks with F03 and expand per feature; finalize F42/F45/F47. Select CI with approval, separate API/worker packaging as needed, pin validated dependencies and document migration/release order.
- **Verify:** a clean checkout builds and runs required checks using examples without secrets; broken tests block release; model identity is recorded; deployment commands are validated rather than copied as untested promises.

#### F49 — Deploy, monitor, back up and restore

- [ ] **Requirement:** secure configuration, health checks, metrics/alerts, backups and rehearsed recovery. Sources: REQ 4.24, 6.16–6.17; NFR-3–NFR-5/NFR-16–NFR-18; O47/O71/O82.
- **Current:** production not deployed or approved.
- **Plan/dependencies:** F44–F48 plus explicit authorization for staging setup. Prepare chosen services, TLS, secrets, migration rollout, worker supervision and alerts; define backup retention/recovery objectives and restore/rollback instructions. This feature prepares staging and production release materials; it does not release to production.
- **Verify:** staging exercises API/database/storage/worker loss, backup restore and rollback; restored DB records correspond to available media; alerts reach the agreed operator. Production release remains blocked until F50 client acceptance passes and explicit production deployment approval is obtained.

#### F50 — Client acceptance and release decision

- [ ] **Requirement:** real users complete agreed journeys and accept measured limitations. Sources: REQ 6.5, 6.18–6.19; AC-16, O47.
- **Current:** no client acceptance evidence.
- **Plan/dependencies:** F01/F42–F49. Use agreed footage and roles to test registration through export, sign-out/reset, failure/retry, another-org denial and refresh during processing; track defects by impact.
- **Verify:** client acceptance evidence, agreed accuracy/performance results and unresolved limitations are documented; release-blocking issues are resolved. After this acceptance passes, request explicit approval for the prepared production deployment, perform the authorized release and check its health/smoke tests with the prepared rollback available. Approval names the responsible client/product decision-maker without assigning that role to Adrishikhar.

#### F51 — Handover, support and operating ownership

- [ ] **Requirement:** usable installation/operation/user guidance and agreed support arrangements. Sources: REQ 1.33, 6.9, 6.17–6.19; NFR-17, O45/O47; proposed commercial handover detail.
- **Current:** no completed handover package.
- **Plan/dependencies:** F49/F50. Deliver agreed source/package/licence notices, configuration guidance, account-access handover, storage/backup/recovery runbooks, monitoring ownership and issue-reporting instructions. Agree warranty/support/update scope commercially.
- **Verify:** responsible operator can start, diagnose, restore and upgrade using the guide; client can complete the workflow without assistance; no personal credentials or developer-machine dependency remain undisclosed.

## 6. Cross-feature obligations and dependency handling

F03 tests/contracts, F17 permissions, F39 notification transactions, F40 audit, F42 UI integration and F45 security are implemented alongside each affected feature. Their later checklist position is a final coverage checkpoint, not permission to omit them earlier. Build notification/audit primitives before the first upload/job/report transaction that requires them. This avoids a dependency cycle between emitting features and their final notification/audit review.

F16 and F17 share organisation primitives: implement F15's owner membership first, then F17 authorization before exposing F16 writes. F22 includes initial metadata validation and preview generation from F23 plus the bounded upload-reader subset of F30 before publishing ready; F23 then handles retrieval/editing/display and F30 completes analysis decoding. F27's Queue button is verified after F28, not marked complete when it only navigates. F29 can use a stub engine to verify lifecycle before real processing is integrated. Accuracy/model feasibility can run locally on authorized fixtures before a public API exists. F49 prepares staging/release materials; F50 acceptance and explicit deployment approval precede production release.

## 7. Decisions to resolve before dependent work

| Decision group | Existing references | Needed by |
|---|---|---|
| Identity/session policy, verification gate, password reauthentication and logout scope | O1/O11/O27/O51/O65; logout scope is newly identified, not approved | F07–F14 |
| Roles, membership count, invitation identity/delivery/lifetime and organisation preferences | O15/O38/O39/O67/O69/O74 | F15–F19 |
| Development packages, CUDA/CPU choice, fixtures and exact weights | O14/O37 | F02/F04/F30 |
| Migration/grants/purge approach | O63/O71/O73/O76 | F05/F40/F41 |
| Upload limits, formats, transport, preview and camera timezone | O8/O18/O68/O77/O85/O86 | F22/F23 |
| Model/tracker options, defaults, geometry, timestamp buckets and output | O20–O23/O28/O34/O36/O78/O79 | F24–F35 |
| Worker/state conventions, refresh polling, deadlines, recovery and concurrency | O4/O7/O9/O24/O40/O46/O50/O81 | F28/F29/F36 |
| Auto-report option, exports, provider libraries and notification channels | O22/O31/O83/O84; FD14 settles pre-membership email, EMAIL-01 selects Resend; integration/retry remain pending | F18/F38/F39 |
| Retention, link lifetime, abuse limits and backup/recovery objectives | O10/O43/O47/O82 | F41/F44/F45/F49 |
| Performance, repeatability and client acceptance thresholds | O17/O44/O47 | F01/F43/F44/F50 |
| Hosting, managed services, CI, budget and support contact | O2/O3/O5/O45/O47/O87 | F19/F47–F51 |
| GlobalSearch behavior; MFA/session management controls; new persistent preference schema | No approved full implementation inferred from placeholder UI | F19/F42 |

No threshold, cloud provider, commercial licence, delivery date, storage duration or GPU package compatibility is invented by this plan. O48/O72 and the approved FD decisions remain in force.

## 8. Explicitly excluded, conditional or placeholder features

| Item | Treatment |
|---|---|
| Billing, payments, invoices and API keys | Keep explicitly nonfunctional/sample per REQ 1.21 and O59 unless new scope approved; do not build payment processing merely because the product is sold |
| Global search | Mock component requires a decision: implement an agreed scoped search or clearly handle placeholder behavior; project search remains required |
| MFA, active-device/session management, account deletion UI | No new feature inferred from settings controls; discuss scope and security/data consequences separately |
| Live camera streaming or live annotated preview while processing | Outside current promised workflow; finished annotated output and processing progress are planned |
| Images, multi-video batching and copying geometry between videos | Not this version; FD8 requires one video per workflow |
| Pause/resume, Excel export and public share links | Unapproved/open under O30/O31; never claim they work |
| Speed, density, queue length, turning and lane analytics | Outside current approved counting scope; resolve O35 before adding |
| Face, licence-plate and identity recognition or anonymization switch | No enabling without separate approved product/privacy review; do not promise plate blurring from a decorative toggle |
| Model training inside the product | Out of scope; offline improvement may be proposed only after F43 diagnoses quality gaps and separate approval |
| Automated enforcement/traffic control and multi-region processing | Excluded from this version |

## 9. Requirement coverage map

The following coverage groups include both current-code findings to address and target requirements to implement. Exact wording/status remains in REQUIREMENTS; these mappings do not promote proposals to approved scope.

| Source coverage | Planned features |
|---|---|
| Deliverable 1: all account/organisation requirements 1.1–1.35 | F02, F07–F19, F39, F42, F51 |
| Deliverable 2: project/wizard requirements 2.1–2.56 (existing IDs only) | F20–F28, F32–F33, F40, F42 |
| Deliverable 3: queue/results/dashboard/report requirements 3.1–3.45 (existing IDs only) | F28–F39, F42 |
| Deliverable 4: API requirements 4.1–4.55 (existing IDs only) | F02–F03, F06–F07, F17, F20–F41, F45 |
| Deliverable 5: AI requirements 5.1–5.32 | F04, F06, F24, F29–F36, F43, F45 |
| Deliverable 6: quality/delivery requirements 6.1–6.23 | F01–F06, F42–F51 |
| FR-1–FR-14 | F03, F14, F27, F42, F48; coordinate frontend developer |
| AC-1–AC-17 | F07, F15–F18, F20–F21, F38, F40–F41, F45, F50 |
| NFR-1–NFR-18 | F02–F03, F19, F21–F23, F29, F36, F40–F49 |
| DATA_MODEL invariants 1–31 | F05 baseline and F15–F18/F21–F41 feature tests; force deferred checks as FD18 requires |
| D1/D2/D3/D4/D5 and SCOPE gaps | F02/F04; F02/F04; F22/F30; F21/F22; F07–F18 respectively; GAP-1–GAP-19 covered by the six deliverable groups |
| FD1–FD4 | F23–F26, F32–F35, F37–F38, F21 |
| FD5–FD8 | F22/F27, F29/F36, F39/F41 |
| FD9–FD12 | F22/F24/F30/F32 |
| FD13–FD16 | F03/F18/F22/F28/F29/F36/F39 |
| FD17–FD21 | F03/F05/F22/F28/F29/F38/F40/F41 |

## 10. Verification and next action

This plan is based on source inspection and an independent agent coverage review requested by Adrishikhar. Document checks cover required feature sections, source references, Markdown/link integrity and unchanged application scope. They do not run the backend, database, GPU inference, sign-in provider, frontend or production services.

Historical review evidence, 2026-11-07, 18:38 (Asia/Dhaka), recorded by Codex (the later review found the sequencing gaps corrected by PREP-01):

- Independent agent reviewed all 51 feature cards against REQUIREMENTS and the current account/application code. No blocking coverage or dependency gap reported; its source-ID clarification was applied so SCOPE findings F11/F12 are not confused with this plan's feature IDs.
- All 51 unique feature cards include requirements, current state, plan/dependencies and verification criteria. Feature references resolve within the plan.
- All 18 local links resolve. Markdown table columns and comment delimiters pass structural checks; explicit sign-up, verification, sign-in, sessions, sign-out, recovery, password-change and onboarding sections are present.
- Git inspection shows only the new implementation-plan file for this task. The new file is checked directly for whitespace/conflict markers because unstaged untracked files are not covered by ordinary git diff --check.
- These are documentation checks only. Existing application behavior, SQL and GPU performance have not been newly verified.

Runtime acceptance in each feature is work still to perform. Do not mark ROADMAP checkboxes or these feature checkboxes complete based on this planning exercise. Prior lint/typecheck results remain dated evidence, not a new run.

Next action: review this sequence, then select F01/F02 for a concrete first implementation plan. No feature code, installation, purchase, cloud upload, deployment, commit, push or branch creation is authorized by document creation. No dates or staffing commitments are assigned here.

Rollback for this documentation addition: revert only its eventual file diff through the user's normal version-control process; no database or runtime rollback is required. Deletion or Git operations are not performed automatically.
