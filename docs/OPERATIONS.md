# Operating Johnson Road

Runbook for whoever runs the system (F49, F51). Status: **Proposal** until the client names the operator and support
owner and the hosting is chosen (F47). Nothing here has been deployed to a server.

## 1. The parts

| Part | Command (from `backend/`) | Needs |
|---|---|---|
| Database | PostgreSQL 16 (`docker compose up -d` locally) | `DATABASE_URL` |
| Migrations | `python -m app.database.migrate` (once per release, before starting new code) | database |
| API | `uvicorn app.main:app --host 127.0.0.1 --port 5000` | database, storage folder, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` |
| Worker | `python -m app.worker` (one or more; each takes one job at a time) | database, the same storage folder, `MODEL`, `MODEL_PATH`, `DEVICE` |
| Frontend | `npm run build` in `frontend/`, serve `dist/` as static files | `VITE_API_URL`, Supabase publishable key |

The API and the worker must see the same storage folder (`STORAGE_ROOT`). The worker refuses jobs while only the stub
detector is loaded; `/health` shows `processingReady: false` then.

## 2. Settings that change behaviour (`backend/.env`)

| Setting | Default | Meaning |
|---|---|---|
| `UPLOAD_MAX_BYTES` | 2147483648 (2 GiB) | Largest video accepted (proposal, O8) |
| `UPLOAD_MAX_DURATION_SECONDS` | 14400 (4 h) | Longest video accepted (proposal) |
| `UPLOAD_MAX_PIXELS` | 7680×4320 | Largest picture size |
| `ORG_MAX_ACTIVE_JOBS` | 10 | Jobs one organisation may have queued or running at once |
| `ORG_MAX_STORAGE_BYTES` | unset | Total video storage per organisation; unset = no quota (O39 undecided) |
| `REPORT_MAX_VERSIONS` | 20 | Versions of one report |
| `JOB_TIMEOUT_SECONDS` | unset | Longest a job may run; unset = no limit (O46 undecided) |
| `MODEL`, `MODEL_PATH`, `DEVICE` | `none` | Detector (`yolo8` + weights file for real processing) |

## 3. Health and monitoring

- `GET /live`: the API process is up.
- `GET /ready`: 200 only when the database answers and all migrations are applied. Use it for the load balancer.
- `GET /health`: `databaseReady`, `workerReady` (a worker wrote a heartbeat in the last 30 s and has a real model),
  `processingReady`, `detectorLoaded`, `device`. No paths or secrets.
- Logs are JSON lines on standard output, one `johnsonroad.access` line per request with the request id. Errors carry a
  12-character diagnostic id that users see; search the logs for it.
- Alert on: `/ready` failing, `workerReady` false for more than 2 minutes while jobs are queued, jobs failing with
  `worker_lost`, disk usage of the storage folder above 80 %.

## 4. Routine tasks

| Task | How |
|---|---|
| Back up | `bash scripts/backup.sh` (database dump + media copy, with checksums). Copy the folder off the machine. |
| Restore | Stop API and worker, `bash scripts/restore.sh <folder>` (dry run), then `... --yes`. Then run the orphan scan. |
| Orphan scan | `python -m app.maintenance orphans` (report only); `--apply` deletes stray files older than 1 hour. |
| Release checks | `bash scripts/check.sh` must end with "ALL CHECKS PASSED". |
| Count accuracy | `python tools/evaluate_counts.py --app report.csv --truth manual.csv` |
| Load test | `JR_TOKEN=... python tools/load_test.py --users 20 --seconds 30` |
| Licence inventory | `python tools/licence_inventory.py` (writes `docs/LICENCE_INVENTORY.md`) |

## 5. When something goes wrong

| Symptom | Likely cause | Action |
|---|---|---|
| Jobs stay "queued" | No worker running, or only the stub model | Start `python -m app.worker`; check `/health` `processingReady` |
| Job failed `worker_lost` | Worker stopped or the machine slept | Restart the worker; press Retry on the job |
| Job failed `detector_unavailable` | Weights missing or GPU unavailable | Check `MODEL_PATH`, `DEVICE`; retry |
| Upload 503 `storage_unavailable` | Storage folder missing or full | Free space or remount; retry the upload (same file) |
| Everyone signed out / cannot sign in | Supabase project paused or keys rotated | Restore the project in the Supabase dashboard; check `SUPABASE_URL` |
| 429 `too_many_jobs` | Organisation hit `ORG_MAX_ACTIVE_JOBS` | Wait, or raise the limit |

## 6. Security duties

- Rotate `SUPABASE_SECRET_KEY` and the database password when someone with access leaves, and after any leak.
- Never commit `.env`; `scripts/check.sh` looks for committed Supabase secret keys.
- The API should only be reachable through a TLS reverse proxy that also limits request bodies.
- Model weights: the YOLO weights are AGPL-3.0 (see `docs/LICENCE_INVENTORY.md`); a licence decision is needed before
  a commercial or closed-source delivery (F46).

## 7. Ownership (to be filled in at handover, F51)

| Role | Person | Contact |
|---|---|---|
| Product decision-maker (client) | | |
| Operator (runs servers, backups) | | |
| Support (answers users) | | |
| Developer (backend) | Adrishikhar Barua | |
