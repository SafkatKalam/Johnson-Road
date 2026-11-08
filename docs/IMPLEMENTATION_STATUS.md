# Implementation status and change record

Date: 2026-11-08 (Asia/Dhaka). Recorded by: Claude (Claude Code). Requested by: Adrishikhar Barua.
Status: Stage A (F02–F06) implemented in `backend/`; independently audited twice; **not committed**.
This file records what is now true in code. Where an older document says otherwise (see section 4), this file is the newer record.

## 1. Decisions recorded (all given by Adrishikhar Barua in the conversation of 2026-11-08)

| ID | Decision | Evidence | Limits |
|---|---|---|---|
| DEC-DB-01 | Local development database: Docker, PostgreSQL **16**, alpine image, host port **5430**, bound to 127.0.0.1 | "use postgres 16 and port 5430 at docker and use alphine" | Local development only. Production hosting stays open (O2). Closes the 16 versus 18.4 question from PREREQUISITES P06 for local use. |
| DEC-DB-02 | Connection style `postgres://user:password@host:port/db` (also `postgresql://`), local credentials like the Dreamshare project | "use this same to same okay" | Local only. The host is written `127.0.0.1` (not `localhost`) because on this Windows machine `localhost` tries IPv6 first and the connection stalls. |
| DEC-FS-01 | Local file storage: MinIO in Docker (S3-compatible), API port 9110, console 9111 | "use minio" | Uses the legacy Bitnami image already on the machine, pinned by digest. It is unmaintained: local development only. No application code uses it yet. Resolves the local part of O3. |
| DEC-PORT-01 | Frontend on port 3000, backend on port 5000, connected | "run frontend at 3000 and backend at 5000 and have them connected" | `frontend/.env` `VITE_API_URL` changed to port 5000. Frontend pages still show sample data (not wired to the API). |
| DEC-AI-01 | Install the GPU build of PyTorch (CUDA 12.8) and Ultralytics into `backend/.venv-win` | "i am approval for it for the multi-GB torch install", "install now" | Approves this install only. Pinned in `backend/requirements-ai.txt`. |
| DEC-WORK-01 | Implement features one by one; features that need outside accounts or people go last | "complete all the features… keep that feature for the end" | Does not approve commits, deletions, purchases, accounts or deployment. |

Not decided and still open: error shape O26 (implemented as the default, a Proposal), whether `status` should read "degraded" while no worker exists (implemented as: `status` = API and database; `processingReady` is separate), roles and grants for the application database user (O71, O76).

## 2. What was built (Stage A, F02–F06)

| Feature | Result | Evidence |
|---|---|---|
| F02 Setup and configuration | Windows virtualenv `backend/.venv-win`; settings read `backend/.env`; `DATABASE_URL` is required and a missing or invalid setting stops start-up with one plain message; AI settings read the same file (`MODEL` defaults to `none`); `requirements.txt` (pinned), `requirements-dev.txt`, `requirements-ai.txt`; `docker-compose.yml` (PostgreSQL 16 + MinIO); `.env.example` with placeholders | Clean install from `requirements.txt` only starts and answers `/health`; tests |
| F03 Test foundation, error contract | One error shape `{"error":{"code","message","diagnosticId"}}`; request id on every response; one JSON access-log line per request; secret masking; 156 tests | `backend/tests/` |
| F04 YOLO feasibility | `yolov8n.pt` runs on the RTX 5060 (`cuda:0`) and on CPU; defect D1 fixed (`class_id`); no silent model or device switch; device and weights SHA-256 recorded in memory; real warmup | Run on a public sample photo: 6 detections, 41 ms on GPU. **Tracking, counting and accuracy on real traffic video are not proven** (F30, F31, F43). |
| F05 PostgreSQL and migrations | `backend/migrations/0001_initial.sql` (the 21-table schema) applied by `python -m app.database.migrate`; checksum, advisory lock, one transaction per file; schema rules tested with real commits including the deferred "completed needs a result" rule (FD18) | `tests/test_database.py` against a throwaway database |
| F06 Health and readiness | `/live`, `/health` (no paths or credentials; `databaseReady`, `workerReady`, `processingReady`, `detectorLoaded`, `detectorIsStub`), `/ready` (503 unless the database answers and migrations are applied); the API starts with no model or a failed model | `tests/test_health.py`, `tests/test_no_model_startup.py` |

Not done in Stage A: F01 (needs the client); repositories (come with the features that use them); database roles and grants (O71); per-job tracker reset; a privileged diagnostics endpoint (needs sign-in, F07).

## 2b. Stage B, sign-in group (F07–F12), recorded 2026-11-08 (later the same day)

Decisions given by Adrishikhar Barua in the conversation:

| ID | Decision | Evidence | Limits |
|---|---|---|---|
| DEC-AUTH-01 | New Supabase project `tbikgagbnheijjmnorea` (Singapore) is the sign-in provider; its public URL and publishable key are used (old project `frgbtqkdbumrbneqlfjb` is no longer used) | screenshots and paste in the conversation | Sign-in only. The backend never uses the project's database. |
| DEC-AUTH-02 | Frontend sign-in files may be changed: `services/api.ts`, `services/auth.service.ts`, `lib/auth.tsx`, `lib/supabase.ts`, `lib/authNotice.ts`, `App.tsx` (onboarding guard), `pages/auth/{Login,Register,VerifyEmail}Page.tsx` | "approve" to the plan of 2026-11-08 | Scope expansion beyond `AGENTS.md` for these files only. No visual redesign. |
| DEC-AUTH-03 | Test accounts `adrishikharbarua77452@gmail.com` (owner) and `adrishikharbarua77452v1@gmail.com` (admin) get one local organisation "Johnson Road (test)" in the local Docker database | "approve" and the Supabase user created by Adrishikhar | Local development seed only. Undo: `delete from users where email like 'adrishikharbarua77452%'` removes users, memberships (cascade); then delete the organisation. |
| DEC-AUTH-04 | Sign-out ends this device only (default offered; no objection) | plan of 2026-11-08, "approve" | Proposal accepted by silence; not an explicit choice between the two options. |

Not decided, defaults used: O11 (email verification is not enforced by this app; Supabase's own "Confirm email" setting is currently ON, so unconfirmed users cannot sign in); O27 (password change); O51 (token details: ES256 with the project's public key, only ES256/RS256 accepted).

| Feature | Built | Verified | Not done or not verified |
|---|---|---|---|
| F07 Backend identity | `app/auth/` (token check, dependencies), `GET /api/me`, all legacy routes need an active membership (FD16) | 244 backend tests (every bad-token kind, concurrent first sign-in, role/org only from PostgreSQL); real Supabase public key fetched; a forged token with the real key id refused | Roles and grants for the database user (O71) |
| F08 Sign-up | `AuthService.register` (plain-word errors, existing address not treated as a new account) | type check, lint | No real sign-up run in a browser |
| F09 Email verification | Resend with 60-second wait, address carried in router state (not the URL), truthful "Continue" check, expired/used link messages captured before the Supabase client starts | type check, lint | Never exercised with a real email (Supabase's built-in sender; Resend not connected); O11 gate not built (by default) |
| F10 Sign-in | `AuthService.login`, `AuthProvider`, bearer token on every API call; the fake login and fixed user are removed | Adrishikhar's sign-in reached `/api/me` with 200 (backend log, 2026-11-08 14:07) | Wrong-password, double-click and network-failure paths not tried in a browser |
| F11 Session | Session restore, multi-tab listener, 401 handling, one account load per token, onboarding redirect loop fixed (`SignedInRoute`) | type check, lint; backend refuses removed or suspended membership (tests) | Refresh, second tab, expiry not tried in a browser |
| F12 Sign-out | `AuthService.logout` (`scope: 'local'`), on-screen state always cleared, old `jr-auth` flag removed | type check, lint | "Back shows no protected data" not tried in a browser |

Independent audit of F07–F12 (read-only reviewer, 2026-11-08, 23 findings). Fixed the same day:
- `emailVerified` removed from `/api/me`: it was read from `user_metadata`, which the signed-in person can edit, so it could be forged. The backend no longer claims email verification at all. The app relies on Supabase's "Confirm email" setting (O11); if that is ever turned off, do not match invitations or merge accounts by email.
- Unknown token key ids can no longer force repeated downloads of Supabase's key list (one miss pauses other unknown ids for 10 seconds); tested against the real `PyJWKClient` and a local key server, including RS256, no key id, a future `iat`, and a key-server outage.
- The email-conflict error is raised only for the real email constraint; other database errors surface as errors.
- Every `/api` route and method (not only GET) is tested for protection, and a test fails if a route is mounted without the membership check.
- Frontend: stale account response after sign-out or switch is dropped (generation counter); failed sign-out still removes the stored session and never throws; each backend failure has its own message (suspended, email already linked, server unreachable); an expired token on any call signs out; "email not confirmed" at sign-in opens the verify page; verify page has its own email box when opened without one; resend wait survives a reload; email-link errors are read from the hash and the query string, whole parameters only.
Left as decided or open: Onboarding page still writes to non-existent Supabase tables and loops (F15). Forgot-password page shows provider text and has no reset-completion page (F13). Frontend has no automated tests (no runner installed; adding vitest needs an install). Sign-up tells a visitor when an address already has an account (convenience over anti-enumeration; decision not taken). Redirect URLs in Supabase must also allow `http://127.0.0.1:3000/**` if the app is opened at that address. `/docs`, `/openapi.json` and `/health` are public (O26).
Known broken until later features: the onboarding page (F15) and the organisation page (F16) still read or write Supabase tables that do not exist in the new project. (The forgot-password page and the profile page no longer do: F13 and F14 below.)

**F13 and F14 built, 2026-11-08 (later).** `PATCH /api/me` (name and https avatar address only; role, organisation, email and status are refused with 422; 29 new backend tests, 286 in total); `ProfileService`; password change re-checks the current password first (O27 default), then signs out the person's other devices; forgot-password answers the same for known and unknown addresses (a sending limit used to reveal which addresses exist); `/reset-password` page that only accepts a real recovery session; email-link errors in the address bar are shown as plain messages.

**Browser test, 2026-11-08: 41 of 41 checks pass in Edge 157 and in Brave 157** (a script outside the repo using `playwright-core`, headless, real Supabase project, real local backend). It covers: sign-in page, wrong password, unconfirmed account sent to the verify page and resend, expired email link, a no-organisation account lands on `/onboarding` without looping, one user row on first sign-in, protected pages when signed out, dashboard with an organisation, no fake user anywhere, refresh and a second tab, one `/api/me` call per load, a bearer token on every API call, name change stored in PostgreSQL and shown after reload, bad avatar address refused without "Saved", protected fields refused, password change (wrong current, mismatch, too short, same, success; old password dead, new works; another device's session revoked), sign-out (session removed, Back does not show the dashboard, an interrupted sign-out finished on reload, second tab signed out), forgot password (neutral answer), password reset from a real Supabase recovery link (mismatch and short refused, success, old password dead, other device revoked, link not reusable, ordinary signed-in person refused), sign-up validation and an already-registered address.

Bugs the browser test found and fixed (none visible to the type check, lint or backend tests): form labels were not linked to their inputs (`Input.tsx`, accessibility); the email-link message vanished because React runs state initialisers twice in development; forgot-password revealed which addresses have accounts; a sign-out left the session stored for about a second, so a reload in that moment could undo it.
Not covered: real email delivery (Supabase's built-in sender only mails project team addresses; Resend is not connected), the onboarding form (F15), and the organisation, member, invitation and settings pages (F16–F19).
The test creates throwaway users `jr-e2e-*@example.com` in the Supabase project and organisations `E2E Org *` in the local database. They were not deleted.
Also fixed on 2026-11-08: the frontend dev server listened on IPv6 only (`[::1]`); `vite.config.ts` now sets `host: '127.0.0.1'`.

## 3. Verification actually performed

- `REQUIRE_DB=1 pytest tests`: **156 passed, 0 skipped**, run against the Docker PostgreSQL 16.15 (throwaway databases, dropped afterwards).
- Clean-install run in a new virtualenv from `requirements-dev.txt` only: without `DATABASE_URL` the plain error appears; with it and no `MODEL`, the API starts and `/health` says `detectorLoaded:false`.
- Real model: loaded on `cuda:0` through the runtime with warmup.
- Two independent read-only audits of the work (the second one blind to the first). Their findings were fixed; remaining Low items are listed in section 5.
- Not verified: sign-in, email, the frontend pages against the real API, anything on a real video.

## 4. Older statements that are now out of date (not edited, superseded by this file)

| Document | Statement | Now |
|---|---|---|
| DATA_MODEL.md line 17, schema.sql line 9 | "has not been executed or validated against PostgreSQL" | Executed on PostgreSQL 16.15 on 2026-11-08 (21 tables, no errors) and covered by tests. `backend/migrations/0001_initial.sql` is the applied copy; `docs/schema.sql` stays the readable draft. |
| DATA_MODEL.md 36, 106, 515–521; ARCHITECTURE.md 111, 159, 412, 481; SCOPE.md 24, 115, 201, 262; LOW_LEVEL_DESIGN.md 25; IMPLEMENTATION_PLAN.md 46, 116; DECISION_RULES.md 33 | "the code still uses SQLite" | `backend/app/database/database.py` uses PostgreSQL from `DATABASE_URL`. A leftover SQLAlchemy `Project` model (`database/models.py`) and an unregistered `api/projects.py` still exist and do not match the schema. |
| ARCHITECTURE.md 209, SCOPE.md 97 (PR-11) | `/health` shows the model path | It no longer does. |
| LOW_LEVEL_DESIGN.md 44, 967 | engine built at import; `schema_migrations(version, applied_at)` | The pipeline now resolves its detector when a job runs. `schema_migrations` also stores `filename` and `checksum`. |
| IMPLEMENTATION_PLAN.md 116, PREREQUISITES.md P06/P07 | PostgreSQL 18.4 versus draft for 16; torch/ultralytics absent | Local development uses PostgreSQL 16 in Docker (DEC-DB-01). torch 2.11.0+cu128 and ultralytics 8.4.207 are installed in `backend/.venv-win`. |
| SCOPE.md F2, REQUIREMENTS.md 5.28 | model-path fallback misses the weights in both places | Only the old `runtime.py` fallback missed them (the weights are in `backend/`). All fallbacks were removed; `MODEL_PATH` is used exactly or the load fails with a named error. |
| SCOPE.md AU-5 | "onboarding never shown" | `/onboarding` is reachable (`VerifyEmailPage.tsx:13-17`); `needsOnboarding` only controls the automatic redirect. (Found by the document fact-check, not changed in SCOPE.) |

## 5. Known remaining items (Low or deliberate)

- `backend/.venv/` (an old macOS environment) is tracked in git; `database/models.py` and `api/projects.py` are unused. Removing them needs your permission.
- The test-only database user is the PostgreSQL superuser, so the audit-table "append-only" triggers are not proven against a least-privilege role (O71, O76).
- `BaseHTTPMiddleware` is gone; CORS preflight (`OPTIONS`) requests get no request id or access-log line (CORS runs outside the request-id layer).
- Failure after a response has started is logged by uvicorn without the diagnostic id.
- MinIO uses an unmaintained image; the application S3 keys are the MinIO root keys.
- `.vscode/` (one setting) is untracked; left to its owner.

## 6. Undo

Everything is uncommitted. `git status` lists it; `git checkout` and `git clean` on the listed paths reverse it. Services: `docker compose down -v` in `backend/` removes the database and storage volumes; delete `backend/.venv-win` to remove the Python packages (about 4.8 GB). `pip cache purge` frees a further 3 GB of downloads on drive C:.
