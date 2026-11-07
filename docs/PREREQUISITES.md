# Johnson Road — Prerequisites and remaining decisions

<!-- Adrishikhar - 7 November 2026, 19:07 (Asia/Dhaka) · Documentation approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Decision ID: PREP-01; email provider decision EMAIL-01 (partially resolves O38).
Evidence: "for email we willbe using resend" and "okay now make an md file for this now".
Decision: record Resend as the selected email provider and document remaining prerequisites. Provider selection does not approve account creation, spending, installation, configuration, sending email or deployment.
Files and reason: this register and related planning references; make required inputs and readiness tests explicit before each feature starts.
Verification: static feature/link/structure checks; no external account, email delivery, database or GPU execution verified. -->

Recorded: 2026-11-07, 19:07 (Asia/Dhaka).
Backend contributor: **Adrishikhar Barua**. Recorded by: **Codex**. Client, frontend and operating responsibilities below are roles to assign, not a declaration that Adrishikhar owns the project or handles every role.

Use this register with the [implementation plan](IMPLEMENTATION_PLAN.md), [requirements](REQUIREMENTS.md), [low-level design](LOW_LEVEL_DESIGN.md) and [decision rules](DECISION_RULES.md). Feature IDs F01–F51 refer to the implementation plan. Approved dated decisions override older defaults; this document settles only the decisions explicitly identified as selected.

## 1. What is selected and what is still open

| Component | Decision/status | What remains |
|---|---|---|
| Email provider | **Resend selected by Adrishikhar Barua**, EMAIL-01 | Account/access, sending domain, sender, credentials, integration, retries and actual delivery tests |
| Identity/data boundary | O48: Supabase for sign-in; backend PostgreSQL owns application profiles, organisations, memberships, projects, jobs and reports | Real identity integration; provider configuration and token verification details |
| Database engine | O72: PostgreSQL locally and in production; local 18.4 responds | Supported version, project access, driver, migration runner, roles and schema execution; production hosting remains open |
| API framework | FastAPI/Python already used | Complete services, authentication, persistence and deployment |
| Development media | Local folders behind a storage interface are the proposed approach | Approve paths, capacity and configuration before setup |
| AI execution | Existing YOLO integration and two weight files; local NVIDIA GPU detected | Exact model selection, compatible packages, actual GPU inference, counting accuracy and licence review |
| Queue | PostgreSQL jobs-table worker is the proposed initial approach | Approve remaining worker choices and timing; no Redis/Celery requirement inferred |
| Production infrastructure | **Not selected** | Hosting, object storage, managed database provider, GPU sizing, domain and budget |

Selected does not mean configured. A package named in source does not prove it is installed. A package absent from the dependency file may still exist somewhere on the machine. A successful provider API response does not prove a recipient received an email.

## 2. Resend decision and integration boundaries

**EMAIL-01:** Resend is the selected email provider. This resolves the provider portion of O38, not the whole invitation/email workflow. Older statements that the email provider is undecided are superseded to this extent only. Invitation expiry, authorized roles, retry/deduplication, delivery handling and related open choices remain unresolved until explicitly approved.

Proposed implementation, still subject to feature-level code/configuration approval:

- **Authentication emails:** Supabase generates verification and password-recovery links; configure its custom SMTP integration to send through Resend. Resend delivers mail; it does not replace Supabase authentication.
- **Organisation invitations:** FastAPI generates and validates application invitation tokens; its email adapter sends through Resend. Membership remains in backend PostgreSQL. Do not assume a Supabase Auth invitation automatically creates the application's organisation membership.
- **In-app notifications:** remain database records delivered through the application (FD6). Selecting Resend does not approve emailing every job event, email digests or desktop notifications.
- Backend API credentials and SMTP secrets stay server-side. No Resend secret belongs in a frontend VITE variable, Git, chat message or diagnostic log.

Before real email use:

- [ ] Identify who controls the Resend account and is authorized to configure it.
- [ ] Obtain DNS access for the chosen sending domain/subdomain; verify it with Resend.
- [ ] Approve sender name/address and any reply-to/support address.
- [ ] Configure the approved Supabase SMTP route and separate backend invitation adapter as needed; credentials are supplied through approved secret storage.
- [ ] Set local, staging and production URL/callback allowlists separately. Do not send production users to localhost.
- [ ] Agree templates, permitted test recipients, rate limits, retry rules and how bounces/delivery failures are handled. Choose webhooks only if needed; verify their authenticity if introduced.
- [ ] Test verification, recovery and invitation from sending through link completion, including expiry, wrong recipient, provider outage and safe retry.

Reference material checked in this conversation: [Resend and Supabase integration](https://resend.com/supabase), [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls). Exact plan limits, pricing and account settings must be checked when configuring; none are assumed here.

## 3. Required accounts, configuration, software and inputs

<!-- Adrishikhar - 7 November 2026, 19:31 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Decision ID: PREP-02. Evidence: "fix" following the readiness review.
Decision: refresh documentation with scoped local observations and explicit configuration/compatibility gates; no setup or application changes approved here.
Files and reason: PREREQUISITES.md and IMPLEMENTATION_PLAN.md; distinguish detected software from working project dependencies and connect findings to feature preparation.
Implementation: documentation updated; runtime implementation pending.
Verification: document structure, feature references, local links and whitespace checked; no authenticated database, email delivery or GPU inference test. -->

The responsibility column proposes who supplies or coordinates an input. Individual assignees and permissions must be agreed. No account access is presumed available. Read the dated [local validation evidence](#local-validation-evidence) for the scope and limitations of these readiness observations.

| ID | Needed by | Prerequisite | Current readiness | Supply/coordinate | Proof before dependent work is marked complete |
|---|---|---|---|---|---|
| P01 | F02–F06, F48 | Supported Python/Node environments, approved dependency versions, settings loader and test tooling | Python 3.14.6, Node 24.16.0 and npm 11.13.0 detected; checked Python lacks core backend packages; project venv lacks Windows executable | Backend contributor; frontend developer for frontend setup | Approve compatible versions; clean start and appropriate tests from documented commands; clear missing-setting errors |
| P02 | F07–F15 | Supabase development project, authorized configuration access and public frontend connection settings | SDK exists; frontend Vite development env lacks all three connection settings; root anonymous key looks like a placeholder; remote account unknown | Authorized service administrator with backend/frontend developers | Correct approved env placement/loader and public settings, then real sign-in identifies expected user; environment separation and callbacks demonstrated |
| P03 | F07/F11/F45 | JWT verification library, issuer/audience and confirmed signing-key method | O51 open; proposed PyJWT absent from backend manifest | Backend contributor with Supabase administrator | Valid/expired/wrong-project tokens tested; signing-key rotation/outage behavior fails safely |
| P04 | F08/F09/F13 | Resend SMTP path for Supabase authentication emails, sender/domain, templates and test inboxes | Provider selected; no Resend settings found in checked local env; remote SMTP configuration and delivery unverified | Email/domain administrator with developers | Verification and reset links arrive and complete on the correct environment; errors do not show false success |
| P05 | F18 | Resend invitation adapter, acceptance URL, token policy and reliable retry/delivery tracking | Provider selected; local settings not found; remote account unknown; application integration pending | Backend contributor with email administrator | Expired/replayed/wrong-recipient links fail; send failures and retries do not duplicate membership or misstate delivery |
| P06 | F05 and persistent features | PostgreSQL instance, connection settings, database roles, selected Python driver and migrations | Local PostgreSQL 18.4 accepts connections; project login/schema untested; draft targets 16; driver absent from manifest and checked Python | Backend contributor; infrastructure administrator for installation/access | Decide supported version; connect, migrate isolated empty DB, force deferred constraints, verify roles and rollback; preserve existing data where applicable |
| P07 | F04/F30/F31 | Compatible PyTorch/Ultralytics, GPU-capable build where selected, validated weights and tracker adapters | Weights and RTX 5060 Laptop GPU detected; torch/ultralytics absent from manifest and checked Python; inference untested | Backend contributor | Approve compatible Python/packages/device build; exact model/hash/device recorded; real short-video inference works; no silent algorithm/model substitution |
| P08 | F22/F23/F30/F35 | Video decoder/metadata reader and encoder with required codec/container support | O77 open; reader not declared in backend requirements | Backend contributor | Decode valid/corrupt/truncated clips, distinguish EOF, produce preview and browser-playable output with bounded memory |
| P09 | F21–F23/F35/F38 | Local storage roots, free-space budget, source/output separation and protected access | Planned; capacity/access checks pending | Backend contributor | Safe key/containment tests, disk-full behavior, permission checks and exact-object cleanup pass |
| P10 | F14 | Avatar representation, storage/input policy and approved limits | avatar_url exists in target model; upload behavior undecided | Backend/frontend developers and product approver | Agreed URL or upload workflow validates inputs, access, persistence and removal; no image SaaS automatically required |
| P11 | F16/F19/F42 | Exact organisation/user/device preferences, schema/persistence scope and support contact | Controls exist; behavior/persistence/contact incomplete | Product approver and frontend/backend developers | Supported settings persist at agreed scope; no fake MFA, API-key or support-ticket action |
| P12 | F28/F29/F36 | Worker execution/supervision, jobs-table access, heartbeat/recovery/deadline/retry values | Mechanisms partly decided; values and runtime pending | Backend contributor; operator for deployment | Claim races, stalled analysis, process death and stale-attempt writes tested; no broker account required by current proposal |
| P13 | F38 | CSV writer, PDF library, fonts/templates and artifact storage | Python CSV is built in; ReportLab 5.0.1 found in checked Python, absent from project manifest; report generation untested | Backend contributor with approved report assets | Confirm chosen project dependency; real CSV/PDF downloads, required characters/fonts, filters/provenance and failed-generation cases pass |
| P14 | F01/F04/F43/F50 | Permitted client videos, manual reference counts, representative conditions and measurable acceptance thresholds | Footage/targets not supplied or approved by this document | Client/product approver; backend contributor measures | Dataset permissions and ground truth recorded; detection/tracking/counting and performance evaluated separately |
| P15 | F04/F43/F46 | Model/dependency provenance and commercial-use/data permissions | Not cleared by downloading weights | Client/commercial decision-maker with appropriate reviewer | Actual versions and intended sale/deployment reviewed; obligations and required licences documented |
| P16 | F47–F49 | Production hosting/storage/database accounts, regional choices, GPU capacity and budget | No vendor selected or account readiness verified | Client/infrastructure decision-maker | Approved measured sizing, cost and privacy/recovery requirements; authorized staging deployment |
| P17 | F47–F51 | Domain/DNS/TLS, secrets mechanism, deployment access and CI configuration | Not established | Authorized domain/infrastructure administrator | Correct HTTPS/callbacks, secret separation and reproducible releases; no credentials embedded in client bundles |
| P18 | F41/F44/F49/F51 | Retention rules, backup destination, recovery targets, monitoring/alerts and named operator | Policies/providers/contact not finalized | Client/operations decision-maker with backend contributor | Storage/worker/API alerts and DB-plus-media restoration exercised; retained sources protect active jobs |
| P19 | F50/F51 | Client acceptance participants, release approver and handover/support responsibilities | Unassigned | Client/product/operations decision-makers | Acceptance evidence and explicit release authorization before production; operator can follow runbooks |

No row above authorizes installation, account changes, email sending, purchases or deployment. Those actions require the specific approval already described in the project rules.

### Local validation evidence

Recorded 2026-11-07, 19:31 (Asia/Dhaka), from read-only checks in this conversation on the Windows development laptop. These observations are not a successful application startup or a machine-wide package inventory.

| Check | Observed result | Still required |
|---|---|---|
| Python/package metadata | Python 3.14.6 at `C:\Users\Adri\AppData\Local\Python\pythoncore-3.14-64\python.exe`; FastAPI, SQLAlchemy, Pydantic, pydantic-settings, Uvicorn, torch, Ultralytics, OpenCV packages, av, PyJWT, psycopg, psycopg2-binary, asyncpg, pytest and resend not found in this interpreter; ReportLab 5.0.1 found | Select approved project environment and pinned compatible dependencies; presence elsewhere is unknown; metadata is not an import/runtime test |
| Existing project environment | `backend/.venv/pyvenv.cfg` records 3.9.6; `bin/python` exists, `Scripts/python.exe` does not | Prepare an approved usable Windows environment; do not delete or overwrite the existing environment without approval |
| Frontend tooling | Node 24.16.0, npm 11.13.0 and installed Vite 5.4.8; frontend node_modules exists | Reproducible startup and appropriate checks after approved configuration changes |
| Effective frontend configuration | Installed Vite `loadEnv('development', path.resolve('frontend'))` returned no VITE_API_URL, VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY; vite.config.ts has no envDir override | Approve frontend env placement or loader configuration and validate public settings before testing real sign-in |
| Local configuration inventory | Root .env has nonempty but unvalidated API/Supabase URLs and a placeholder-looking anonymous key; no frontend/backend .env files or matching shell variables found in inspected locations; no Resend settings found there | Root .env is not loaded by the checked frontend Vite setup. Remote Supabase/Resend dashboards were not inspected; account, domain, SMTP and credential validity remain unknown. No values are recorded here |
| PostgreSQL readiness | PostgreSQL 18.4 under `C:\Program Files\PostgreSQL\18\bin`; pg_isready for 127.0.0.1:5432 reported accepting connections; psql/pg_isready were not on PATH | Project authentication, database, roles and schema are unverified; listener readiness proves none of them |
| AI hardware/assets | RTX 5060 Laptop GPU, 8151 MiB, driver 617.42; backend/yolov8n.pt and backend/yolo11n.pt present | Package/driver compatibility, model provenance/hash, successful GPU inference, performance and accuracy remain unverified |
| Planned runtime paths | backend/app/database/migrate.py, backend/app/jobs/worker.py, data, backend/models and backend/uploads absent when checked | Implement approved migration/worker entry points and storage paths; existing weights are in backend root |

**Compatibility gate (P01/P06/P07):** schema.sql is written for PostgreSQL 16; the observed local server is 18.4. Decide the supported target and validate the draft and deferred constraints in an isolated database before claiming support. Likewise, choose and validate the Python/PyTorch/Ultralytics/native codec combination and selected GPU build. Detected versions are neither proof of compatibility nor proof of incompatibility. Do not automatically downgrade PostgreSQL, replace Python or install packages because of this audit; propose the specific setup for approval first.

## 4. Configuration inventory — names only

These are existing names or proposed configuration categories, not credentials to paste into this file. Final names must be agreed in the feature implementation and documented in safe env examples.

| Area | Inputs to prepare | Visibility |
|---|---|---|
| Frontend | Existing VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY; agreed callback routes | Only intentionally public configuration; never service-role, SMTP or Resend secrets |
| Backend authentication | Issuer, audience and JWKS location or approved alternative verification method | Server configuration; any signing secret remains server-only |
| Backend email | Proposed RESEND_API_KEY, sender identity, invitation base URL and retry policy | Key server-only; no actual values recorded here |
| Supabase email settings | Resend SMTP credentials, sender and approved templates/redirect URLs | Configured by authorized administrator; not in frontend environment |
| Database | DATABASE_URL and approved runtime/migration roles | Server-side credentials; redact in logs |
| Local media/AI | Storage root, model directory/path, selected device and approved upload/analysis limits | Backend/worker configuration; avoid exposing machine paths in responses |
| Production | Chosen service endpoints, role-based access or credentials, secrets/backup locations | Exact mechanism depends on approved provider; no cloud secret required to start local development |

## 5. Decisions still needed

- [ ] **Authentication:** email-verification gate, current-device/all-device logout, access-token validity/revocation expectations, password-change reauthentication (O11/O27/O51 and session details).
- [ ] **Membership:** final permissions, ownership/suspension behavior, one-organisation rule, invite expiry and recipient matching (O15/O67/O69/O74). Resend selection does not resolve these.
- [ ] **Database/environment:** Python and package versions, GPU or CPU configuration, PostgreSQL driver, migration tool and privileges (O14/O63/O71).
- [ ] **Uploads:** formats, byte limit, duration/unit, preview position, reader, transport and camera timezone (O8/O18/O68/O77/O85/O86).
- [ ] **Analysis:** supported tracker adapters, count point/jitter geometry, bucket timing, repeatability tolerance and annotated-output default (O20/O34/O36/O44/O78/O79).
- [ ] **Jobs:** remaining state-policy choices, concurrency, deadlines, heartbeat/recovery timing and retry policy (O4/O7/O9/O40/O46/O50/O81).
- [ ] **Reports/preferences:** automatic reports, PDF implementation/assets, editable preference fields and avatar behavior (O22/O83 and feature-specific decisions).
- [ ] **Operating policy:** retention periods, signed-link lifetime, rate limits, capacity, backup/restore goals, hosting budget and support contact (O10/O17/O43/O45/O47/O82).
- [ ] **Client delivery:** ground truth, pass thresholds, licence review, acceptance participants, release approver and operating/support responsibilities.

Payments, billing providers, Redis/Celery, external PDF services, image SaaS, helpdesk platforms and external search services are **not automatic prerequisites**. Add them only if an approved feature or architecture decision requires them. No production dependence on the personal laptop or M4 Mac mini is selected here.

## 6. Order of preparation

1. Confirm client scope, permitted footage and who supplies service/domain access (P14/P19).
2. Inspect the existing local environment, then present the concrete setup plan for approval (P01/P06/P07/P09). Production hosting need not be chosen yet.
3. Prepare Supabase identity and Resend email configuration with authorized administrators (P02–P05). Complete actual test journeys before declaring account features done.
4. Resolve upload/analysis inputs and implement the feature slices in the implementation plan (P08/P10–P13).
5. Measure accuracy/performance and complete commercial/data-use review before committing to production sizing or promises (P14–P16).
6. Prepare and test staging, backups and release materials; complete client acceptance; obtain explicit production deployment approval; then release and hand over (P17–P19).

Two sequencing safeguards are incorporated in the linked plan: initial upload metadata validation and preview generation must finish before ready status; staging readiness alone does not permit production release before client acceptance.

## 7. Readiness record to complete per prerequisite

For each P-ID record: status (Not assessed, Needs decision/access, Ready for implementation, Verified), selected tool/provider/version, responsible person, required access/configuration **names**, approved cost/action reference, affected features, dated test result and remaining limitation. Initially all unverified readiness remains unverified; EMAIL-01 selects a provider only.

Before starting a feature, confirm its required inputs are available or explicitly isolate a testable substep. A mocked email sender can support unit tests but cannot pass the real email-delivery acceptance gate. A fake engine can verify queue ownership but cannot pass video-analysis accuracy acceptance.

## 8. Change and verification record

| Date/time | Requested/decided by | Record | Editor | Verification |
|---|---|---|---|---|
| 2026-11-07, 19:07 (Asia/Dhaka) | Adrishikhar Barua | EMAIL-01: Resend selected; provider portion of O38 resolved, implementation and delivery policy pending | Codex | Source/decision references reviewed; no account or email configuration tested |
| 2026-11-07, 19:07 (Asia/Dhaka) | Adrishikhar Barua | PREP-01: requested Markdown register of remaining prerequisites; linked implementation-plan clarifications | Codex | Feature references, document links, table/comment structure and whitespace checked; no application/runtime change |
| 2026-11-07, 19:31 (Asia/Dhaka) | Adrishikhar Barua | PREP-02: fix approved; dated local readiness evidence, frontend configuration blocker and compatibility gates linked to feature preparation | Codex | Document structure, feature references, local links and whitespace checked; application, database schema, email delivery and GPU inference remain unverified |

Creation of this register is approved; the proposed technical integration details and remaining choices are not automatically approved. No installation, secret entry, email transmission, database change, deployment, Git commit or push was performed. Reversing these documentation diffs requires no runtime rollback.
