# Johnson Road — Scope

Version: 0.4 · Date: 2026-11-07 · Status: **approved by the user, 2026-11-07** (open items in section 10 stay open until answered; their defaults are used meanwhile) · 0.2 adds section 8a (five known defects with root cause and planned fix) · 0.3 corrects errors found by an independent recheck and adds section 8b · 0.4 adds the Supabase table definitions found in `frontend/supabase/migrations/` (section 8b, F9 to F14) and removes every claim that they are not visible

How to read this file. Every statement is tagged:

- **As built**: checked in the code. File and line given. Not run, only read.
- **Target**: a plan or decision from `blueprint.md`. Not built yet.
- **Open**: the user has not decided. Listed in section 10 with a default.

Source of truth for intent: `blueprint.md`, `AI_RULES.md`, `ARCHITECTURE.md`, `ROADMAP.md`. This file does not change them. It records where the code stands against them.

---

## 1. Product

Johnson Road turns road video into traffic counts. A user uploads a road video, marks where to count, and the system finds vehicles, follows them, counts them, and produces a report. (Target, `blueprint.md` §1.)

- Users: traffic analysts, road project managers, municipal decision-makers, and an organisation administrator (`blueprint.md` §3).
- Parts: React web app, FastAPI backend, a Python computer-vision pipeline (YOLO detector, tracker, counter). (Target)
- Local development database: PostgreSQL (decision O72, section 9; today the code still points at a SQLite file, `database.py:4`). Production database and file storage not yet chosen (see section 10). A Postgres schema for Supabase already exists in the repo (section 8b, F9); whether it or a backend database is the record is open item O48 in `REQUIREMENTS.md`.
- Pipeline in one line: upload, create job, detect, track, count, report. (Target)

**As built, in one paragraph.** The web app has all screens, but every data service returns hard-coded sample data. The backend serves sample data too. One real thing exists: uploading a file saves it to disk and starts a background job that calls the YOLO detector. The result is not trustworthy yet (section 8).

---

## 2. Business and product rules

| # | Rule | Status | Evidence / note |
|---|---|---|---|
| R1 | A "count" is the number of distinct vehicles that cross a configured counting line, by class, direction and time interval | Target | `blueprint.md` §6 "Computer vision and analytics" |
| R1a | Current count is the number of detections returned by the tracker, with no line crossing | As built | `ai/counter.py:6` returns `len(tracks)`; `ai/trackers/bytetrack_tracker.py:13-27` makes one track per detection |
| R2 | Counts are presented as estimates with confidence and method | Target | `blueprint.md` §11 |
| R3 | Supported uploads: video files with checks on type (by content), size and duration | Target | `blueprint.md` §6 Uploads, §11 |
| R3a | Current upload accepts any file, any name, no checks. File name is used in the saved path | As built | `services/upload_service.py:28-38` |
| R3b | Browser file picker filters to `video/*` only | As built | `UploadPage.tsx:194` |
| R3c | Size and length limits exist as settings but nothing reads them | As built | `ai/settings.py:14-15`; no other file references them (searched) |
| R4 | Job words: queued, running, completed, failed, cancelled | Target | `blueprint.md` §6 Processing |
| R4a | Backend creates jobs as `queued`, then sets `processing`, then `completed` or `failed`. Sample data uses both `running` and `processing` | As built | `upload_service.py:50,81,95,127`; `mock_data.py:54` (`running`), `mock_data.py:48` (`processing`) |
| R4b | Frontend type allows `running`, `queued`, `completed`, `processing`, `failed`, `cancelled`. Both "running" and "processing" are accepted. Job queue page filters on `cancelled` | As built | `types/processing.ts:1`; `JobQueuePage.tsx:26` |
| R4c | Unknown job id returns HTTP 200 with status `not_found` (not an error code) | As built | `routers/processing.py:20-28` |
| R5 | A job is never silently marked completed. Failures keep a safe message and a diagnostic id | Target | `blueprint.md` §8 failure workflow |
| R5a | Failure sets status `failed`, progress 0, logs the raw exception text | As built | `upload_service.py:126-135` |
| R6 | Every result links to its upload, configuration version, model version and job id | Target | `blueprint.md` §7 data model |
| R7 | Users see only their own organisation's projects, uploads, jobs, reports | Target | `blueprint.md` §11. The backend checks nothing (no auth on any route; `main.py:22-26`). The Supabase tables are scoped to the organisation by their security rules (F9), but the app cannot use them with the fake login |
| R8 | Same input and same configuration give a repeatable result | Target | `blueprint.md` §2 |
| R9 | No face, plate or identity recognition without separate review | Target | `blueprint.md` §5, §11 |
| R10 | Frontend rules: no redesign, Tailwind stays, TypeScript, pages call services (never fetch directly), components under 250 lines, do not break routes | Target (project rule) | `AI_RULES.md` |

---

## 3. Features

Status key: **Screen only** = UI exists, no backend call. **Mock backend** = backend route returns sample data, frontend does not call it. **Real** = this one part runs for real, read by code (not run); it does not mean the whole feature works end to end. **Calls Supabase (unverified)** = the code calls Supabase. The table definitions and security rules are in `frontend/supabase/migrations/` (section 8b), but nothing shows that a Supabase project with them is running, so whether it works is unknown. **Not started** = nothing found.

No feature works end to end today. Nothing in the frontend calls the backend: `services/api.ts` creates an axios client, and only `auth.service.ts:23` mentions it (`void api;`). `AuthService` itself is never imported anywhere, so `api.ts` is loaded by nothing. Verified by searching `frontend/src` for `fetch(`, `axios` and `services/api`.

### 3.1 Upload

| ID | Feature | Status | Evidence |
|---|---|---|---|
| UP-1 | Pick or drop video files, list them | Screen only | `UploadPage.tsx:70-85` keeps files in local state; progress is set to 0 and never changes |
| UP-2 | Send file to server | Not started (frontend) | No HTTP call in `upload.service.ts` |
| UP-2b | Server saves file and starts a job | Real (partly) | `routers/uploads.py:20-33`; saved to `uploads/`, folder git-ignored (`.gitignore:13`) |
| UP-3 | Validate type, size, duration; show reason | Not started | `upload_service.py:28-38` has none |
| UP-4 | Upload progress and retry | Not started | |
| UP-5 | Store metadata (size, duration, resolution, fps, checksum) | Not started | Backend returns sample file list: `upload_service.py:21-25` |
| UP-6 | Location suggestions | Mock backend | `GET /api/uploads`, `GET /api/projects/location-suggestions` |

### 3.2 Analysis setup

| ID | Feature | Status | Evidence |
|---|---|---|---|
| AN-1 | Draw detection zone | Screen only | `DetectionZoneCanvas.tsx:17` keeps points in local state; props are only width and height (`:10-13`), nothing is saved or sent |
| AN-2 | Draw counting lines | Screen only | `CountLineCanvas.tsx:24` same pattern |
| AN-3 | Choose detector, tracker, thresholds, classes | Not started (UI) | Server reads these from environment only (section 6) |
| AN-4 | Save a versioned configuration with each job | Not started | |

### 3.3 Processing

| ID | Feature | Status | Evidence |
|---|---|---|---|
| PR-1 | Create queued job from upload | Mock backend | Job is a Python dict in memory, lost on restart: `processing_repository.py:6-10,35-38` |
| PR-2 | Run detector on the video | Real (partly) | `ai/detectors/yolo_detector.py:114-117` passes the whole video path to YOLO. Probable runtime error, see GAP-5 |
| PR-3 | Track objects across frames | Mock | One track per detection: `bytetrack_tracker.py:13-27` |
| PR-4 | Count line crossings | Not started | `counter.py:6`; `ai/analytics.py` every function raises `NotImplementedError` |
| PR-5 | Progress, frames, ETA | Mock | Progress is set to fixed values 0, 35, 100 (`upload_service.py:70,81,96`); frames processed is a fixed 6 (`ai/frame_reader.py:8`); fps is hard-coded 24 (`upload_service.py:99`) |
| PR-6 | Job queue page | Screen only | `processing.service.ts` returns arrays from `lib/mockData` |
| PR-7 | Processing page, logs, timeline, segments | Screen only (frontend); Mock backend (`GET /api/processing`) | |
| PR-8 | Cancel a job | Not started (backend). Screen shows a cancelled filter only | `JobQueuePage.tsx:26` |
| PR-9 | Retry transient failures | Not started | |
| PR-10 | Annotated frames / output video | Not started | |
| PR-11 | Health of AI runtime | Real | `GET /health` reports detector, device, model path: `main.py:44-55` |

### 3.4 Results and reports

| ID | Feature | Status | Evidence |
|---|---|---|---|
| RP-1 | Reports list and charts | Screen only; Mock backend (`GET /api/reports`) | `report.service.ts:1` reads `lib/mockData` |
| RP-2 | Create report from a completed analysis | Not started | |
| RP-3 | Export CSV / PDF / Excel | Screen only | `ReportsPage.tsx:53-55` only flips a "Downloaded" label for 2.5 s; no file is produced. Share (`:58-61`) is also fake. Print (`:63-65`) calls `window.print()` and does work |
| RP-4 | Filter by project, period, class, direction, zone | Not started | |
| RP-5 | Report with methodology, config, evidence, timestamp | Not started | |

### 3.5 Projects

| ID | Feature | Status | Evidence |
|---|---|---|---|
| PJ-1 | List projects, project detail, videos, reports | Screen only; Mock backend | `routers/projects.py:14-37` serves `mock_data.PROJECTS` |
| PJ-2 | Create, rename, archive project | Not started | Only GET routes exist in the registered router. A second router `api/projects.py` has POST and GET but is not registered (`main.py:6,22-26`) and imports names that do not exist (`ProjectCreate`, `ProjectResponse`, `create_project`; `schemas/project.py` and `services/project_service.py` do not define them) |
| PJ-3 | Store projects in a database | Not started | `database/models.py` defines a `Project` table, but no code creates tables (searched `create_all`: none) and no code reads it. `database.py:4` hard-codes the SQLite path |
| PJ-4 | Search and filter projects | Screen only | Not checked in detail |
| PJ-5 | Audit history | Not started | |

### 3.6 Dashboard

| ID | Feature | Status | Evidence |
|---|---|---|---|
| DB-1 | KPI cards, volume, class split, trend, insights, activity | Screen only; Mock backend (`GET /api/dashboard`) | `dashboard.service.ts:13` reads `lib/mockData` |
| DB-2 | KPIs computed from real jobs and reports | Not started | |
| DB-3 | Empty, stale and error states | Not checked | Not verified; left as unknown |

### 3.7 Auth and organisation

| ID | Feature | Status | Evidence |
|---|---|---|---|
| AU-1 | Login | Screen only (fake) | `auth.tsx:63-64,100-111` (this is the login the app uses: `LoginPage.tsx:10,26` calls `useAuth().login`; `auth.service.ts:23-25` holds a second copy that nothing imports): any non-empty email and password sets `localStorage["jr-auth"]="true"` and loads a hard-coded user, profile and organisation (`auth.tsx:73-91`) |
| AU-2 | Register | Calls Supabase (unverified) | `RegisterPage.tsx:32` calls `supabase.auth.signUp`. Result not tested. The tables and security rules are in `frontend/supabase/migrations/` (section 8b); nothing shows that a Supabase project with them is running |
| AU-3 | Forgot password | Calls Supabase (unverified) | `ForgotPasswordPage.tsx:19` |
| AU-4 | Verify email | Screen only | `VerifyEmailPage.tsx` reads `useAuth()` (fake user). Not checked further |
| AU-5 | Onboarding (create organisation) | Calls Supabase (unverified) | `pages/auth/OnboardingPage.tsx:36-66` writes organisations, members, profiles. Never shown, because `needsOnboarding` is always false (`auth.tsx:131`). By reading the security rules it would probably fail at its first or second write (section 8b, F11) |
| AU-6 | Protected routes | Real (but guards the fake login) | `App.tsx:39-47` |
| AU-7 | Profile edit, change password | Calls Supabase (unverified) | `MyProfilePage.tsx:64,86`. Uses `user?.id` from the fake login (`"1"`), so it targets a user that does not exist in Supabase. `profiles.id` is a uuid and `"1"` is not a valid uuid, so the query should fail (F10) |
| AU-8 | Organisation name, member list, invite | Calls Supabase (unverified) | `OrganizationPage.tsx:53,76,101`. Same fake-id caveat: `"org-1"` is not a valid uuid either (F10) |
| AU-9 | Roles and permission checks | Not started in the app and the backend | Role types only in the app (`lib/supabase.ts:15`). The Supabase security rules do check owner and admin for members, API keys and project delete (`add_all_rls_policies.sql:49-312`), but the app cannot use them with the fake login (F9, F12) |
| AU-10 | Backend verifies the user | Not started | No auth on any backend route |
| AU-11 | Billing, API keys, notifications, support | Screen only | `BillingPage.tsx:15`, `NotificationPanel.tsx:5`, `SupportPage.tsx:14` read `lib/mockData`. Billing placeholders are in scope per `blueprint.md` §5 |

---

## 4. Job lifecycle (Target)

States: `queued`, `running`, `completed`, `failed`, `cancelled`. (`blueprint.md` §6 Processing)

| From | To | When |
|---|---|---|
| (new) | `queued` | Upload accepted and configuration saved |
| `queued` | `running` | Worker picks the job up |
| `queued` | `cancelled` | User cancels before start |
| `running` | `completed` | Pipeline finished, results stored |
| `running` | `failed` | Error. Safe message and diagnostic id stored |
| `running` | `cancelled` | User cancels, only if the worker can stop safely |
| `failed` | `queued` | Retry, only when the failure is marked retryable. It starts a new attempt; the failed attempt is kept (DATA_MODEL.md, O57) |

Not allowed: `completed` to anything else; `cancelled` to anything else. A failed or cancelled attempt is kept for audit. Rerun creates a new job. These transition rules are **Target** derived from the blueprint text; the blueprint does not list the moves, so the exact table needs approval (section 10, O9).

**Current mismatch (As built).** Backend uses `processing` where the blueprint says `running` (`upload_service.py:81`). Sample data mixes both (`mock_data.py:48,54`). The frontend type allows both (`types/processing.ts:1`). Decision needed: pick `running`, drop `processing` everywhere.

---

## 5. Processing pipeline (as built, step by step)

| Step | What the code does | Real or placeholder |
|---|---|---|
| Upload | Saves bytes to `uploads/<12 hex>_<client file name>` | Real. No validation. Reads the whole file into memory (`upload_service.py:32`) |
| Job | Adds a dict to an in-memory list. Stays only while the server runs | Placeholder |
| Background task | FastAPI `BackgroundTasks` runs the job inside the web process: `routers/uploads.py:28`, `upload_service.py:152-153`. No queue, no worker | Placeholder |
| Video load | Checks the file exists | Real (`video_loader.py:5-9`) |
| Frame read | Returns a fixed batch with `frame_count = 6` | Placeholder (`frame_reader.py:8,12-13`) |
| Detect | YOLO `predict` over the whole video path, `imgsz=640` | Real call, unverified output (`yolo_detector.py:78-88,114-117`) |
| Track | One new track per detection. Tracker name changes only the class, not the behaviour | Placeholder (`bytetrack_tracker.py:13-27`); SORT and BoT-SORT not read in detail |
| Count | Number of tracks | Placeholder (`counter.py:6`) |
| Result | Not stored. The count appears only in an in-memory job log message (`upload_service.py:109`). The structured log call (`:112-125`) records frames processed but not the count | Placeholder |
| Zones and lines | Never reach the backend | Not started |

---

## 6. Settings

### 6.1 As built

| Setting | Env name | Default | Read where | Used? |
|---|---|---|---|---|
| Detector type | `MODEL` | `yolo8` | `ai/settings.py:6` | Yes (`runtime.py:64`); values starting `yolo` load YOLO, anything else loads the stub that returns no detections (`runtime.py:75`) |
| Tracker | `TRACKER` | `bytetrack` | `settings.py:7` | Yes (`trackers/factory.py:10`) |
| Model file | `MODEL_PATH` | `yolov8n.pt` | `settings.py:8` | Yes (`runtime.py:78`) |
| Device | `DEVICE` | `cpu` | `settings.py:9` | Yes |
| Confidence | `CONFIDENCE_THRESHOLD` | 0.25 | `settings.py:10` | Yes (`yolo_detector.py:82`) |
| IoU | `IOU_THRESHOLD` | 0.45 | `settings.py:11` | Yes |
| Frame skip | `FRAME_SKIP` | 1 | `settings.py:12` | Stored in detector, not used when predicting (`yolo_detector.py:44`) |
| Batch size | `BATCH_SIZE` | 1 | `settings.py:13` | Yes (`yolo_detector.py:87`) |
| Max video length | `MAX_VIDEO_LENGTH` | 24 (unit not stated) | `settings.py:14` | No |
| Max video size | `MAX_VIDEO_SIZE` | 20,000,000,000 | `settings.py:15` | No |
| Timing / logging / warmup | `ENABLE_TIMING`, `ENABLE_LOGGING`, `ENABLE_WARMUP` | true | `settings.py:16-18` | Yes (`runtime.py:58,114,130`) |
| App name, API prefix, CORS | none (fixed in code) | `Johnson Road API`, `/api`, ports 3000, 4173, 5173 on localhost | `core/config.py:5-12` | Yes. `APP_NAME` and `API_PREFIX` appear in the root `.env` but the code does not read them |
| `model` in core config | none | `stub` | `core/config.py:7` | No (searched, no reader) |
| Database URL | none (fixed in code) | `sqlite:///./johnson_road.db` | `database/database.py:4` | Not used by any route |
| Frontend API URL | `VITE_API_URL` | none | `services/api.ts:4` | Client not used |
| Supabase URL and key | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | none | `lib/supabase.ts:3-4` | Yes |

Env file facts (As built). A `.env` exists at the repo root with the variable names above plus `BACKEND_HOST/PORT`, `FRONTEND_HOST/PORT` (names only checked; values not read). It is git-ignored (`.gitignore:28-29`). No `.env.example` exists. No file in `backend` loads `.env` (searched `dotenv`: none), so backend variables only take effect if set in the shell. Vite reads `.env` from `frontend/`, and none exists there (not set `envDir` in `vite.config.ts`). So `VITE_*` values are probably empty unless set another way; not verified at runtime.

### 6.2 Required by the blueprint (Target)

| Setting | Note |
|---|---|
| Tracker choice per job (ByteTrack, BoT-SORT, SORT) | `blueprint.md` §6 |
| Confidence and IoU per job | Per-job, saved with the job |
| Frame sampling, batch size, maximum duration | Per-job and server cap |
| Counting lines, detection zones, classes of interest | Saved as a versioned configuration |
| Upload limits: size, duration, allowed types | Enforced by the API |
| Processing timeout | `blueprint.md` §7 |
| Database and storage provider | Open (O2, O3) |
| Queue / worker | Open (O4) |
| Retention period for source and generated media | `blueprint.md` §8 step 15. Value not decided |
| Logging, metrics | `blueprint.md` §12. Tracing: Sprint 6 in §9 |
| `.env.example` without secrets | `blueprint.md` §14 item 1 |

---

## 7. Not included in this version

The first six rows are from `blueprint.md` §5 "Out of scope for the first production release". The last two come from elsewhere: image and batch upload from §6 Uploads, and payments from the §5 in-scope item "billing placeholders":

| Item | Status |
|---|---|
| Real-time camera streaming | Out |
| Automatic enforcement or legally binding decisions | Out |
| Face, licence-plate or identity recognition | Out |
| Autonomous traffic-control actions | Out |
| Multi-region distributed processing | Out until usage needs it |
| Custom model training inside the product | Out |
| Image and batch-upload workflows | Later. UI must not be tied to one storage provider (`blueprint.md` §6 Uploads) |
| Payments and invoices | Placeholders only (`blueprint.md` §5 "billing placeholders") |

---

## 8. Gap list: blueprint vs code

| ID | Blueprint item | What exists | Gap |
|---|---|---|---|
| GAP-1 | Sprint 0: env handling, `.env.example`, run instructions, baseline checks (`blueprint.md` §9, §14) | Root `.env` (ignored); no example file; no tests; no CI; backend does not load `.env` | Add example file, loader, run commands, first tests |
| GAP-2 | Sprint 1: real login, verification, recovery, protected routes, onboarding, roles | Fake login; Supabase for register, reset, onboarding; `needsOnboarding` hard-coded false (`auth.tsx:131`); no roles in the app or backend (the Supabase rules check owner and admin, F9) | Decide auth provider (O1), then build |
| GAP-3 | Sprint 2: project CRUD | Read-only mock routes; unregistered, broken second router; unused table model | Pick one project router; create tables; real create |
| GAP-4 | Sprint 2: upload validation, progress, metadata, storage abstraction | Raw save to local folder, no checks | Validation, storage layer, progress |
| GAP-5 | Sprint 2: connect frontend to backend | Zero calls. `api.ts` unused. `YOLODetector` builds `Detection` without required `class_id` (`yolo_detector.py:103-109` vs `interfaces.py:5-10`); when YOLO finds an object this raises `TypeError` and the job is marked `failed` (found by reading; not run) | Fix and test with a real video |
| GAP-6 | Sprint 3: job schema and lifecycle | In-memory dicts; two status words; response schema mismatch (GAP-7) | Table for jobs; one status list |
| GAP-7 | Sprint 3: processing page | `GET /api/processing` requires `currentFrame` and `vehicleCount` on every job (`schemas/processing.py:31-32`). A job made by upload copies a dict without those keys (`upload_service.py:43-59`, `processing_repository.py:37`), so response validation fails after the first upload (by reading; not run) | Add the fields or change the schema |
| GAP-8 | Sprint 3: queue and worker | FastAPI background task, same process | Decision O4 |
| GAP-9 | Sprint 3: detector and tracker configuration, saved progress, structured failures | Environment only; failure stored as text in a log list | Per-job config; error codes |
| GAP-10 | Sprint 3: cancellation | None | Needs worker with a stop signal |
| GAP-11 | Sprint 4: lines, zones, crossing counts, class and time aggregates | Counter returns track count; analytics functions are empty; zones and lines are not sent | Largest piece of work |
| GAP-12 | Blueprint §6 Computer vision (needed for Sprint 4): tracking with stable ids | Tracker is a placeholder | Real tracker |
| GAP-13 | Blueprint §6 Computer vision (needed for Sprint 4): frame reading | Fixed 6 frames (`frame_reader.py:8`); `FRAME_SKIP` unused | Real frame reader |
| GAP-14 | Sprint 4: annotated evidence, model and config versions | None | |
| GAP-15 | Sprint 5: real dashboard and reports, CSV/PDF | Sample data; fake download button | |
| GAP-16 | Sprint 6: authorisation, rate limits, file safety, audit | None. File name goes into the saved path unchecked (`upload_service.py:30`) | Needs review before any public use |
| GAP-17 | Sprint 7: production database, storage, CI, images | SQLite path in code; local folder; no CI or Dockerfile found | After O2, O3, O5 |
| GAP-18 | Dependencies | `requirements.txt` has no `ultralytics` or `torch`, yet `yolo_detector.py:9-10` imports them. App import chain: `main.py:4` imports `runtime.py:7`, which imports `yolo_detector.py` | A fresh install from that file would fail at startup (inferred from imports; not run) |
| GAP-19 | Tests (`blueprint.md` §10) | None found outside `.venv` and `node_modules` | |

Also found, not in the blueprint: frontend `src/data/` (5 files) is not imported anywhere (searched `@/data`, `/data/` imports: no match), so it is unused. `frontend_backup` ignored as instructed.

---

## 8a. Known defects and planned fixes

Five defects found by reading the code. Nothing was run, and **no code has been changed**: this section only records them. Each entry has the root cause (re-checked by reading the files named), the planned fix (**Target**) and when it should happen. The fixes need approval (open item O13) before anyone touches code.

| ID | Defect | Root cause (As built) | Planned fix (Target) | When |
|---|---|---|---|---|
| D1 | The first real detection crashes the job | `Detection` requires `class_id` (`ai/interfaces.py:5-10`). `YOLODetector._postprocess` builds it with only `frame_index`, `label`, `confidence`, `bbox` (`ai/detectors/yolo_detector.py:103-109`), although it already reads the class number (`cls_index`, line 99). Python raises `TypeError` when the object is made. `AIPipeline.run` catches every error and re-raises `PipelineError` (`ai/pipeline.py:72-73`), so `advance_job` marks the job `failed`. The stub detector returns an empty list (`stub_detector.py:8`), so this never shows while `MODEL` is not a `yolo*` value | Pass `class_id=cls_index` when building the detection. Add one test with a fake YOLO result that has one box | Before any real-video test. First fix |
| D2 | A clean install cannot start | `requirements.txt` has no `ultralytics` and no `torch`. `main.py:4` imports `ai/runtime.py`, which imports `yolo_detector.py` (`runtime.py:7`), which imports both at load (`yolo_detector.py:9-10`). The import fails at startup, before any request | Add `ultralytics` and `torch` to `requirements.txt` with pinned versions that work with the project's Python (the existing `.venv` is Python 3.9). Choice of versions and CPU or GPU build is an open decision (O14). Record how to install | Before any real-video test. Second fix |
| D3 | Upload limits are not enforced | `MAX_VIDEO_SIZE` and `MAX_VIDEO_LENGTH` are defined (`ai/settings.py:14-15`) and no other file reads them (searched). `FRAME_SKIP` is passed to the detector and stored (`yolo_detector.py:44`) but never used when predicting. `upload_service.py:32` reads the whole file into memory with no size check. The 20 GB default is unrealistic for that code | Check size while writing the file and refuse with a clear message; check duration and type by content after saving, and delete the file if refused; apply `FRAME_SKIP` in the frame reader. Values and the unit of `MAX_VIDEO_LENGTH` are open (O8) | Sprint 2 (upload validation, `blueprint.md` §6) |
| D4 | Client file name goes into the saved path | `upload_service.py:30` builds `UPLOAD_DIR / f"{upload_id}_{file.filename}"`. `filename` comes from the browser. A name containing path separators changes where the file is written (by reading; not run). The name is also copied into the job's `projectName` (`upload_service.py:45`) | Never use the client's name for the path. Save as `<id>.<extension>` with the extension taken from an allowed list. Keep the original name only as display text, shortened and cleaned | Sprint 2. Treat as a security fix: do it before the upload route is reachable by anyone else |
| D5 | Profile and Organization screens use a user that does not exist in Supabase | `AuthProvider.loadUser` sets a fixed user id `"1"`, a fixed profile and organisation id `"org-1"` (`lib/auth.tsx:73-91`). `MyProfilePage.tsx:64` runs `supabase.from('profiles').update(...).eq('id', user?.id)` and `OrganizationPage.tsx:53-57,76-83,101` read and write by `organization.id`. The ids `"1"` and `"org-1"` are not valid uuids, and the columns they are compared with are uuids (`frontend/supabase/migrations/20260729043122_create_all_tables.sql`: `profiles.id`, `organizations.id`), so these queries should fail with an invalid-id error (by reading; not run; section 8b F10). The member invite insert fails the same way. The save on the profile page ignores the result and shows "Saved" anyway (`MyProfilePage.tsx:64-68`). The password form never uses the "current password" field and calls `supabase.auth.updateUser` (`:86`) with no real Supabase session, so it should fail with an error | Only fixable together with real login (GAP-2): sign in through Supabase, load the real user, profile and organisation from it, show an error when a save fails. Until then these two screens must be treated as sample screens | Sprint 1 (auth). Depends on O1 |

Order inside the fixes: D1 and D2 first (nothing real can run without them), then D4 and D3 with the upload work, then D5 with auth.

---

## 8b. Other facts found by the independent recheck (As built, read not run)

| ID | Fact | Evidence | Why it matters |
|---|---|---|---|
| F1 | The Supabase client is created as soon as the file loads. With `VITE_SUPABASE_URL` empty or missing, the library likely throws and the whole app may fail to show. No `frontend/.env` exists. Unverified: not run | `frontend/src/lib/supabase.ts:6` | The app may not even open on a fresh machine until env values are set |
| F2 | The YOLO weight files are in `backend/` (`yolov8n.pt`, `yolo11n.pt`). The fallback in `runtime.py` looks in the repository root, where no weights exist. The default `MODEL_PATH=yolov8n.pt` only works if the server is started from `backend/`. The upload folder and the SQLite file are also relative to the folder the server starts from | `ai/runtime.py:89`, `ai/detectors/yolo_detector.py:68`, `services/upload_service.py:12`, `database/database.py:4` | Starting the server from another folder breaks model loading and puts data in a different place |
| F3 | The pipeline object is created when `app.ai` is first imported, and that loads the detector, before the startup step runs. The default `MODEL=yolo8` means YOLO is the default, not the stub | `ai/pipeline.py:76`, `ai/settings.py:6` | Startup needs `ultralytics` and `torch` (defect D2) and the weights (F2) |
| F4 | The pipeline result always reports 6 frames processed. YOLO is asked to predict over the whole video in one call and collects every result in memory | `ai/pipeline.py:67`, `ai/frame_reader.py:8`, `ai/detectors/yolo_detector.py:84` | Reported frames and memory use are wrong for any real video |
| F5 | The upload screen says "max 12GB each" while the server default limit is 20 GB (and is not enforced). Only the file picker limits file type (`accept="video/*"`); drag and drop does not. The "Anonymize plates" switch changes nothing | `UploadPage.tsx:199`, `ai/settings.py:15`, `UploadPage.tsx:188,194,65` | The screen promises limits the system does not apply (links to D3 and O8) |
| F6 | The Python environment in `backend/.venv` was made on a Mac (`pyvenv.cfg` points to `/Library/Developer/...`) and cannot run on this Windows machine as it is | `backend/.venv/pyvenv.cfg` | A new environment must be built here (links to D2 and O14) |
| F7 | `.gitignore` line 29 pattern `.env.*` also ignores `.env.example`, which the blueprint says to add and track | `.gitignore:29`, `blueprint.md` §14 item 1 | The example file needs an exception rule or it will never be committed |
| F8 | Upload jobs keep the saved file path (`sourcePath`). The processing response schema does not list it, so it is not sent to the browser | `upload_service.py:43-59`, `schemas/processing.py` | Checked and fine; recorded so nobody adds it to the schema by mistake |
| F9 | The Supabase table definitions are in the repo: 11 tables (`organizations`, `profiles`, `organization_members`, `projects`, `videos`, `reports`, `processing_jobs`, `notifications`, `api_keys`, `invoices`, `user_sessions`), row-level security on all of them, and a trigger that creates a profile at sign-up. Earlier versions of this file said they were not visible; that was wrong, the search had missed this folder | `frontend/supabase/migrations/20260729043122_create_all_tables.sql`, `20260729043159_add_all_rls_policies.sql` | A second data store already models projects, videos, reports and jobs, scoped to an organisation. Where the record lives is open item O48 in `REQUIREMENTS.md`. Nothing shows a Supabase project with these tables is running |
| F10 | `profiles.id`, `organizations.id` and related ids are `uuid`. The fake ids `"1"` and `"org-1"` from `auth.tsx:73-91` are not valid uuids, so the profile and organisation calls should fail with an invalid-id error. `MyProfilePage.tsx:64-68` ignores the result and shows "Saved" anyway | `create_all_tables.sql:32-33,22-23`; `MyProfilePage.tsx:64-68`; `OrganizationPage.tsx:101` | Explains D5 more exactly (by reading; not run) |
| F11 | Onboarding probably cannot finish under these security rules. Step 1 inserts an organisation and reads it back (`OnboardingPage.tsx:36-40`), but the read rule needs the person to already be a member (`add_all_rls_policies.sql:9-13`). Step 2 adds the first member (`OnboardingPage.tsx:48-55`), but the insert rule needs the person to already be an active owner or admin of that organisation (`add_all_rls_policies.sql:49-59`). By reading; not run; extra rules in a live Supabase project would change this | as listed | Onboarding needs a rework (one database function, or a different order) before real login is useful (D5, GAP-2) |
| F12 | A user may edit their own profile row, including `role` and `organization_id` (`update_own_profile`), but no security rule reads those two columns (every rule checks `organization_members`), so this changes what the app shows, not what the database allows. The real escalation: an admin may add a member with any role, and may change any member's role, including their own, to `owner`, because neither rule checks who the member is or limits the role (`insert_org_member_admin`, `update_org_member_admin`) | `add_all_rls_policies.sql:32-34,49-79` | An admin can make themselves or anyone else an owner. Needs a fix before any real use (blueprint §11) |
| F13 | Supabase `processing_jobs.status` allows `running`, `queued`, `completed`, `failed`, `cancelled`, not `processing`. It has no project name, source path, configuration, frame counts or error code. `projects.status` has no `cancelled` | `create_all_tables.sql:97-110,59` | `processing_jobs` uses `running`, which supports the O7 default. But `projects.status` and `videos.status` use `processing` (`create_all_tables.sql:59,84`), as does the frontend `ProjectStatus`, so the word set differs by table. A job table for the real pipeline needs more columns |
| F14 | `frontend/src/lib/supabase.ts:19-146` already defines row types in database naming (`ProjectRow`, `JobRow`, `ReportRow`...), while `frontend/src/types/*` and the mock data use the app naming (`Project`, `ProcessingJob`...). The same thing has two shapes. Not compared field by field | as listed | Wiring needs one agreed shape (links to O48 and requirement 1.23) |

---

## 9. Dated decisions

| Date | Decision | Item | How it was given |
|---|---|---|---|
| 2026-11-07 | **B**: the backend's own PostgreSQL is the record for projects, jobs and reports. Supabase is used for sign-in only. Profiles, organisations and members move to the backend database (local development database: see the O72 decision in the next row) | O48, O12 follows it | The user answered "do as recommended" after being told B was my default and the one the blueprint describes. Other open items stay open and keep their defaults |
| 2026-11-07 | Four defaults accepted: **O72** PostgreSQL is also used for local development, SQLite is not used for the new schema (it needs Postgres-only features); **O57** a retry is a new attempt of the same job and the failed attempt is kept in `job_attempts`; **O66** line direction as defined in DATA_MODEL.md O66 (`forward` = crossing from the left of the arrow from point 1 to point 2 toward its right); **O42** a job needs at least one counting line or one detection zone | O72, O57, O66, O42 (open items in DATA_MODEL.md and REQUIREMENTS.md) | The user said "yes use the defaults". Every other open item stays open with its default |

---

## 10. Open items

Owner for all: the user. "Default" is what the plan assumes if no answer comes.

| ID | Question | Default |
|---|---|---|
| O1 | Auth provider: Supabase or own FastAPI JWT | Supabase, because registration, reset and onboarding already call it. Backend would verify Supabase tokens |
| O2 | Production database | PostgreSQL (blueprint says "managed relational database"); PostgreSQL also for local development (decision O72, section 9), SQLite is not used for the new schema |
| O3 | Production file storage | S3-compatible object storage; local folder for development, behind a storage interface |
| O4 | Queue / worker | Keep FastAPI background task until Sprint 3; then a separate worker process with a jobs table. No product named yet |
| O5 | Hosting | Not chosen. No default. Needed before Sprint 7 only |
| O6 | First sprint to document in detail | Sprint 2: connect frontend to backend. `docs/sprints/SPRINT-03.md` is empty |
| O7 | Job status word: `running` or `processing` | `running` (blueprint wording) |
| O8 | Upload limits: allowed types, maximum size, maximum duration, and unit of `MAX_VIDEO_LENGTH` | Not decided. `MAX_VIDEO_SIZE` default is 20 GB, which is large; suggest asking before accepting it |
| O9 | Exact allowed job moves (section 4) | The table in section 4 |
| O10 | Retention: how long to keep source and result media | Not decided. No default; needed before Sprint 6 |
| O11 | Register page: verify email before first login? | Yes, per blueprint §6 |
| O12 | Keep profiles, organisations and members (Supabase tables, F9) as the user store, or copy them to the backend database. This follows O48 in `REQUIREMENTS.md` (where projects, jobs and reports live) | Follows O48: under B they move to the backend database and Supabase keeps sign-in only; under A they stay in Supabase |
| O13 | Approve the planned fixes in section 8a and their order (D1, D2, then D4, D3, then D5) | Approve as written. No code is changed until approved |
| O14 | Versions for `ultralytics` and `torch`, and CPU-only or GPU build | CPU-only, because `DEVICE` defaults to `cpu`. Exact versions to be tested on the project's Python |

---

## 11. How this relates to existing files

- `ROADMAP.md` marks **Authentication** and **Login** as done. The code shows otherwise.
  - Login accepts any non-empty email and password and sets `localStorage["jr-auth"]` (`auth.tsx:100-111`; a second copy that nothing imports is in `auth.service.ts:23-25`).
  - The signed-in user, profile and organisation are fixed values (`auth.tsx:73-91`).
  - `needsOnboarding` is always false (`auth.tsx:131`), so onboarding never shows.
  - Backend routes check nobody (`main.py:22-26`).
  - Supabase register and reset do run through real calls (`RegisterPage.tsx:32`, `ForgotPasswordPage.tsx:19`), but their result is not connected to the session that the rest of the app uses.
  - Reading of ROADMAP: "Dashboard UI" done is accurate (screens exist); "Dashboard Services" not done is accurate.
- `ARCHITECTURE.md` lists a `Hooks` layer between components and services. No `hooks/` folder exists in `frontend/src`. Not a defect, a plan.
- `blueprint.md` §7 says the frontend has a `data/` folder "used by the current UI". It is not used (searched).
- `blueprint.md` §14 item 2 says backend settings should load env vars consistently. Today only the AI settings do.
- `AI_RULES.md` "Never fetch directly inside pages": pages call Supabase directly: five files, ten calls (`MyProfilePage.tsx:64,86`, `OrganizationPage.tsx:53,76,101`, `OnboardingPage.tsx:36,48,63`, `RegisterPage.tsx:32`, `ForgotPasswordPage.tsx:19`). Flagged once; not changed.
- `docs/sprints/SPRINT-03.md` is empty.
