<!-- Adrishikhar - 7 November 2026, 17:32 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: reconcile database decisions, counting contracts and flow rules. Documentation only; runtime pending. -->
# Johnson Road — Requirements

Version: 0.3 · Date: 2026-11-07 · Status: **draft, awaiting approval**

0.2 corrects errors found by an independent recheck. 0.3 adds the Supabase table definitions found in `frontend/supabase/migrations/` (SCOPE section 8b, F9 to F14), requirements 1.34 and 1.35, and open item O48.

This file says what the system must do, deliverable by deliverable. It builds on the approved `docs/SCOPE.md` (v0.4) and reuses its IDs: features (UP-, AN-, PR-, RP-, PJ-, DB-, AU-), gaps (GAP-) and defects (D1 to D5). O1 to O14 are SCOPE's open items; O15 onward are new in this document and are NOT in SCOPE section 10. Nothing was run; code was only read.

## Tag key

Every requirement row has exactly one tag.

- **As built**: checked in the code. File and line given. Read, not run.
- **Target**: wanted by `blueprint.md`, `AI_RULES.md` or SCOPE, and not built yet.
- **Open**: the user has not decided. It points to an item in the Open items table, which has an owner (the user) and a default.
- **Proposal**: my suggestion, not from the blueprint, needs the user's approval.

Where a default is used below, it is a default, not a decision.

## Source key

**B** = blueprint (`blueprint.md`, with section) · **S** = SCOPE (`docs/SCOPE.md`) · **R** = `AI_RULES.md` · **C** = found in code while writing this file.

## Defaults used (not decided)

| Topic | Default | Item |
|---|---|---|
| Sign-in provider | Supabase; the backend checks Supabase tokens | O1 |
| Job status word | `running` (not `processing`) | O7 |
| First sprint written in detail | Sprint 2: connect frontend to backend | O6 |
| The five planned fixes | Proposed order D1, D2, D4, D3, D5 (SCOPE 8a, O13); no code is changed until the user approves | O13 |
| Where projects, jobs and reports live | B: the backend database is the record; Supabase is used for sign-in only | O48 |

---

## Deliverable 1 — Web app: accounts and organisation

Screens: login, register, forgot password, verify email, onboarding, profile, organisation. Blueprint sprint: 1.

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 1.1 | Register calls Supabase `signUp` (`RegisterPage.tsx:32`). Result not checked; nothing was run | As built | C | AU-2 |
| 1.2 | Forgot password asks Supabase to send a reset email (`ForgotPasswordPage.tsx:19`) | As built | C | AU-3 |
| 1.3 | After the user clicks the reset link there is a page where they type a new password. `App.tsx:66-85` has no such route | Target | B §6 | AU-3, GAP-2 |
| 1.4 | Login accepts any non-empty email and password, stores `localStorage["jr-auth"]="true"` and loads a fixed user (`auth.tsx:100-111`, `73-91`) | As built | C | AU-1 |
| 1.5 | Login checks the real password with the sign-in provider. A wrong password shows a clear message. Log out ends the real session. No fixed user remains | Target | B §6 | AU-1, GAP-2, O1 |
| 1.6 | Route guards (`ProtectedRoute`, `AuthRoute`) send signed-out users to `/login` and users without an organisation to `/onboarding` (`App.tsx:39-60`). They guard the fake login | As built | C | AU-6 |
| 1.7 | The same guards use the real session. Route paths do not change | Target | B §6, R | AU-6 |
| 1.8 | Verify-email page exists; it reads the fake user. It redirects any signed-in user to `/onboarding` (`VerifyEmailPage.tsx:13-17`); not read further | As built | C | AU-4 |
| 1.9 | Verify-email page shows the real state of the signed-in account and lets the user ask for a new email. A signed-in user is not redirected away before verifying (today `VerifyEmailPage.tsx:13-17` sends any signed-in user to `/onboarding`) | Target | B §6 | AU-4 |
| 1.10 | A user must verify email before the first login | Open | S | O11 |
| 1.11 | Onboarding creates an organisation, a member row (role `owner`) and updates the profile in Supabase (`pages/auth/OnboardingPage.tsx:36-66`). Never shown, because `needsOnboarding` is always false (`auth.tsx:131`). By reading the security rules it would probably fail at its first or second write (see 1.34) | As built | C | AU-5 |
| 1.12 | Onboarding is shown to a signed-in user who has no organisation | Target | B §6 | AU-5 |
| 1.13 | Onboarding is all-or-nothing: if one of its three writes fails, the user sees an error and can try again without a half-made organisation (today the three writes are separate, lines 36, 48, 63) | Target | C | AU-5 |
| 1.14 | Profile page edits name and avatar, and changes password, through Supabase (`MyProfilePage.tsx:64,86`) using the fake user id `"1"`. `profiles.id` is a uuid and `"1"` is not a valid uuid, so the call should fail; the page ignores the result and still shows "Saved" (SCOPE 8b F10; by reading, not run) | As built | C | AU-7, D5 |
| 1.15 | Organisation page reads and writes organisation name, member list and invites in Supabase (`OrganizationPage.tsx:53,76,101`) using the fake organisation id `"org-1"`. A Roles tab shows three roles (`:215-240`) | As built | C | AU-8, D5 |
| 1.16 | Inviting a member creates a pending member with a role | Target | B §6 | AU-8 |
| 1.17 | How the invitation reaches the person (email sent by whom) | Open | B §6 | O38 |
| 1.18 | Organisation page shows usage and plan; plan names exist in code (`starter`, `pro`, `enterprise`, `supabase.ts:14`) | Target | B §6 | AU-11 |
| 1.19 | The numbers behind plan limits | Open | B §6 | O39 |
| 1.20 | Every account screen shows loading, empty and error states | Target | B §6 | GAP-2 |
| 1.21 | Billing, API keys and support screens stay as sample placeholders (`BillingPage.tsx:15`, `SupportPage.tsx:14`); notifications become a real table (DATA_MODEL O59; `NotificationPanel.tsx:5` is a placeholder today) | Target | C | AU-11 |
| 1.22 | Two separate `Profile` and `Organization` types exist (`auth.tsx:14-27` and `supabase.ts:19-37`); `types/user.ts` is an empty file | As built | C | not in SCOPE (new finding) |
| 1.23 | One definition of user, profile, organisation and role lives in `types/user.ts` | Target | B §7, R | not in SCOPE (new finding) |
| 1.24 | Changing password: whether the "current password" must be checked | Open | C | O27 |

### D5 acceptance (profile and organisation use a real user)

| ID | "Fixed" means | How it will be checked | Tag |
|---|---|---|---|
| 1.25 | Sign-in identity comes from Supabase; profiles and organisations come from backend PostgreSQL (O48) | Sign in and compare backend profile/organisation rows against authenticated identity | Target |
| 1.26 | Editing the name persists in backend PostgreSQL and survives reload | Edit name through the backend, reload, verify the backend row | Target |
| 1.27 | A failed save shows an error. "Saved" appears only after success (today `MyProfilePage.tsx:64-68` ignores the result) | Make the save fail (wrong id or offline); error shown, no "Saved" | Target |
| 1.28 | Organisation rename and invite use the real organisation id | Rename, reload, name stays; invite row appears with the real organisation id | Target |
| 1.29 | Password change works with the real session and shows Supabase's error text in plain words | Change password; log in with the new one | Target |

Order: D5 comes last of the five in the proposed order (D1, D2, D4, D3, D5), with Sprint 1. It cannot be done before 1.5 (O1, O13).

### 1B Added in 0.2

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 1.30 | The web app must not crash on load when `VITE_SUPABASE_URL` is missing. `frontend/src/lib/supabase.ts:6` calls `createClient` at import, and no `frontend/.env` exists (not run, so unverified). A missing setting gives a clear message | Target | C | not in SCOPE (new finding) |
| 1.31 | Organisation name and preferences can be viewed and changed on the Organization page | Target | B §6 Organization | AU-8 |
| 1.32 | Settings page has real content: user preferences and account settings the blueprint lists. Today `SettingsPage.tsx` is local state (see NFR-14) | Target | B §6 | AU-11 |
| 1.33 | Support page gives a support contact and troubleshooting guidance (today sample text, `SupportPage.tsx:14`). The contact itself is Open | Target | B §6 Notifications and support | AU-11, O45 |
| 1.34 | Onboarding creates the organisation, the first member (role `owner`) and the profile link in one step that the database security rules allow, and leaves nothing half-made if it fails. Cause today: the read rule after step 1 and the insert rule in step 2 both need an existing membership (`frontend/supabase/migrations/20260729043159_add_all_rls_policies.sql:9-13,49-59`; `OnboardingPage.tsx:36-63`). By reading; not run. How: O48 decides where this lives | Target | C | AU-5, SCOPE 8b F11 |
| 1.35 | An administrator cannot make anyone, including themselves, an `owner`, and cannot add a member with a higher role than their own. Today `insert_org_member_admin` and `update_org_member_admin` check neither the person nor the role (`frontend/supabase/migrations/20260729043159_add_all_rls_policies.sql:49-79`). The profile columns `role` and `organization_id` must not decide what a person may do; they are only display (`update_own_profile`, `:32-34`, lets a user edit them but no rule reads them) | Target | B §11 | AU-9, SCOPE 8b F12 |

---

## Deliverable 2 — Web app: projects and upload wizard

Screens: Projects, Project detail, Upload Center (nine-step wizard). Blueprint sprint: 2.

### 2A Projects

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 2.1 | Project list and detail screens exist and show sample data (`routers/projects.py:14-37` also serves sample data; the frontend does not call it) | As built | C | PJ-1 |
| 2.2 | Create, rename, archive and view projects | Target | B §6 | PJ-2, GAP-3 |
| 2.3 | A project stores location, description, owner and analysis defaults | Target | B §6 | PJ-2 |
| 2.4 | Projects are stored in a database (a `Project` table model exists but nothing creates or reads it) | Target | B §7 | PJ-3 |
| 2.5 | Search and filter projects. Screen exists; not checked in detail | Target | B §6 | PJ-4 |
| 2.6 | Project history of changes is kept | Target | B §6 | PJ-5 |
| 2.7 | A project belongs to exactly one organisation | Target | B §11 | R7 |
| 2.8 | The project page shows recent uploads, processing runs, KPIs and report history | Target | B §6 Projects | PJ-1 |

### 2B Wizard: what exists

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 2.10 | Nine steps, in order: Project, Upload, Preview, Metadata, Detection Zone, Count Line, Settings, Review, Queue (`UploadPage.tsx:38-48`) | As built | C | UP-1 |
| 2.11 | Nothing leaves the browser. The last button only navigates to `/job-queue` (`UploadPage.tsx:95-101,427`) | As built | C | UP-2 |
| 2.12 | The step bar lets the user jump to any step (`:129` `onStepClick={setStep}`), skipping the Continue checks | As built | C | UP-1 |
| 2.13 | The file list starts with two sample files marked "Uploaded" (`:61`, `upload.service.ts:6-9`), so step 2 can be passed with no upload | As built | C | UP-1 |
| 2.14 | Picked files keep only name and size. The file itself is dropped. Duration `8h 00m`, resolution `1920×1080`, fps 30 and a 5 GB fallback size are invented (`:70-83`) | As built | C | UP-1, UP-5 |
| 2.15 | The page says "MP4, MKV, AVI · max 12GB each" (`:199`); the picker accepts any `video/*` (`:194`); the backend setting says 20 GB and is unused (`ai/settings.py:15`). Video formats: O18 | As built | C | R3b, D3, O18 |
| 2.16 | The two drawing boards draw on a grey placeholder labelled "CAM-A406-03 · LIVE PREVIEW", in a 480×270 space (`DetectionZoneCanvas.tsx:15,57-59`; `CountLineCanvas.tsx:22,89-91`). Their points stay inside the component | As built | C | AN-1, AN-2 |
| 2.17 | Review and Queue steps show fixed text: camera, "YOLOv8x + ByteTrack", "1 polygon defined", "2 lines (forward)", "~2h 40m · 38 GPU-hours", "billed from your monthly GPU-hour quota", "2nd in queue" (`:375-392,411-424`) | As built | C | PR-5 |

### 2C Wizard fields today (all As built; `UploadPage.tsx` unless stated)

| Field | What it does today | Lines |
|---|---|---|
| Project choice, new project name | Kept in page state; enable Continue, feed the Review step (`:373`) and the Metadata project default (`:259`) | 62, 66, 89, 259, 373 |
| Video files | Name and size kept; invented details | 70-83 |
| Confidence slider (10 to 95) | Kept in state; shown on Review | 63, 341-352, 378 |
| Generate report, Anonymize plates | Kept in state; shown on Review; nothing else | 64-65, 360-361 |
| Location | Kept in state; searches a sample list; also feeds Review (`:376`) | 67, 90-93, 264, 376 |
| Project (again), Camera ID, Road name, Recording date, Start time, End time, Weather, Notes | Plain inputs with fixed starting values and no state. Decoration only. Start/end default `24:00` is not a valid time for this input type | 259-293 |
| Detection model, Tracking algorithm | Selects with fixed starting value and no state. Decoration only | 329-338 |
| Detection zone polygon, counting lines and directions | State inside the two canvas components, not reachable by the page | canvas files |
| Estimates, queue position, cost text | Fixed text. Decoration only | 387-392, 415-424 |

<!-- Adrishikhar - 7 November 2026, 17:40 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD4/O19: reconcile approved typed metadata and freeze/snapshot rules. Documentation correction; runtime implementation pending. -->
### 2D Wizard: what must be sent to the backend

| ID | Field | Sent to backend? | Tag | Src | Link |
|---|---|---|---|---|---|
| 2.20 | Project (existing id, or new name which creates a project first) | Yes | Target | B §8 steps 3-4 | PJ-2 |
| 2.21 | The video file | Yes, uploaded with progress | Target | B §6 Uploads | UP-2, UP-4 |
| 2.22 | Location | Yes (project location) | Target | B §6 Projects | UP-6 |
| 2.23 | Detection model | Yes, as one of the models the server supports | Target | B §6 Analysis | AN-3 |
| 2.24 | Tracking algorithm | Yes, only values the server supports (ByteTrack, BoT-SORT, SORT; no DeepSORT code exists, see O20) | Target | B §6 Analysis | AN-3 |
| 2.25 | Confidence threshold | Yes, as a number from 0.10 to 0.95 | Target | B §6 Analysis | AN-3 |
| 2.26 | Detection zone: list of points | Yes, as positions relative to the real video frame (0 to 1), not the 480×270 board | Target | B §6 Analysis | AN-1, AN-4 |
| 2.27 | Counting lines: two points plus direction each | Yes, same coordinate rule. Direction is defined against the order of the two points | Target | B §6 Analysis | AN-2, AN-4 |
| 2.28 | Camera ID, Road name, Recording date, Start time, End time, Weather, Notes | Yes, optional fields: date and two times are typed; other fields are text. FD4 freezes fields after the first job except notes and preserves job/report snapshots | Decided | FD4 | O19 |
| 2.29 | Generate report | Not decided. Default: yes, as a job option | Open | C | O22 |
| 2.30 | Anonymize plates | Not decided. Default: no; treated as decoration | Open | C | O21 |
| 2.31 | Overlap (IoU), frame skip, batch size, classes of interest, maximum length: the blueprint requires them; the wizard has no control | Not decided. Default: no new controls; server defaults | Open | B §6 Analysis | O23 |
| 2.32 | Estimates, queue position, GPU-hours, price text | No. Shown only if the server returns a real value; otherwise hidden or "Not available" | Open | C | O25 |
| 2.33 | The client's file name | Display text only. Never used as a path (see 4.50) | Target | S | D4 |

<!-- Adrishikhar - 7 November 2026, 17:40 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD8: require exactly one ready video. Documentation correction; runtime implementation pending. -->
### 2E Wizard: behaviour

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 2.40 | Continue requires a valid project and exactly one real completed upload; reject multi-file selection and clear dependent preview/configuration state when replacing the video | Decided | FD8 | UP-2 |
| 2.41 | The step bar cannot jump forward past an incomplete step. Going back is allowed | Target | C | UP-1 |
| 2.42 | Real upload progress and Retry. Unknown network outcome reuses the key to discover status; receiving returns upload_in_progress; a confirmed failed upload needs a fresh key/UUID. Removing a file cancels its active transfer | Decided contract | FD15 | UP-4 |
| 2.43 | A refused file shows the server's reason in plain words (type, size, length) | Target | B §6 Uploads | UP-3 |
| 2.44 | Preview shows real size, length, resolution and frame rate read by the server, and a real frame or clip | Target | B §6 Uploads | UP-5 |
| 2.45 | The two drawing boards sit on a real frame of the uploaded video and pass their points to the wizard (layout unchanged) | Target | B §6 Analysis | AN-1, AN-2 |
| 2.46 | Queue requires at least one line or one zone; lines select line-crossing mode, otherwise zone-presence mode | Decided | S R1, FD1 | O42 |
| 2.47 | A zone is optional when a line exists; zone-only mode requires at least one zone | Decided | FD1 | O42; separate geometry choices remain open |
| 2.48 | Review shows what the user actually chose, not fixed text | Target | C | AN-4 |
| 2.49 | The Queue step makes one request that creates a versioned job from upload id plus saved configuration. It shows the real job id, then goes to `/job-queue` | Target | B §8 step 8 | PR-1, AN-4 |
| 2.50 | A page refresh in the middle of the wizard loses the draft | Open | C | O29 |
| 2.51 | Wizard step animations respect the reduced-motion setting (framer-motion is used at `:135-141,401-406,467-472`) | Target | user rule | NFR-14 |
| 2.52 | The two drawing boards can be used without a mouse | Target | B §10 | NFR-13 |
| 2.53 | The two on/off switches (`:463-466`) have a readable name for screen readers | Target | B §10 | NFR-13 |
| 2.54 | `UploadPage.tsx` is 485 lines; it is split by step so each piece is under 250 lines, with no visual change | Target | R | FR-5 |
| 2.55 | The upload screen text and the server limit agree. Today the screen says "max 12GB each" (`UploadPage.tsx:199`) while the server default is 20 GB (`ai/settings.py:15`) | Target | C | O8 |
| 2.56 | Dragging and dropping files applies the same type filter as the picker. Today drag-and-drop does not filter file types (`UploadPage.tsx:188`); only the picker does (`:194`) | Target | C | UP-3, R3 |

---

## Deliverable 3 — Web app: processing, job queue, dashboard, reports and exports

Screens: Processing, Job Queue, Dashboard, Reports, notifications. Blueprint sprints: 3 and 5.

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 3.1 | Job Queue lists sample jobs, with tabs All, Running, Queued, Completed, Failed, Cancelled (`JobQueuePage.tsx:20-27`). It styles both `running` and `processing` (`:30-31`) | As built | C | PR-6 |
| 3.2 | Processing page picks the sample job whose status is `processing` (`ProcessingPage.tsx:47`). Its log lines are random messages added every 2.4 s (`:51-67`) and the elapsed time starts at 3628 | As built | C | PR-7 |
| 3.3 | Pause and Stop buttons are drawn with no action (`ProcessingPage.tsx:85-86`) | As built | C | PR-8 |
| 3.4 | Job Queue and Processing read real jobs from the backend through the services | Target | B §9 S3 | PR-6, PR-7 |
| 3.5 | Processing shows stage, progress, frames processed, time elapsed and time left, "where available" | Target | B §6 Processing | PR-5 |
| 3.6 | Processing never shows invented log lines. Logs come from the job | Target | C | PR-7 |
| 3.7 | Cancel works and is enabled only when the job's state allows it (see Job lifecycle) | Target | B §6 | PR-8, GAP-10 |
| 3.8 | A Pause button has no basis in the blueprint | Open | C | O30 |
| 3.9 | Meters for GPU, CPU and memory are shown only when the server returns them | Open | C | O25 |
| 3.10 | A failed job shows a safe message and a diagnostic id; Retry is offered only when the failure is retryable | Target | B §8 | PR-9, R5 |
| 3.11 | Users are notified when an upload or job completes or fails; unread and past notifications are listed | Target | B §6 | AU-11 |
| 3.12 | Dashboard shows sample figures (`dashboard.service.ts:13`) | As built | C | DB-1 |
| 3.13 | Dashboard figures come from real jobs and reports: projects, active jobs, completed analyses, recent activity, traffic totals, class split, trends | Target | B §6 Dashboard | DB-2 |
| 3.14 | Every figure links to its project or report | Target | B §6 Dashboard | DB-2 |
| 3.15 | Dashboard has loading, empty, stale and error states. Today unchecked | Target | B §6 Dashboard | DB-3 |
| 3.16 | Dashboard values equal the matching report values | Target | B §9 S5 | DB-2, RP-2 |
| 3.17 | Reports list and charts show sample data (`report.service.ts:1`) | As built | C | RP-1 |
| 3.18 | The Download button only shows "Downloaded" for 2.5 s; no file is made (`ReportsPage.tsx:53-55`). Share is also fake (`:58-61`). Print calls `window.print()` and works (`:63-64`) | As built | C | RP-3 |
| 3.19 | A report is created from a completed analysis. It holds method, input details, configuration, counts, trends and evidence | Target | B §6 Reports | RP-2, RP-5 |
| 3.20 | Reports filter by project, period, class, direction and zone | Target | B §6 Reports | RP-4 |
| 3.21 | Export as CSV and as PDF. Each export has the time it was made and the analysis version | Target | B §6 Reports | RP-3, RP-5 |
| 3.22 | Repeated normal creation returns version 1; regenerating from the same source report returns the same server-assigned successor, with no duplicate notification | Decided contract | FD17 | RP-2 |
| 3.23 | Label estimated Line crossing count or Zone presence count with confidence and method. Sum selected buckets; separate methods in dashboards and reports | Decided | FD1–FD2 | R2 |
| 3.24 | Whether Excel export and a share link are offered (SCOPE lists Excel on the screen; the blueprint names CSV and PDF only). The Share button is fake today (`ReportsPage.tsx:58-61`); Print works (`:63-64`) | Open | S, B | O31 |
| 3.25 | Dashboard shows comparisons (for example between periods or projects), and every KPI links to its project or report | Target | B §6 Dashboard | DB-2 |

### Job lifecycle (part of Deliverable 3)

States, default word set (O7): `queued`, `running`, `completed`, `failed`, `cancelled`.

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 3.30 | Backend sets `queued`, then `processing`, then `completed` or `failed` (`upload_service.py:50,70,81,95,127`); the frontend type accepts six words, both `running` and `processing` (`types/processing.ts:1`) | As built | C | R4a, R4b |
| 3.31 | One word set everywhere (database, API, frontend types, screens). `processing` is removed | Open | B §6 | O7 |
| 3.32 | Allowed moves: new to `queued`; `queued` to `running` or `cancelled`; `running` to `completed`, `failed` or `cancelled`; `failed` to `queued` only if retryable, as a new attempt: the failed attempt is kept in its own `job_attempts` row (DATA_MODEL.md, O57). Nothing leaves `completed` or `cancelled`. A rerun is a new job. Failed and cancelled attempts are kept | Open | S §4 | O9 |
| 3.33 | The backend refuses any other move and never silently marks a job `completed` | Target | B §8 | R5 |

What the user must see, per state (all Target, B §6 Processing, B §8):

| ID | State | The screen must show | Buttons |
|---|---|---|---|
| 3.34 | `queued` | "Queued", queue position if the server knows it, time queued | Cancel |
| 3.35 | `running` | Stage name, real progress, frames processed, elapsed time, time left if known | FD5: supervisor accepts cancellation independently of engine batches; remains running until confirmed stopped |
| 3.36 | `completed` | Counts, evidence, link to the report, completion time | Create report, Rerun |
| 3.37 | `failed` | Safe message in plain words, diagnostic id, time of failure | Retry if retryable, otherwise Rerun |
| 3.38 | `cancelled` | Who and when. Partial results are not presented as final | Rerun |

| ID | Refresh and restart requirement | Tag | Src | Link |
|---|---|---|---|---|
| 3.39 | After a browser refresh in the middle of a job, the page asks the server for the job and shows its true state and progress. Nothing is read from browser memory | Target | B §10 | PR-7 |
| 3.40 | If the job finished while the user was away, the refreshed page shows the final state | Target | B §10 | PR-7 |
| 3.41 | How the page finds the job after a refresh (job id in the address) and how often it asks (polling interval) | Open | B §8 step 12 | O24 |
| 3.42 | Today jobs live in a Python list and vanish on server restart (`processing_repository.py:6-10`). Jobs are stored in the database | Target | B §7 | PR-1, GAP-6 |
| 3.43 | A job left `running` by a crashed or restarted worker does not stay `running` for ever. Default: it becomes `failed` and retryable | Open | B §10 | O40 |
| 3.44 | A job that runs too long is stopped by a processing timeout and becomes `failed` with a safe message. The timeout values are Open | Target | B §7; S 6.2 | PR-9, O46 |
| 3.45 | Job retry policy: how many retries and which failures are retryable are written down and enforced. Values are Open | Target | B §9 S6 | PR-9, O46 |

---

## Deliverable 4 — Backend API

Blueprint sprints: 2, 3, 6.

### 4A What exists (As built)

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 4.1 | Routes: dashboard, projects (list, detail, videos, reports, location suggestions), uploads (get sample list, post a file), processing (all state, one job), reports (analytics, per project), `/health`, `/`. All under `/api` except the last two (`main.py:22-55`) | As built | C | PJ-1, DB-1 |
| 4.2 | Except uploads and processing, routes declare no response model (`routers/projects.py`, `reports.py`, `dashboard.py`) | As built | C | not in SCOPE (new finding) |
| 4.3 | Response fields `status`, `priority` and `stage` are plain text, not fixed lists (`schemas/processing.py:12-14`); `level` is plain text at line 38. There is no `type` field. The frontend uses fixed lists | As built | C | R4b |
| 4.4 | No route checks who is calling (`main.py:22-26`) | As built | C | AU-10 |
| 4.5 | An unknown job id returns HTTP 200 with status `not_found` (`routers/processing.py:20-28`) | As built | C | R4c |
| 4.6 | `POST /api/uploads` saves the file and creates the job in one step (`routers/uploads.py:20-33`), while the wizard uploads at step 2 and configures at step 7 | As built | C | UP-2b |
| 4.7 | `GET /api/processing` fails validation after the first upload because the job lacks `currentFrame` and `vehicleCount` (by reading; `schemas/processing.py:31-32`) | As built | S | GAP-7 |
| 4.8 | A second projects router (`api/projects.py`) is not registered and imports names that do not exist | As built | S | GAP-3 |
| 4.9 | The server registers no error handler of its own (`main.py`), so errors use FastAPI's default shape | As built | C | not in SCOPE (new finding) |

### 4B Endpoints needed (in plain words, all Target)

| ID | Feature | What the API must let the app do | Src | Link |
|---|---|---|---|---|
| 4.10 | Account | Tell who the caller is and which organisation they belong to; check the sign-in token on every call (the provider keeps passwords; O1) | B §6 | AU-10 |
| 4.11 | Projects | Create, list (with search), read, rename, archive a project | B §6 | PJ-2, PJ-4 |
| 4.12 | Projects | List a project's videos, jobs and reports | B §6 | PJ-1 |
| 4.13 | Upload | Accept one video for a project, check it, store it away from outputs, return its id and details (size, length, resolution, frame rate, checksum, time) | B §6 | UP-2, UP-5 |
| 4.14 | Upload | Show an upload's details; delete an upload that has no job | B §6 | UP-5 |
| 4.15 | Configuration | Save an analysis configuration (model, tracker, thresholds, zone, lines, options) and return its version | B §6 | AN-4 |
| 4.16 | Jobs | Create a job from one upload and one saved configuration version. This is a separate call from the upload | B §8 step 8 | PR-1 |
| 4.17 | Jobs | List jobs (filter by state, project); read one job with progress, stage, frames, timings, error code and diagnostic id | B §6 | PR-5, PR-6 |
| 4.18 | Jobs | Cancel a job; retry a failed retryable job | B §6 | PR-8, PR-9 |
| 4.19 | Results | Read a job's counts by class, direction, time bucket and zone, with confidence and model and configuration versions | B §6, §7 | PR-4, R6 |
| 4.20 | Evidence | Get annotated frames or the output video of a job | B §6 | PR-10 |
| 4.21 | Reports | Create a report from a completed job, list reports with filters, read one, download CSV or PDF | B §6 | RP-2 to RP-4 |
| 4.22 | Dashboard | Totals, class split, trends and recent activity for the caller's organisation | B §6 | DB-2 |
| 4.23 | Notifications | List, mark read | B §6 | AU-11 |
| 4.24 | Health | Service and AI runtime readiness (exists, `main.py:44-55`); keep, and add queue readiness once a queue exists | B §12 | PR-11 |
| 4.25 | Location suggestions | Keep the endpoint; real list source | S | UP-6 |

### 4C Rules for every route

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 4.30 | Every route except `/health` needs a valid sign-in token. Whether `/health` and `/` are public | Open | B §9 S0 | O1, O26 |
| 4.31 | Every route that touches a project, upload, job or report checks that it belongs to the caller's organisation (see Access control) | Target | B §11 | R7, GAP-16 |
| 4.32 | One error shape for all failures, with a machine code, a plain message and, for job errors, a diagnostic id. Shape not decided; default in O26 | Open | B §9 S0 | O26 |
| 4.33 | Errors never contain stack traces, file paths or secrets | Target | B §6 | R5 |
| 4.34 | API tests cover validation, authorization, status transitions and errors (B §10). The specific HTTP codes are a Proposal, not in the blueprint: 400 or 422 bad input, 401 not signed in, 403 not allowed, 404 not found (including unknown job id, replacing 200 `not_found`), 413 too large, 415 wrong type, 409 not allowed in this state | Proposal | B §10 (tests only) | R4c |
| 4.35 | Every route declares its response model; status, type and level fields use fixed lists that match the frontend `types/` | Target | B §7 | GAP-5, GAP-7 |
| 4.36 | Field names stay as the frontend uses them (camel case, as today) unless the user approves a change | Target | R | GAP-5 |
| 4.37 | Contract tests compare responses with the agreed types, including FD2 method-filtered/grouped analytics; current frontend types require adaptation before integration | Target | B §13, FD2 | GAP-19 |
| 4.38 | Inputs are checked before work starts: ids exist, lines and zone points are inside 0 to 1, confidence is in range, tracker and model are supported | Target | B §8 failure | AN-4 |
| 4.39 | Repeating a request (upload retry, job retry, report creation) never creates a duplicate final result | Target | B §6, §8 | PR-9, RP-2 |
| 4.40 | Rate limits on uploads and sign-in. Limits not stated by the blueprint | Open | B §9 S6 | O43 |
| 4.41 | Settings (API name, prefix, CORS, database) load from the environment. Today fixed in code (`core/config.py:5-12`, `database.py:4`) | Target | B §14.2 | GAP-1 |
| 4.42 | Audit events are recorded for sign-in, uploads, job changes, report creation, member and role changes and refused requests (the `AuditEvent` entity). Automatic audit retention is disabled (FD7); a separate approved policy is required before deletion can be supported | Target | B §7, §9 S6 | GAP-16, O10 |
| 4.43 | Retention controls: source media, result media and audit records are deleted or kept according to settings. Values are Open | Target | B §9 S6 | O10 |

<!-- Adrishikhar - 7 November 2026, 17:54 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD15/FD19: clarify filename validation and upload retries. Documentation only; runtime implementation pending. -->
### 4D Upload defects D4 and D3 (acceptance)

| ID | "Fixed" means | How it will be checked | Tag |
|---|---|---|---|
| 4.50 | **D4.** The saved file name never contains any part of the client's name. The file is saved as `<id>.<extension>` with the extension from an allowed list. The original name is kept only as display text, cleaned and shortened. Cause today: `upload_service.py:30` | Upload files named `../x.mp4`, `a/b.mp4`, `C:\x.mp4`, `x.exe` and a 300-character name. Every accepted file lands inside the uploads folder under a generated name; `x.exe` is refused even with valid video bytes; an allowed filename extension must also match validated content. The saved extension comes from content, not client path text; the display name is clean | Target |
| 4.51 | **D4.** The job no longer takes its project name from the file name (`upload_service.py:45`); the project comes from the chosen project | Create a job; its project is the one chosen | Target |
| 4.52 | **D3.** The file is written in pieces and stops as soon as it passes the size limit. The half-written file is deleted and the user gets a message naming the limit. Cause today: `upload_service.py:32` reads everything into memory with no check | Upload a file over the limit. Refused with 413; nothing remains on disk; memory use does not grow by the file size | Target |
| 4.53 | **D3.** After saving, the type is checked by content and the length by reading the video. A file that fails is deleted and the reason is returned (wrong type, too long, unreadable) | Upload a text file renamed `.mp4`, a video over the length limit, a valid short video. First two refused with a reason; the third accepted | Target |
| 4.54 | **D3.** The size, length and type limits come from settings the code actually reads (accepted formats: O18). Values and the unit of `MAX_VIDEO_LENGTH` are Open | Change the setting; behaviour changes | Open |
| 4.55 | **D3.** Frame skipping is applied (see 5.14) | See 5.14 | Target |

Item 4.54 points to O8 (default: not decided; ask before accepting 20 GB) and O18 (video formats accepted).

---

<!-- Adrishikhar - 7 November 2026, 17:45 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD10: incomplete decoding cannot silently complete a job. Runtime implementation pending. -->
## Deliverable 5 — AI pipeline

Blueprint sprints: 3 and 4. Pipeline in order: video load, frame read, detect, track, count, aggregate, annotate.

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 5.1 | Video load only checks that the file exists (`video_loader.py:5-9`) | As built | C | PR-2 |
| 5.2 | Video load opens the file with a real video reader and returns length, resolution, frame rate and frame count. An unreadable file fails with a clear reason | Target | B §6 CV | UP-5 |
| 5.3 | Frame read returns a fixed batch with `frame_count = 6` (`frame_reader.py:8,12-13`) | As built | C | GAP-13 |
| 5.4 | Read real ordered batches with frame number/time and bounded memory. Require verified clean EOF; decoder/I/O errors or ambiguous termination fail without partial results. Frame-count estimates alone cannot establish EOF | Decided behavior; reader choice open | FD10 | GAP-13 |
| 5.5 | Detection passes the whole video path to YOLO (`yolo_detector.py:114-117`; SCOPE §5) | As built | S | PR-2 |
| 5.6 | Detection works on frames from 5.4, keeps confidence and frame reference, and keeps only the classes of interest | Target | B §6 CV | PR-2 |
| 5.7 | Tracker makes one new track per detection (`bytetrack_tracker.py:13-27`) | As built | C | PR-3 |
| 5.8 | Tracker keeps the same id for the same vehicle across frames. Tracker is chosen per job (ByteTrack, BoT-SORT, SORT). An unsupported name is refused, not replaced silently | Target | B §6 CV | PR-3, GAP-12 |
| 5.9 | Counter returns the number of tracks (`counter.py:6`). Every function in `analytics.py` raises `NotImplementedError` | As built | C | R1a, PR-4 |
| 5.10 | Count once per track per allowed line crossing. Clear stale crossing candidates after returning to the original confirmed side; reversed or out-of-segment crossings cannot reuse earlier evidence. Zone-only mode follows FD1 | Decided correction | FD12, FD1 | R1, PR-4 |
| 5.11 | Counts are grouped by class, direction, time bucket and zone | Target | B §6 CV | GAP-11 |
| 5.12 | Length of the time bucket, and whether times count from the video start or from the recording clock time. Default: 15 minutes from video start, shifted by the recorded start time | Open | B §6 CV | O34 |
| 5.13 | Other analytics stubs (speed, density, queue length, turning, lane counts, peak hour) are not part of the blueprint list | Open | C | O35 |
| 5.14 | `FRAME_SKIP` is applied when reading frames (today stored and ignored, `yolo_detector.py:44`) | Target | S | D3 |
| 5.15 | Annotated frames and an output video are produced when enabled, stored away from the source, with their path and size recorded | Target | B §6 CV | PR-10, GAP-14 |
| 5.16 | Whether annotated output is on by default | Open | B §6 CV | O36 |
| 5.17 | Progress reflects real frames done out of total. Today fixed at 0, 35, 100 (`upload_service.py:70,81,96`) | Target | B §6 Processing | PR-5 |
| 5.18 | Pipeline checks cooperative stop between batches; the independent supervisor enforces cancellation and deadlines even during blocked calls, terminating the isolated analysis process after configured grace | Decided mechanism; timing open | FD5 | PR-8, O46/O81 |
| 5.19 | Any failure inside the pipeline becomes a short code (for example unreadable video, model missing, out of memory) plus a diagnostic id. Today one catch-all wraps the raw text (`pipeline.py:72-73`) and the raw text goes into the log list the API returns (`upload_service.py:133`) | Target | B §8 | R5, GAP-9 |
| 5.20 | Result is stored, not only logged. Today the count appears only in an in-memory job log message (`upload_service.py:109`) | Target | B §7 | R6 |
| 5.21 | Every result links to its upload, configuration version, model version and job id | Target | B §7 | R6, GAP-14 |
| 5.22 | A saved configuration cannot be edited after a job uses it; a change makes a new version | Target | B §6 Analysis | AN-4 |
| 5.23 | Repeatable: the same video and the same configuration give the same counts, within a tolerance. A test runs a fixture twice and compares | Target | B §2, §9 S4 | R8 |
| 5.24 | The tolerance itself | Open | B §2 | O44 |
| 5.25 | Each job records model name and file identity, tracker, thresholds, frame skip, device and code version | Target | B §12 | R6 |
| 5.26 | The runtime health report shows detector and tracker (exists for detector, `main.py:44-55`) | Target | B §6 CV | PR-11 |
| 5.27 | No face, plate or identity model is loaded or run | Target | B §5, §11 | R9 |
| 5.28 | The YOLO weights path does not depend on the folder the server starts from. Today `runtime.py:89` and `yolo_detector.py:68` use `parents[3]` while the weights are in `backend/`; `upload_service.py:12` and `database.py:4` paths are also relative to the working folder | Target | C | not in SCOPE (new finding) |
| 5.29 | The reported frame count is the real one. Today it is always 6 (`pipeline.py:67`, `frame_reader.py:8`) | Target | C | GAP-13 |

### D1 acceptance (first real detection no longer crashes the job)

| ID | "Fixed" means | How it will be checked | Tag |
|---|---|---|---|
| 5.30 | A detection built from a YOLO box carries the class number the model gave (`class_id`). Cause today: `yolo_detector.py:103-109` omits it, though `cls_index` is read on line 99; `interfaces.py:5-10` requires it | A test feeds a fake YOLO result with one box; it returns one detection with the right `class_id`; no `TypeError` | Target |
| 5.31 | The pipeline finishes with a count when the detector returns detections | Run the pipeline with a fake detector that returns detections; result is `completed` | Target |
| 5.32 | With D2 also fixed, a short real video finishes as `completed` | One real run with the fixture video | Target |

---

<!-- Adrishikhar - 7 November 2026, 17:54 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD18: deferred database guards require explicit constraint execution. Documentation only; runtime implementation pending. -->
## Deliverable 6 — Quality and delivery

Blueprint sprints: 0 and 7.

| ID | Requirement | Tag | Src | Link |
|---|---|---|---|---|
| 6.1 | Rechecked 2026-11-07: `npm run typecheck` passed; `npm run lint` failed with 21 errors and 2 warnings. Includes unused `AuthLayout` in App.tsx and missing effect dependency in OrganizationPage.tsx. Frontend fixes remain outside this backend documentation change | Verified checks | C | GAP-1 |
| 6.2 | No tests exist outside `.venv` and `node_modules` | As built | S | GAP-19 |
| 6.3 | Backend tests: services, repositories, schemas, analytics; API tests for bad input, who may do what, state moves and errors; pipeline tests on a short fixed video; tracker and detector factories tested without running a model | Target | B §10 | GAP-19 |
| 6.4 | Frontend tests: key services and data changes; smoke test of every route; sign-in flow | Target | B §10 | GAP-19 |
| 6.5 | End-to-end checks: register, create project, upload, configure, process, review, export; invalid upload shows a reason; worker failure shows failed job, diagnostic id, then retry; another organisation's data is refused; refresh during processing keeps the true state | Target | B §10 | GAP-19 |
| 6.6 | Lint and typecheck pass on every changed frontend file; backend tests and health check pass | Target | B §13 | GAP-1 |
| 6.7 | A tracked `.env.example` lists every variable with no secrets. A `.env` exists and is ignored by git (`.gitignore:28-29`); no example exists. The pattern `.env.*` at `.gitignore:29` would also ignore `.env.example` | As built | S | GAP-1 |
| 6.8 | `.env.example` is added. The backend loads the file itself (today nothing does). `.gitignore` gets an exception rule (for example `!.env.example`) so the example file is tracked | Target | B §14.1-2 | GAP-1 |
| 6.9 | Written commands to start frontend and backend, and to run all checks | Target | B §14.3 | GAP-1 |
| 6.10 | Test videos: short, consented, kept small, and never private media in git | Target | B §14.7, §13 | GAP-19 |
| 6.11 | Who provides the test videos | Open | B §14.7 | O37 |
| 6.12 | CI runs lint, typecheck, unit, integration and smoke tests; build images | Target | B §9 S7 | GAP-17 |
| 6.13 | A feature is done only when: behaviour and errors built, types and schemas updated together, access checked, tests cover success and failure, lint and typecheck pass, docs and env updated, logs make failures diagnosable, no secrets or media committed | Target | B §13 | GAP-1 |
| 6.14 | Database migrations and constraints are tested once a real database exists | Target | B §10 | GAP-17 |
| 6.15 | Reliability tests cover large files, malformed files, worker restarts and partial failures | Target | B §9 S6 | GAP-19 |
| 6.16 | Production moves to managed persistence (database) and managed media storage. Which services: Open | Target | B §9 S7 | GAP-17, O2, O3, O47 |
| 6.17 | Performance checks and disaster-recovery checks (backup restore, rollback) are run before production. Pass levels are Open | Target | B §9 S7 | GAP-17, O17, O47 |
| 6.18 | User acceptance testing is done with real users before production. Who takes part and when: Open | Target | B §9 S7 | O47 |
| 6.19 | Success measure, as an acceptance test: a new user can sign up, create a project, upload a video and start processing without assistance | Target | B §2 | GAP-19 |

### D2 acceptance (a clean install can start)

| ID | "Fixed" means | How it will be checked | Tag |
|---|---|---|---|
| 6.20 | `requirements.txt` lists `ultralytics` and `torch` with pinned versions that work with the project's Python (the old `.venv` is 3.9). Cause today: `yolo_detector.py:9-10` imports both and `requirements.txt` lists neither | In a new empty virtual environment, install from the file only, start the server, call `/health`: it answers 200 | Target |
| 6.21 | `/health` reports the detector as loaded when `MODEL` starts with `yolo` | Same run, read `detectorLoaded` | Target |
| 6.22 | Which versions, and CPU-only or GPU build | Open: default CPU-only, versions tested first | Open |
| 6.23 | The install steps and the Python version are written in the run instructions | Read the instructions and follow them cold | Target |

Item 6.22 is O14.

---

## Frontend rules (apply to Deliverables 1, 2 and 3)

### Rules (Target, source R)

| ID | Rule |
|---|---|
| FR-1 | No redesign. Wiring changes replace content, never layout, colours or components. Replacing fixed text with real values (2.17, 2.48) is allowed; anything visual needs approval |
| FR-2 | Tailwind stays |
| FR-3 | TypeScript strict. New code is typed; no `any` to get around a type |
| FR-4 | Pages call services, services return promises, services call the API client. Pages never use `fetch`, `axios` or Supabase directly |
| FR-5 | Each component under 250 lines. Prefer composition |
| FR-6 | No duplicate components or types. Reuse the shared UI |
| FR-7 | Existing routes keep working (list below) |

### Today against the rules (As built)

| ID | Finding | Tag |
|---|---|---|
| FR-8 | `strict` is on in `tsconfig.app.json:24` | As built |
| FR-9 | Pages call Supabase directly in five files, ten calls: `MyProfilePage.tsx:64,86`, `OrganizationPage.tsx:53,76,101`, `OnboardingPage.tsx:36,48,63`, `RegisterPage.tsx:32`, `ForgotPasswordPage.tsx:19`. This breaks FR-4. **Conflict for the user: O41** | As built |
| FR-10 | Pages read sample arrays straight from services (`JobQueuePage.tsx:15`, `ProcessingPage.tsx:23-29`, `UploadPage.tsx:34-35`) instead of waiting for a promise. Services expose both (`processing.service.ts:6-30`) | As built |
| FR-11 | Ten pages over 250 lines: `DashboardPage` 577, `UploadPage` 485, `ProjectDetailPage` 475, `ProjectsPage` 365, `SettingsPage` 326, `ProcessingPage` 329, `ReportsPage` 320, `OrganizationPage` 293, `MyProfilePage` 288, `SupportPage` 259. Only the pages were counted; components, services and lib were not counted (not checked) | As built |
| FR-12 | The Hooks layer drawn in `ARCHITECTURE.md` does not exist (SCOPE §11). Whether to create it | Open (O16) |
| FR-13 | Duplicate components: not searched systematically. Duplicate types are known (1.22) | As built |
| FR-14 | Routes in `App.tsx:66-86`: `/login`, `/register`, `/forgot-password`, `/verify-email`, `/onboarding`, `/`, `/projects`, `/projects/:id`, `/upload`, `/processing`, `/job-queue`, `/reports`, `/billing`, `/settings`, `/profile`, `/organization`, `/support`, and `*` back to `/` | As built |

Each deliverable's rows above also obey FR-1 to FR-7. Adding a query value to an address (for a job id, 3.41) does not break a route.

---

## Access control

All of this is **Target**. The backend enforces nothing today. The Supabase tables do enforce organisation scoping and owner/admin checks through their security rules (SCOPE 8b F9, F11, F12), but the app cannot use them with the fake login.

### Roles in code today (As built)

- `lib/supabase.ts:15` allows three member roles: `owner`, `admin`, `researcher`. The Supabase migrations use the same three roles and check them for members, API keys and project deletion (`frontend/supabase/migrations/20260729043159_add_all_rls_policies.sql:49-312`).
- `OrganizationPage.tsx:234-236` describes them as: owner "Full access including billing and deletion"; admin "Manage projects, members, and API keys"; researcher "View and analyze projects. Cannot manage members."
- Onboarding gives the creator `owner` (`OnboardingPage.tsx:53`).
- The fake profile has the role text `"Administrator"` (`auth.tsx:81`), which is not one of the three.
- No backend route checks anyone (`main.py:22-26`).

### Roles in the blueprint (B §3)

The blueprint has four personas: traffic operations analyst (primary), road project manager, transport or municipal decision-maker, organisation administrator. "Owner" is not a blueprint role; it appears only as a project field (B §6 Projects). The four personas do not map cleanly to the three code roles. Default mapping, not decided (O15): owner = owner (code role only); organisation administrator = admin; analyst = researcher; project manager and decision-maker have no role of their own until the user decides.

### Role to permission (proposed)

Y = allowed, N = not allowed, ? = Open (O15). Only the role descriptions at `OrganizationPage.tsx:234-236` come from existing code (owner = full access including billing and deletion; admin = manage projects, members, API keys; researcher = view and analyze, cannot manage members). Every Y/N cell beyond those descriptions is a Proposal, needs the user's approval. For the decision-maker the blueprint (section 3) only says this role "consumes reports rather than configuring models".

| ID | Action | Owner | Administrator | Analyst (researcher) | Project manager | Decision-maker |
|---|---|---|---|---|---|---|
| AC-1 | Delete organisation, manage billing | Y | N | N | N | N |
| AC-2 | Invite and remove members, assign roles | Y | Y | N | N | N |
| AC-3 | Create, rename, archive projects | Y | Y | ? | ? | N |
| AC-4 | Upload videos, configure analysis, queue jobs | Y | Y | Y | ? | N |
| AC-5 | Cancel or retry jobs | Y | Y | Y | ? | N |
| AC-6 | View projects, jobs, results | Y | Y | Y | Y | Y |
| AC-7 | Create and export reports | Y | Y | Y | ? | Y (create: Proposal; blueprint only says this role consumes reports) |
| AC-8 | View dashboard | Y | Y | Y | Y | Y |
| AC-9 | See organisation usage and processing health | Y | Y | N | ? | N |

### Rules

| ID | Rule | Tag | Src |
|---|---|---|---|
| AC-10 | Everything belongs to one organisation: users, projects, uploads, jobs, results, reports, notifications. A user sees only their own organisation's data. A user belongs to one organisation in this version (default; not decided; open item O67 in DATA_MODEL.md) | Target | B §11 |
| AC-11 | Account, organisation and project permissions are kept separate | Target | B §6 |
| AC-12 | Order of checks on every request: 1. Is the token valid? 2. Which organisation does this user belong to? 3. Does the thing asked for belong to that organisation? (if not, answer "not found", so other organisations' ids are not revealed) 4. Does the role allow this action? (if not, "not allowed") 5. Is the input valid? 6. Do the work. The blueprint (B §11) says only that access is checked per organisation and role; this exact order and the "not found" masking are a Proposal | Proposal | B §11 (principle only) |
| AC-13 | The frontend hides actions the role cannot do, but the backend decides | Target | B §11 |
| AC-14 | A refused request is logged with user, organisation and action. The blueprint (B §9 S6) names audit events; logging refused requests specifically is a Proposal | Proposal | B §9 S6 (audit events only) |
| AC-15 | How the four blueprint personas map to roles | Open | C |
| AC-16 | Consequential decisions have a human review path: counts are estimates and nothing acts on them automatically | Target | B §11 |
| AC-17 | Storage access follows least privilege: the app and workers can reach only the storage they need | Target | B §11 |

AC-15 is O15.

---

<!-- Adrishikhar - 7 November 2026, 17:54 (Asia/Dhaka) · Fix approved
Requested/approved by: Adrishikhar Barua. Changed by: Codex.
Fix: FD20/FD21: distinguish trace identifiers and protect retained source media. Documentation only; runtime implementation pending. -->
## Non-functional requirements

| ID | Area | Requirement | Tag | Src |
|---|---|---|---|---|
| NFR-1 | Security | Uploaded video is untrusted input. Type checked by content as well as name; size and length limits enforced (4.52, 4.53) | Target | B §11 |
| NFR-2 | Security | The client's file name never reaches a path (4.50) | Target | S D4 |
| NFR-3 | Security | No secrets, keys, model credentials or private media in git; production secrets come from the platform's secret store. `.env` is already ignored | Target | B §11 |
| NFR-4 | Security | Uploads and outputs in separate places; signed links for files where appropriate; data encrypted in transit and at rest in production (see NFR-18 for link lifetime) | Target | B §11 |
| NFR-5 | Security | CORS origins come from settings (today fixed to three localhost ports, `core/config.py:8-12`) | Target | B §14.2 |
| NFR-6 | Privacy | No face, licence-plate or identity recognition without separate product, legal and consent review | Target | B §5, §11 |
| NFR-7 | Privacy | Logs remove secrets and personal data | Target | B §12 |
| NFR-8 | Privacy | Periods remain O10. FD21: source deletion skips queued/running jobs and serializes with queue/retry; deleted or absent sources cannot start new analysis. Object deletion precedes its marker | Decided safeguards; periods open | FD7, FD21 |
| NFR-9 | Errors | Users never see stack traces, paths or credentials. Messages are plain words | Target | B §6 |
| NFR-10 | Reproducibility | Same input and configuration give a repeatable result (5.23) | Target | B §2 |
| NFR-11 | Logging and tracing | Each HTTP attempt has request_id. Job-related audit/log records add job_id; worker records add attempt_no and the creation request_id. Retry/cancel requests retain their own request IDs. Requests without a job omit job_id. Existing log propagation is not verified | Decided contract | FD20 |
| NFR-12 | Performance | The blueprint gives no numbers (no speeds, no response times, no video lengths). Targets (O17). Rate limits are O43 and the repeat tolerance is O44 | Open | B §12 |
| NFR-13 | Accessibility | Keyboard use, labels, focus and contrast pass checks (B §10). The wizard switches have no accessible name (`UploadPage.tsx:463-466`) and the drawing boards use mouse events only (`CountLineCanvas.tsx:95-98`, `DetectionZoneCanvas.tsx:63`) | Target | B §10 |
| NFR-14 | Motion | Animations and pulsing respect the operating-system reduced-motion setting, and the in-app setting. Today no code reads the setting (searched `useReducedMotion`, `prefers-reduced`: none) and "Reduce motion" on `SettingsPage.tsx:40,303` is local state in the lines found | Target | user rule |
| NFR-15 | Responsive | Every screen works from phone width up to wide desktop with no sideways page scroll. Pages already use Tailwind width prefixes (for example `UploadPage.tsx:110,149`); not tested on devices | Target | user rule |
| NFR-16 | Monitoring | Track request time and errors per route; upload success and refusal reasons; queue size, job time, retries and cancellations; frames per second; storage use; report time; model, configuration version and device per job | Target | B §12 |
| NFR-18 | Security | The signed links in NFR-4 are short-lived. The blueprint says only "signed URLs where appropriate"; the lifetime is not stated | Proposal | B §11 (signed URLs only) |
| NFR-17 | Operations | Alerts for queue growth, repeated worker failures, full storage, rising API errors; written backup, restore, rollback and incident steps | Target | B §12 |

---

## Business rules summary

From SCOPE section 2. "Built" shows what the code does today.

| Rule | Statement | Built | Target requirements |
|---|---|---|---|
| R1 | Count once per track per line, or per zone without lines; method-labelled sums (FD1–FD2) | No: existing count is number of tracks (R1a) | 5.9 to 5.11; LOW_LEVEL_DESIGN section 18 |
| R2 | Counts are estimates with confidence and method | No | 3.23 |
| R3 | Uploads: video only, type by content, size and length limits | Partly: picker filter only | 4.52, 4.53, 2.43 |
| R4 | Job words: queued, running, completed, failed, cancelled | No: `processing` used | 3.30 to 3.33 |
| R5 | A job is never silently completed; failures keep a safe message and id | No | 3.10, 5.19 |
| R6 | Every result links to upload, configuration version, model version, job id | No | 5.21, 5.25 |
| R7 | Users see only their own organisation's data | No | AC-10, 4.31 |
| R8 | Same input and configuration give a repeatable result | Not known | 5.23 |
| R9 | No face, plate or identity recognition without review | No such model found | 5.27, NFR-6 |
| R10 | Frontend rules | Partly | FR-1 to FR-14 |

---

## Not included in this version

From SCOPE section 7 (source: blueprint section 5).

| Item | Status |
|---|---|
| Real-time camera streaming | Out |
| Automatic enforcement or legally binding decisions | Out |
| Face, licence-plate or identity recognition | Out |
| Autonomous traffic-control actions | Out |
| Multi-region distributed processing | Out until usage needs it |
| Custom model training inside the product | Out |
| Image and batch-upload workflows | Later. Screens must not depend on one storage provider |
| Payments and invoices | Placeholders only |
| Pausing a job | Not in the blueprint (see O30) |
| Speed, density, queue length, turning and lane analytics | Not in the blueprint list (see O35) |

---

## Open items

Owner for all: the user. Default is used until the user answers.

| ID | Question | Default |
|---|---|---|
| O1 | Auth provider: Supabase or own FastAPI JWT | Supabase; backend verifies its tokens |
| O2 | Production database | PostgreSQL locally and in production (O72 approved; hosting remains open) |
| O3 | Production file storage | S3-compatible object storage; local folder in development, behind a storage interface |
| O4 | Queue / worker | FastAPI background task until Sprint 3; then a separate worker with a jobs table. No product named |
| O5 | Hosting | Not chosen. No default. Needed before Sprint 7 |
| O6 | First sprint documented in detail | Sprint 2: connect frontend to backend |
| O7 | Job status word | `running` |
| O8 | Upload limits: types, maximum size, maximum length, unit of `MAX_VIDEO_LENGTH` | Not decided. 20 GB default is large; ask before accepting |
| O9 | Exact allowed job moves | The table in 3.32 |
| O10 | Retention of source and result media | Not decided. No default. Needed before Sprint 6 (also NFR-8) |
| O11 | Verify email before first login | Yes |
| O12 | Keep profiles and organisations in Supabase or copy to the backend database | Follows O48: under B they move to the backend database and Supabase keeps sign-in only; under A they stay in Supabase |
| O13 | Approve fixes D1 to D5 and their order | Proposed order D1, D2, D4, D3, D5 (SCOPE 8a, O13). No code changes until the user approves |
| O14 | Versions for `ultralytics` and `torch`; CPU or GPU | CPU-only; versions tested on the project's Python |
| O15 | How the four blueprint personas map to roles (owner is a code role only); the "?" cells in the permission table | Keep three code roles; analyst = researcher; project manager and decision-maker use no separate role until decided |
| O16 | Create the Hooks layer from `ARCHITECTURE.md` | No; pages use services directly, as today |
| O17 | Performance targets (blueprint gives none) | None set. Measure first, then propose numbers |
| O18 | Video formats accepted | MP4, MKV, AVI as the screen says, checked by content |
| O19 | Stored metadata fields and types | Decided by FD4: optional camera, road, weather and notes text; recorded date and two typed times. Edit/freeze and snapshot rules are in LOW_LEVEL_DESIGN section 18; camera timezone handling remains O68 |
| O20 | Tracker list in the wizard: DeepSORT is offered but no DeepSORT code exists; blueprint lists ByteTrack, BoT-SORT, SORT | Offer only trackers the backend supports; SORT replaces DeepSORT |
| O21 | "Anonymize plates" switch (plate blurring needs plate finding, which the blueprint excludes) | Not sent; treated as decoration until legal review |
| O22 | "Generate report" switch | Sent as a job option; a report is made when the job completes |
| O23 | Extra analysis controls (IoU, frame skip, batch size, classes, maximum length) | No new controls; server defaults |
| O24 | How a refreshed page finds its job, and polling interval | Job id in the address as a query value; ask the server every 3 seconds while a job is active |
| O25 | Estimate text, queue position, GPU-hours, GPU/CPU/memory meters on Review, Queue and Processing | Show only server-supplied values; otherwise "Not available" |
| O26 | Error shape, and whether `/health` and `/` are public | `{ "error": { "code", "message", "diagnosticId" } }`; `/health` and `/` public |
| O27 | Change password: check the current password | Yes, by signing in again with it |
| O28 | Is a detection zone required | No; without one the whole frame is used |
| O29 | Keep the wizard draft when the page is refreshed | No |
| O30 | Pause button on Processing (not in the blueprint) | Keep it visible but disabled |
| O31 | Report formats beyond CSV and PDF (Excel, share link) | CSV and PDF only |
| O34 | Time bucket length and time base for counts | 15 minutes from video start, shifted by recorded start time |
| O35 | Other analytics (speed, density, queue length, turning, lane counts, peak hour) | Out of this version |
| O36 | Annotated video on by default | On |
| O37 | Who supplies the consented test videos | The user supplies short clips |
| O38 | How member invitations are delivered | Invite email sent through the sign-in provider |
| O39 | Plan limit values | Show plan name only until limits are defined |
| O40 | Job left `running` after a restart | Mark `failed`, retryable |
| O41 | Pages call Supabase directly in five files (breaks "services only") | Leave until real login is built (Sprint 1), then move the calls into an auth service |
| O42 | Is a counting line required to queue a job, or a line or a zone (2.46, 2.47) | **Decided 2026-11-07 (SCOPE section 9): at least one line or one zone** |
| O43 | Rate-limit values for uploads and sign-in (blueprint gives none) | None set. Measure first, then propose numbers |
| O44 | Repeat-run tolerance: how much two runs of the same video may differ (5.24) | None set. Measure first, then propose a number |
| O45 | Support contact shown on the Support page (1.33) | Not decided. No default; placeholder text until the user gives one |
| O46 | Processing timeout values and retry policy (3.44, 3.45) | Not decided. No default; measure first |
| O47 | Production choices: managed database and media services, disaster-recovery pass levels, user acceptance testing plan (6.16 to 6.18) | Not decided. Needed before Sprint 7; links to O2, O3, O5 |
| O48 | Where do projects, jobs and reports live? **A:** the Supabase tables already defined in `frontend/supabase/migrations/` are the record; the frontend reads and writes them and FastAPI only handles upload and AI. **B:** the backend's own PostgreSQL is the record and Supabase is used for sign-in only | B, as the blueprint's architecture describes (backend owns the data). **Decided by the user on 2026-11-07: B** (the user answered "do as recommended"; B was the stated default). Recorded in SCOPE section 9 |

O32 and O33 are not used.

---

## Traceability

Sprints are blueprint section 9: 0 foundation, 1 auth, 2 projects and uploads, 3 processing, 4 counting, 5 dashboard and reports, 6 reliability and security, 7 production.

| Requirement IDs | SCOPE ID | Sprint |
|---|---|---|
| 1.1, 1.2, 1.9, 1.10 | AU-2, AU-3, AU-4, O11 | 1 |
| 1.3 | AU-3, GAP-2 | 1 |
| 1.4 to 1.7 | AU-1, AU-6, GAP-2, O1 | 1 |
| 1.8, 1.11 to 1.13 | AU-4, AU-5 | 1 |
| 1.14, 1.15, 1.25 to 1.29 | AU-7, AU-8, D5 | 1 |
| 1.16 to 1.20 | AU-8, AU-11, GAP-2 | 1 |
| 1.21 | AU-11 | 1 |
| 1.22, 1.23 | not in SCOPE (new finding) | 1 |
| 1.30 | not in SCOPE (new finding) | 1 |
| 1.31 to 1.33 | AU-8, AU-11, O45 | 1 |
| 1.34, 1.35 | AU-5, AU-7, AU-9; SCOPE 8b F11, F12 | 1 |
| 1.24 | AU-7 | 1 |
| 2.1 to 2.7 | PJ-1 to PJ-5, R7, GAP-3 | 2 |
| 2.10 to 2.17, 2.40 to 2.44 | UP-1 to UP-6, R3, GAP-4 | 2 |
| 2.16, 2.20 to 2.27, 2.45, 2.46, 2.48, 2.49 | AN-1 to AN-4, PR-1, GAP-5 | 2 (queue part 3) |
| 2.28 to 2.33, 2.47, 2.50 | AN-3, UP-5 | 2 |
| 2.8 | PJ-1 | 2 |
| 2.51 to 2.54 | R10 | 2 |
| 2.55, 2.56 | O8, UP-3, R3 | 2 |
| 3.1 to 3.10 | PR-5 to PR-9, GAP-8, GAP-10 | 3 |
| 3.11 | AU-11 | 3 |
| 3.12 to 3.16, 3.25 | DB-1 to DB-3, GAP-15 | 5 |
| 3.17 to 3.24 | RP-1 to RP-5, GAP-15 | 5 |
| 3.30 to 3.43 | R4, R5, GAP-6, PR-1, O7, O9 | 3 |
| 3.44, 3.45 | PR-9, O46 | 3 |
| 4.1 to 4.9 | GAP-3, GAP-7, AU-10; 4.2 and 4.9 not in SCOPE (new finding) | 2 |
| 4.10, 4.30, 4.31, 4.40 | AU-10, GAP-16 | 6 |
| 4.11, 4.12 | PJ-1 to PJ-4 | 2 |
| 4.13, 4.14, 4.25 | UP-2 to UP-6 | 2 |
| 4.15 to 4.20 | AN-4, PR-1 to PR-10 | 3 |
| 4.21 to 4.23 | RP-2 to RP-4, DB-2, AU-11 | 5 |
| 4.24 | PR-11 | 0 |
| 4.32 to 4.39, 4.41 | GAP-1, GAP-5, GAP-7 | 0 and 2 |
| 4.50, 4.51 | D4, GAP-16 | 2 |
| 4.52 to 4.55, 5.14 | D3, GAP-4, O8, O18 | 2 |
| 4.42, 4.43 | GAP-16, O10 | 6 |
| 5.1 to 5.6 | PR-2, GAP-13 | 4 |
| 5.28, 5.29 | GAP-13, not in SCOPE (new finding) | 4 |
| 5.7, 5.8 | PR-3, GAP-12 | 4 |
| 5.9 to 5.13 | PR-4, R1, GAP-11 | 4 |
| 5.15, 5.16, 5.21 to 5.22, 5.25 | PR-10, GAP-14, AN-4, R6 | 4 |
| 5.17 to 5.20 | PR-5, PR-8, GAP-9, R5 | 3 |
| 5.23, 5.24, 5.26, 5.27 | R8, PR-11, R9 | 4 |
| 5.30 to 5.32 | D1, GAP-5 | 2 (first fix) |
| 6.1 to 6.9 | GAP-1, GAP-19 | 0 |
| 6.10, 6.11 | GAP-19 | 4 |
| 6.12, 6.14 | GAP-17 | 7 |
| 6.13 | GAP-1 | 0 |
| 6.15 | GAP-19 | 6 |
| 6.16 to 6.18 | GAP-17, O2, O3, O17, O47 | 7 |
| 6.19 | GAP-19 | 7 |
| 6.20 to 6.23 | D2, GAP-18, O14 | 2 (second fix) |
| FR-1 to FR-14 | R10 | all |
| AC-1 to AC-17 | AU-9, R7, GAP-16 | 1 (roles), 6 (checks) |
| NFR-1 to NFR-5 | R3, GAP-16, D4 | 6 |
| NFR-6, NFR-7 | R9 | 6 |
| NFR-8 | O10 | 6 |
| NFR-9 to NFR-11 | R5, R8, GAP-9 | 3 |
| NFR-12 | O17, O43, O44 | 7 |
| NFR-18 | not in SCOPE (Proposal) | 6 |
| NFR-13 to NFR-15 | R10 | 7 |
| NFR-16, NFR-17 | GAP-17 | 6 and 7 |


### Approved flow correction reference — 2026-11-07

[LOW_LEVEL_DESIGN section 18](LOW_LEVEL_DESIGN.md#18-approved-backend-flow-corrections) records FD1–FD8: counting modes and totals, generated storage keys, metadata locking and snapshots, independent worker supervision with attempt checks, transactional notifications, retention restrictions, and one video per workflow. Adrishikhar Barua approved these documentation corrections; Codex edited them. Runtime implementation remains pending. Dated approved decisions override earlier blueprint statements and draft defaults; unrelated open items remain open.


Approved verification detail (FD18): tests must force deferred constraints with SET CONSTRAINTS ALL IMMEDIATE after the intended transaction sequence, or commit isolated transactions. Rollback-only tests do not verify the completed-result guard. FD16 list responses use items/nextCursor envelopes on migrated routes; dashboard uses FD2 grouped counts, with frontend adapters migrated alongside contract changes.
