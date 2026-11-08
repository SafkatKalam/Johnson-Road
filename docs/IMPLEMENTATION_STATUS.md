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
