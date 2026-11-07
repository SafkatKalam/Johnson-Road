-- =====================================================================
-- Johnson Road: backend database schema, draft v0.3, 2026-11-07
-- Written for PostgreSQL 16. Explained in docs/DATA_MODEL.md.
-- v0.3 change: review fixes (purge exception for the lock triggers via SET LOCAL jr.purge, lock check on
--   both old and new row of a child update, ownership-transfer order, completed-job note; adds O76).
-- v0.2 change: review fixes (delete rules now RESTRICT, job insert and result
--   triggers, audit truncate and grants block, recording times below 24:00,
--   composite keys for job events, notifications and cross-links, BEGIN/COMMIT).
-- STATUS: this SQL was NOT executed and NOT validated. It was only written.
-- FOR A FRESH, EMPTY DATABASE ONLY. There is no IF NOT EXISTS on purpose: running
--   it twice must fail loudly. The whole file is one transaction (BEGIN ... COMMIT),
--   so any error leaves nothing behind. Later changes need a migration tool (O63).
-- Tags: the whole file is Target (no table exists yet). [Proposal] = my
-- suggestion, needs approval. [Open] = the user has not decided (default given).
-- Decision in force: option B (O48). This database is the record; Supabase only
-- signs people in (its id is stored as auth_subject). No password is stored.
-- POSTGRES-ONLY parts (SQLite will not run these; local database is O72, default
-- PostgreSQL, so SQLite is not used for this file):
--   P1 DEFAULT gen_random_uuid()   P2 timestamptz and now()   P3 jsonb
--   P4 GENERATED ... AS IDENTITY   P5 UNIQUE NULLS NOT DISTINCT (PostgreSQL 15+)
--   P6 plpgsql functions and triggers   P7 GRANT, REVOKE
--   P8 btrim() (SQLite has trim)   P9 jsonb_typeof() inside a CHECK
--   P10 SQLite ignores foreign keys unless PRAGMA foreign_keys=ON is set on every connection
-- Partial indexes work in both. CHECK sets are used, not enums. Times are UTC.
-- updated_at is set by the service, not by a trigger. Tables whose rows change after
-- creation have it; immutable tables do not (list in DATA_MODEL section 1).
-- DELETE RULES: foreign keys to a record that is evidence or money-like are
-- ON DELETE RESTRICT. CASCADE is used only for pure child rows. Projects are
-- archived (archived_at), never hard-deleted. "Delete organisation" is a purge run
-- by the service in dependency order (O73).
-- =====================================================================

BEGIN;

-- ---------- 1. Identity: users, organisations, members, invites ----------

-- One row per person who can sign in. The password lives in Supabase.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),            -- P1
  auth_subject  text NOT NULL UNIQUE,   -- the sign-in provider's user id (Supabase "sub"); text, not uuid, so O1 can change
  email         text NOT NULL,          -- copy for display and invites; the provider stays the source
  full_name     text NOT NULL DEFAULT '',
  avatar_url    text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),                    -- P2
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

-- A company or team. Everything below hangs off one organisation.
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  slug        text NOT NULL UNIQUE,     -- [Proposal] kept from the Supabase table; made by the service
  plan        text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Who belongs to which organisation, and with what role. The role lives ONLY here.
CREATE TABLE organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('owner','admin','researcher')),   -- O15 open
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),   -- role and status change, so this table has it
  UNIQUE (organization_id, user_id),
  UNIQUE (user_id)                       -- [Open] O67: one organisation per person in this version
);
-- Rule: at most one owner per organisation. At least one owner is a service rule.
CREATE UNIQUE INDEX organization_one_owner_uq ON organization_members (organization_id) WHERE role = 'owner';

-- A pending invitation. Turning it into a member is one service step.
CREATE TABLE organization_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text NOT NULL CHECK (role IN ('admin','researcher')),   -- an invite can never make an owner (F12)
  token_hash       text NOT NULL UNIQUE,   -- only the hash of the invite token is stored
  invited_by       uuid NOT NULL REFERENCES users(id),
  expires_at       timestamptz NOT NULL,   -- [Open] O69: default 7 days
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()    -- accepted_at and revoked_at change, so this table has it
);
-- Only one open invitation per person and organisation. The index cannot test
-- expires_at (now() is not allowed in an index condition). SERVICE RULE: when an invite
-- expires, the service sets revoked_at (a daily job, or on the next invite to the same
-- email), otherwise an expired invite would still block a new one (O74).
CREATE UNIQUE INDEX organization_invites_open_uq ON organization_invites (organization_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ---------- 2. Projects and uploads ----------

CREATE TABLE projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,   -- projects are archived, never hard-deleted
  name             text NOT NULL CHECK (length(btrim(name)) > 0),
  location        text NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT '',
  owner_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,   -- blueprint "owner" field
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  default_options  jsonb NOT NULL DEFAULT '{}',   -- P3: analysis defaults (REQ 2.3); a small free-shape bag, not queried
  archived_at      timestamptz,                   -- archive = set this; no hard delete from the screen
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)                    -- lets child tables prove they sit in the same organisation
);
-- [Proposal] no two live projects with the same name in one organisation.
CREATE UNIQUE INDEX projects_name_uq ON projects (organization_id, lower(name)) WHERE archived_at IS NULL;
CREATE INDEX projects_list_ix ON projects (organization_id, archived_at, created_at DESC);

-- One stored video file. The client's file name is display text only (defect D4).
CREATE TABLE uploads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL,
  project_id           uuid NOT NULL,
  uploaded_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key      text,                    -- [Proposal] client-made key so a retried upload makes one row (REQ 4.39)
  original_name        text NOT NULL,           -- cleaned and shortened; NEVER used in a path
  storage_key          text NOT NULL UNIQUE,    -- generated "<id>.<ext>" inside the sources area; never a machine path
  extension            text NOT NULL CHECK (extension IN ('mp4','mkv','avi')),   -- [Open] O18 list
  status               text NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving','ready','failed')),
  failure_code         text,                    -- short code when status = failed (wrong type, too long, unreadable)
  size_bytes           bigint CHECK (size_bytes >= 0),
  checksum_sha256      text,
  duration_seconds     numeric(12,3) CHECK (duration_seconds >= 0),
  width_px             integer CHECK (width_px > 0), height_px integer CHECK (height_px > 0),
  frame_rate           numeric(8,3) CHECK (frame_rate > 0),
  frame_count          bigint CHECK (frame_count >= 0),
  preview_frame_key    text,                    -- one real frame for the drawing boards (REQ 2.45); also the project thumbnail
  camera_id            text, road_name text,    -- wizard metadata, all optional (O19 default: typed values for date and times, text for the rest)
  recorded_date        date,
  -- [Open] O68: local clock at the camera, no time zone. PostgreSQL accepts '24:00:00' as a time,
  -- so each is checked to be before 24:00. The screen default "24:00" must change to 23:59 or be refused (O75).
  recorded_start_time  time CHECK (recorded_start_time < TIME '24:00:00'),
  recorded_end_time    time CHECK (recorded_end_time < TIME '24:00:00'),
  weather              text, notes text,
  source_deleted_at    timestamptz,             -- file removed by retention; the row stays because results point to it
  created_at           timestamptz NOT NULL DEFAULT now(),   -- upload time
  updated_at           timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE RESTRICT,
  UNIQUE (id, project_id),
  CHECK (status <> 'ready' OR (size_bytes IS NOT NULL AND checksum_sha256 IS NOT NULL AND duration_seconds IS NOT NULL
                               AND width_px IS NOT NULL AND height_px IS NOT NULL AND frame_rate IS NOT NULL))
);
CREATE UNIQUE INDEX uploads_idem_uq ON uploads (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX uploads_project_ix ON uploads (project_id, created_at DESC);
CREATE INDEX uploads_checksum_ix ON uploads (organization_id, checksum_sha256);   -- spot a repeated file (warning only)

-- ---------- 3. Analysis configuration (versioned, then frozen) ----------

-- One saved set of choices for one upload. Once a job uses it, it is locked
-- (locked_at set) and a change makes a new version (REQ 5.22).
-- Values are the final ones: the service writes the server default into the
-- column when the user chose nothing (O23 default), so a result can be repeated.
CREATE TABLE analysis_configurations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL,
  project_id            uuid NOT NULL,
  upload_id             uuid NOT NULL,
  version_no            integer NOT NULL CHECK (version_no >= 1),
  based_on_id           uuid,                   -- the version this one was copied from (same upload; composite key below)
  model_name            text NOT NULL,          -- a model the server supports
  tracker               text NOT NULL CHECK (tracker IN ('bytetrack','botsort','sort')),   -- O20: no DeepSORT
  confidence_threshold  numeric(4,3) NOT NULL CHECK (confidence_threshold BETWEEN 0.10 AND 0.95),
  iou_threshold         numeric(4,3) NOT NULL CHECK (iou_threshold > 0 AND iou_threshold <= 1),
  frame_skip            integer NOT NULL DEFAULT 1 CHECK (frame_skip >= 1),
  batch_size            integer NOT NULL DEFAULT 1 CHECK (batch_size >= 1),
  classes               jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(classes) = 'array'),   -- P3: short list of class names; empty = server default
  bucket_seconds        integer NOT NULL DEFAULT 900 CHECK (bucket_seconds > 0),   -- [Open] O34: 15 minutes
  generate_report       boolean NOT NULL DEFAULT true,    -- [Open] O22
  annotated_output      boolean NOT NULL DEFAULT true,    -- [Open] O36
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  locked_at             timestamptz,            -- set when the first job uses this version
  updated_at            timestamptz NOT NULL DEFAULT now(),   -- changes only while unlocked; a locked row is immutable
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (upload_id, project_id) REFERENCES uploads (id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (based_on_id, upload_id) REFERENCES analysis_configurations (id, upload_id) ON DELETE RESTRICT,   -- skipped when based_on_id is null
  UNIQUE (upload_id, version_no),
  UNIQUE (id, upload_id)
);

-- A detection zone. Its corner points are in zone_points. Coordinates are 0 to 1 of the real frame (REQ 2.26).
CREATE TABLE counting_zones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL REFERENCES analysis_configurations(id) ON DELETE CASCADE,
  name             text NOT NULL DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,
  UNIQUE (id, configuration_id)
);
CREATE TABLE zone_points (   -- at least 3 points per zone is a service rule
  zone_id  uuid NOT NULL REFERENCES counting_zones(id) ON DELETE CASCADE,
  seq      integer NOT NULL CHECK (seq >= 0),
  x        double precision NOT NULL CHECK (x BETWEEN 0 AND 1),
  y        double precision NOT NULL CHECK (y BETWEEN 0 AND 1),
  PRIMARY KEY (zone_id, seq)
);

-- A counting line: two points and a direction (REQ 2.27). Coordinates 0 to 1.
-- forward = crossing from the left of the arrow point 1 -> point 2 to its right. [Open] O66: exact wording.
CREATE TABLE counting_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL REFERENCES analysis_configurations(id) ON DELETE CASCADE,
  name             text NOT NULL DEFAULT '',
  x1 double precision NOT NULL CHECK (x1 BETWEEN 0 AND 1), y1 double precision NOT NULL CHECK (y1 BETWEEN 0 AND 1),
  x2 double precision NOT NULL CHECK (x2 BETWEEN 0 AND 1), y2 double precision NOT NULL CHECK (y2 BETWEEN 0 AND 1),
  direction        text NOT NULL DEFAULT 'forward' CHECK (direction IN ('forward','backward','both')),
  sort_order       integer NOT NULL DEFAULT 0,
  CHECK (x1 <> x2 OR y1 <> y2),                  -- the two points must differ
  UNIQUE (id, configuration_id)
);

-- ---------- 4. Jobs ----------

-- One processing run request. Status words: O7 default (running, not processing).
-- Moves between words: REQ 3.32 (O9 open); enforced by the trigger in section 9 and by the service.
CREATE TABLE jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL,
  project_id          uuid NOT NULL,
  upload_id           uuid NOT NULL,
  configuration_id    uuid NOT NULL,
  idempotency_key     text,                      -- [Proposal] a repeated "create job" request returns the same job (REQ 4.39)
  rerun_of_job_id     uuid,                      -- a Rerun is a NEW job; links it to the earlier one in the same project (composite key below)
  status              text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  priority            text NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),   -- [Open] O61: kept, always normal, not used to order
  stage               text NOT NULL DEFAULT 'queued',   -- [Open] O70: stage names, list in DATA_MODEL 4.6
  progress_percent    smallint NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  frames_total        bigint CHECK (frames_total >= 0),
  frames_done         bigint NOT NULL DEFAULT 0 CHECK (frames_done >= 0),
  processing_fps      numeric(8,2),              -- real speed, for time left
  attempt_no          integer NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),   -- the current attempt; history in job_attempts
  is_retryable        boolean NOT NULL DEFAULT false,   -- meaningful only when status = failed
  error_code          text,                      -- short code, e.g. unreadable_video, model_missing, out_of_memory
  safe_message        text,                      -- plain words for the user; never a stack trace or path
  diagnostic_id       text,                      -- the number support uses to find the raw error in the server log
  cancel_requested_at timestamptz,               -- the worker checks this between batches
  cancel_requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  worker_id           text,
  device              text,                      -- cpu or the GPU used
  model_name          text,                      -- filled when the job starts running
  model_file_name     text,
  model_file_sha256   text,                      -- file identity of the weights actually loaded
  code_version        text,                      -- git commit of the code that ran
  timeout_seconds     integer CHECK (timeout_seconds > 0),   -- [Open] O46: no default
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  queued_at           timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  last_heartbeat_at   timestamptz,               -- lets a restart find jobs a dead worker left running (O40)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (upload_id, project_id) REFERENCES uploads (id, project_id) ON DELETE RESTRICT,
  FOREIGN KEY (configuration_id, upload_id) REFERENCES analysis_configurations (id, upload_id) ON DELETE RESTRICT,
  FOREIGN KEY (rerun_of_job_id, project_id) REFERENCES jobs (id, project_id) ON DELETE RESTRICT,   -- skipped when rerun_of_job_id is null
  UNIQUE (id, project_id),
  UNIQUE (id, organization_id),                  -- lets notifications prove the job is in the same organisation
  UNIQUE (id, upload_id, configuration_id),
  CHECK (status <> 'failed' OR (error_code IS NOT NULL AND safe_message IS NOT NULL AND diagnostic_id IS NOT NULL)),   -- R5
  CHECK (status NOT IN ('completed','failed','cancelled') OR finished_at IS NOT NULL),
  CHECK (status NOT IN ('running','completed') OR started_at IS NOT NULL),
  CHECK (frames_total IS NULL OR frames_done <= frames_total),
  CHECK (status <> 'completed' OR progress_percent = 100)
);
CREATE UNIQUE INDEX jobs_idem_uq ON jobs (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX jobs_queue_ix ON jobs (queued_at) WHERE status = 'queued';                 -- worker: oldest queued first
CREATE INDEX jobs_running_ix ON jobs (last_heartbeat_at) WHERE status = 'running';      -- restart recovery and timeout
CREATE INDEX jobs_org_status_ix ON jobs (organization_id, status, queued_at DESC);      -- Job Queue tabs
CREATE INDEX jobs_project_ix ON jobs (project_id, created_at DESC);

-- Every attempt of a job is kept, including failed and cancelled ones. [Open] O57.
CREATE TABLE job_attempts (
  job_id         uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,   -- pure child row of one job
  attempt_no     integer NOT NULL CHECK (attempt_no >= 1),
  outcome        text NOT NULL DEFAULT 'running' CHECK (outcome IN ('running','completed','failed','cancelled')),
  started_at     timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  worker_id      text, device text,
  error_code     text, diagnostic_id text,
  PRIMARY KEY (job_id, attempt_no)
);

-- Log lines shown on the Processing page. Safe text only, never raw exception text (R5).
CREATE TABLE job_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- P4
  job_id      uuid NOT NULL,
  attempt_no  integer NOT NULL DEFAULT 1,   -- the service creates the job_attempts row before the first log line
  at          timestamptz NOT NULL DEFAULT now(),
  level       text NOT NULL CHECK (level IN ('info','success','warn','error')),
  event_code  text NOT NULL,
  message     text NOT NULL,
  FOREIGN KEY (job_id, attempt_no) REFERENCES job_attempts (job_id, attempt_no) ON DELETE CASCADE   -- pure child row of one attempt
);
CREATE INDEX job_events_job_ix ON job_events (job_id, id);

-- ---------- 5. Results ----------

-- Header of a finished job's counts: one row per completed job. It carries
-- the model that really ran, so every row below can reach upload, configuration,
-- model and job (R6).
CREATE TABLE job_results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid NOT NULL UNIQUE,
  upload_id          uuid NOT NULL,
  configuration_id   uuid NOT NULL,
  model_name         text NOT NULL,
  model_file_sha256  text NOT NULL,
  code_version       text NOT NULL,
  method             text NOT NULL DEFAULT 'line_crossing',   -- how counts were made (R2)
  is_estimate        boolean NOT NULL DEFAULT true,           -- counts are estimates (R2)
  bucket_seconds     integer NOT NULL CHECK (bucket_seconds > 0),
  time_base          text NOT NULL DEFAULT 'video_start' CHECK (time_base IN ('video_start','recorded_clock')),   -- O34
  frames_processed   bigint NOT NULL CHECK (frames_processed >= 0),
  detections_total   bigint NOT NULL DEFAULT 0 CHECK (detections_total >= 0), tracks_total bigint NOT NULL DEFAULT 0 CHECK (tracks_total >= 0),
  vehicles_counted   bigint NOT NULL DEFAULT 0 CHECK (vehicles_counted >= 0),
  confidence_mean    real CHECK (confidence_mean BETWEEN 0 AND 1),
  confidence_min     real CHECK (confidence_min BETWEEN 0 AND 1), confidence_max real CHECK (confidence_max BETWEEN 0 AND 1),
  created_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (job_id, upload_id, configuration_id) REFERENCES jobs (id, upload_id, configuration_id) ON DELETE RESTRICT,   -- a result is evidence
  UNIQUE (id, job_id, upload_id, configuration_id)
);

-- Counts grouped by time bucket, vehicle class, direction, and line or zone.
-- Raw per-frame detections are NOT stored. [Open] O58: default not stored.
CREATE TABLE count_buckets (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- P4
  result_id          uuid NOT NULL,
  job_id             uuid NOT NULL,
  upload_id          uuid NOT NULL,
  configuration_id   uuid NOT NULL,
  bucket_index       integer NOT NULL CHECK (bucket_index >= 0),
  bucket_start_s     numeric(12,3) NOT NULL CHECK (bucket_start_s >= 0),   -- seconds from video start
  vehicle_class      text NOT NULL,
  direction          text NOT NULL CHECK (direction IN ('forward','backward')),
  line_id            uuid,
  zone_id            uuid,
  vehicle_count      integer NOT NULL CHECK (vehicle_count >= 0),
  confidence_mean    real CHECK (confidence_mean BETWEEN 0 AND 1),
  FOREIGN KEY (result_id, job_id, upload_id, configuration_id) REFERENCES job_results (id, job_id, upload_id, configuration_id) ON DELETE CASCADE,   -- pure child row of one result
  FOREIGN KEY (line_id, configuration_id) REFERENCES counting_lines (id, configuration_id) ON DELETE RESTRICT,   -- line must belong to this configuration (skipped when line_id is null)
  FOREIGN KEY (zone_id, configuration_id) REFERENCES counting_zones (id, configuration_id) ON DELETE RESTRICT,
  CHECK (line_id IS NOT NULL OR zone_id IS NOT NULL),   -- [Open] O42 default: at least one line or one zone
  UNIQUE NULLS NOT DISTINCT (result_id, bucket_index, vehicle_class, direction, line_id, zone_id)   -- P5
);
CREATE INDEX count_buckets_result_ix ON count_buckets (result_id, bucket_index);
CREATE INDEX count_buckets_class_ix ON count_buckets (job_id, vehicle_class);

-- Evidence and output files of a job: annotated video, annotated frames. Stored apart from sources.
CREATE TABLE job_artifacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,   -- evidence: the row records a stored file
  kind             text NOT NULL CHECK (kind IN ('annotated_video','annotated_frame')),
  storage_key      text NOT NULL UNIQUE,    -- key in the outputs area, never a machine path
  content_type     text NOT NULL,
  size_bytes       bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256  text,
  frame_index      bigint,                  -- for frames: which frame
  at_seconds       numeric(12,3),
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz              -- file removed by retention
);
CREATE INDEX job_artifacts_job_ix ON job_artifacts (job_id, kind);

-- ---------- 6. Reports ----------

-- A report built from one completed job. Making it twice gives one row (REQ 3.22),
-- unless the user asks for a new version.
CREATE TABLE reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  project_id       uuid NOT NULL,
  job_id           uuid NOT NULL,
  title            text NOT NULL,
  report_type      text NOT NULL DEFAULT 'summary' CHECK (report_type IN ('summary','daily','weekly','peak')),
  options          jsonb NOT NULL DEFAULT '{}',   -- P3: filters used (period, classes, directions, zone); small, read whole
  options_hash     text NOT NULL,                 -- sha256 of options, so "same report" can be found
  version          integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  vehicles_counted bigint NOT NULL DEFAULT 0,     -- copy at creation, so the list needs no join
  generated_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects (id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (job_id, project_id) REFERENCES jobs (id, project_id) ON DELETE RESTRICT,
  UNIQUE (job_id, report_type, options_hash, version)
);
CREATE INDEX reports_list_ix ON reports (organization_id, generated_at DESC);
CREATE INDEX reports_project_ix ON reports (project_id, generated_at DESC);

-- One exported file of a report. Excel and share link are not offered by default (O31).
CREATE TABLE report_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,   -- pure child row of one report
  format           text NOT NULL CHECK (format IN ('csv','pdf')),
  storage_key      text NOT NULL UNIQUE,
  size_bytes       bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256  text,
  analysis_version text NOT NULL,   -- configuration version and model written into the file (REQ 3.21)
  generated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, format)
);

-- ---------- 7. Notifications ----------

CREATE TABLE notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('upload_ready','upload_failed','job_completed','job_failed','job_cancelled','report_ready','invite','info')),
  title            text NOT NULL,
  detail           text NOT NULL DEFAULT '',
  link             text,                    -- an app address such as /job-queue?job=..., never an outside link
  job_id           uuid,                    -- optional; same organisation as the notification (composite key below)
  read_at          timestamptz,             -- null = unread; read_at is the only change after creation
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (job_id, organization_id) REFERENCES jobs (id, organization_id) ON DELETE CASCADE   -- a notice is not evidence; skipped when job_id is null
);
CREATE INDEX notifications_user_ix ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_ix ON notifications (user_id) WHERE read_at IS NULL;

-- ---------- 8. Audit and settings ----------

-- Append-only record of who did what. No foreign keys on purpose, so deleting
-- an organisation or user never edits or removes history. Never updated or deleted (section 9).
CREATE TABLE audit_events (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- P4
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  organization_id  uuid,
  actor_user_id    uuid,
  actor_kind       text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','system','worker')),
  action           text NOT NULL,           -- e.g. sign_in, upload_created, job_cancelled, role_changed, request_refused
  entity_type      text,
  entity_id        text,
  outcome          text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','refused','failed')),
  reason_code      text,
  request_id       text,                    -- the correlation id (NFR-11)
  details          jsonb NOT NULL DEFAULT '{}'   -- P3: small before/after facts, e.g. old and new role. No secrets, no personal data
);
CREATE INDEX audit_org_time_ix ON audit_events (organization_id, occurred_at DESC);
CREATE INDEX audit_entity_ix ON audit_events (entity_type, entity_id);
CREATE INDEX audit_actor_ix ON audit_events (actor_user_id, occurred_at DESC);

-- Server-wide limits and retention periods. value null = not decided yet. [Proposal] global only.
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb,
  note        text NOT NULL DEFAULT '',
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- 9. Rules in the database (all Postgres-only, P6) ----------

-- 9.1 Job status moves (REQ 3.32, O9). Any other move is refused.
CREATE FUNCTION jr_check_job_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF (OLD.status, NEW.status) IN (('queued','running'),('queued','cancelled'),('running','completed'),
                                  ('running','failed'),('running','cancelled'),('failed','queued'))
     AND (OLD.status <> 'failed' OR OLD.is_retryable) THEN   -- a failed job is retried only if retryable
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'job move % to % is not allowed', OLD.status, NEW.status USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER jobs_move_trg BEFORE UPDATE OF status ON jobs FOR EACH ROW EXECUTE FUNCTION jr_check_job_move();

-- 9.1b A job can only be inserted as 'queued' (the move trigger above sees updates only).
CREATE FUNCTION jr_check_job_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'queued' THEN
    RAISE EXCEPTION 'a new job must start as queued, not %', NEW.status USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER jobs_insert_trg BEFORE INSERT ON jobs FOR EACH ROW EXECUTE FUNCTION jr_check_job_insert();

-- 9.2 A job cannot be 'completed' without a stored result (REQ 3.33). Checked at commit time.
CREATE FUNCTION jr_check_completed_has_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND NOT EXISTS (SELECT 1 FROM job_results WHERE job_id = NEW.id) THEN
    RAISE EXCEPTION 'job % completed without a result', NEW.id USING ERRCODE = 'check_violation'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER jobs_completed_trg AFTER INSERT OR UPDATE OF status ON jobs
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION jr_check_completed_has_result();

-- 9.2b A result can be inserted only while its job is 'running'. The worker inserts the result
-- first and sets the job 'completed' later in the same transaction (the job is still running then).
-- Deleting a result after completion is NOT a trigger: a trigger would also block the purge (O73)
-- and cannot tell it apart. It is a service rule: results are never deleted except by the purge.
CREATE FUNCTION jr_check_result_job_running() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  SELECT status INTO st FROM jobs WHERE id = NEW.job_id;
  IF st IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'result refused: job % is %, not running', NEW.job_id, st USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER job_results_insert_trg BEFORE INSERT ON job_results FOR EACH ROW EXECUTE FUNCTION jr_check_result_job_running();

-- 9.3 Creating a job locks its configuration (REQ 5.22).
CREATE FUNCTION jr_lock_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN UPDATE analysis_configurations SET locked_at = now() WHERE id = NEW.configuration_id AND locked_at IS NULL; RETURN NEW; END $$;
CREATE TRIGGER jobs_lock_cfg_trg AFTER INSERT ON jobs FOR EACH ROW EXECUTE FUNCTION jr_lock_configuration();

-- 9.4 A locked configuration, and its zones, points and lines, cannot be changed or deleted.
-- Exception 1 (UPDATE): the update made by "ON DELETE SET NULL" when a user is deleted (created_by
-- becomes null and every other column is equal). The other columns are compared as jsonb.
-- Exception 2 (DELETE only): the organisation purge (O73). The purge routine runs
-- SET LOCAL jr.purge = 'on' inside its own transaction; while that is set, a DELETE is allowed.
-- ANY connected role can set that setting, so this guards against mistakes, not against a
-- malicious or compromised app role (stronger design: O76). The UPDATE path stays strict.
CREATE FUNCTION jr_forbid_locked_cfg_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('jr.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  IF OLD.locked_at IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.created_by IS NOT NULL AND NEW.created_by IS NULL
     AND (to_jsonb(NEW) - 'created_by') = (to_jsonb(OLD) - 'created_by') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'configuration % is locked; make a new version', OLD.id USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER cfg_locked_trg BEFORE UPDATE OR DELETE ON analysis_configurations
  FOR EACH ROW EXECUTE FUNCTION jr_forbid_locked_cfg_row();

-- Helper: does this row (given as jsonb) belong to a locked configuration?
-- col names the column that holds the configuration id; for 'zone_id' the configuration is found
-- through counting_zones. A row whose configuration is not found counts as not locked.
CREATE FUNCTION jr_row_cfg_locked(col text, j jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE cfg uuid;
BEGIN
  IF col = 'zone_id' THEN
    SELECT configuration_id INTO cfg FROM counting_zones WHERE id = (j->>'zone_id')::uuid;
  ELSE
    cfg := (j->>col)::uuid;
  END IF;
  RETURN EXISTS (SELECT 1 FROM analysis_configurations WHERE id = cfg AND locked_at IS NOT NULL);
END $$;

-- TG_ARGV[0] names the column that holds the configuration id (see the helper above).
-- INSERT: refused if the new row belongs to a locked configuration.
-- UPDATE: checked for BOTH the old row and the new row, so a row cannot be moved out of
--   (or into) a locked configuration by changing configuration_id or zone_id.
-- DELETE: refused if locked, except during the purge (SET LOCAL jr.purge = 'on', see 9.4 and O76).
CREATE FUNCTION jr_forbid_locked_child_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('jr.purge', true) = 'on' THEN RETURN OLD; END IF;
    IF jr_row_cfg_locked(TG_ARGV[0], to_jsonb(OLD)) THEN
      RAISE EXCEPTION 'a locked configuration cannot be changed; make a new version' USING ERRCODE = 'check_violation'; END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF jr_row_cfg_locked(TG_ARGV[0], to_jsonb(OLD)) OR jr_row_cfg_locked(TG_ARGV[0], to_jsonb(NEW)) THEN
      RAISE EXCEPTION 'a locked configuration cannot be changed; make a new version' USING ERRCODE = 'check_violation'; END IF;
    RETURN NEW;
  ELSE
    IF jr_row_cfg_locked(TG_ARGV[0], to_jsonb(NEW)) THEN
      RAISE EXCEPTION 'a locked configuration cannot be changed; make a new version' USING ERRCODE = 'check_violation'; END IF;
    RETURN NEW;
  END IF;
END $$;
CREATE TRIGGER zones_locked_trg BEFORE INSERT OR UPDATE OR DELETE ON counting_zones
  FOR EACH ROW EXECUTE FUNCTION jr_forbid_locked_child_row('configuration_id');
CREATE TRIGGER lines_locked_trg BEFORE INSERT OR UPDATE OR DELETE ON counting_lines
  FOR EACH ROW EXECUTE FUNCTION jr_forbid_locked_child_row('configuration_id');
CREATE TRIGGER points_locked_trg BEFORE INSERT OR UPDATE OR DELETE ON zone_points
  FOR EACH ROW EXECUTE FUNCTION jr_forbid_locked_child_row('zone_id');

-- 9.5 Audit rows are never updated, deleted or truncated: row triggers for update and delete,
-- a statement trigger for truncate. These do NOT bind the table owner or a superuser, who can
-- drop or disable a trigger. They protect only an app that does not connect as the owner (9.6).
CREATE FUNCTION jr_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = 'insufficient_privilege'; END $$;
CREATE TRIGGER audit_no_change_trg BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION jr_audit_append_only();
CREATE TRIGGER audit_no_truncate_trg BEFORE TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION jr_audit_append_only();

-- 9.6 ROLE GRANTS (P7). RUN ONCE BY THE DATABASE OWNER, AFTER the two roles exist (O71; names jr_app
-- and jr_worker are placeholders). Create the roles first, for example CREATE ROLE jr_app LOGIN PASSWORD '...';
-- (set the password outside this file; never write a password here). Commented out because the roles do
-- not exist yet. Until they exist and the app connects as jr_app (not as the owner), the audit table is
-- protected by the triggers above only, and the owner is not bound.
-- GRANT USAGE ON SCHEMA public TO jr_app, jr_worker;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jr_app, jr_worker;
-- REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM jr_app, jr_worker;
-- (audit_events keeps SELECT and INSERT from the line above; the id is a GENERATED identity, which needs no sequence grant.)

-- 9.7 ORGANISATION PURGE (O73, O76). COMMENTED EXAMPLE, not run by this file. The service runs it
-- as ONE transaction, only from the purge routine, after an owner's explicit confirmation. Replace
-- :org with the organisation id. The first statement lets the lock triggers in 9.4 allow DELETEs.
-- SET LOCAL ends by itself at COMMIT or ROLLBACK, so the setting never leaks to later work.
-- BEGIN;
-- SET LOCAL jr.purge = 'on';
-- (write one audit_events row first; audit rows are never deleted)
-- DELETE FROM count_buckets  WHERE job_id IN (SELECT id FROM jobs WHERE organization_id = :org);
-- DELETE FROM job_results    WHERE job_id IN (SELECT id FROM jobs WHERE organization_id = :org);
-- DELETE FROM job_artifacts  WHERE job_id IN (SELECT id FROM jobs WHERE organization_id = :org);   -- and the stored files
-- DELETE FROM report_files   WHERE report_id IN (SELECT id FROM reports WHERE organization_id = :org);
-- DELETE FROM reports        WHERE organization_id = :org;
-- DELETE FROM job_events     WHERE job_id IN (SELECT id FROM jobs WHERE organization_id = :org);
-- DELETE FROM job_attempts   WHERE job_id IN (SELECT id FROM jobs WHERE organization_id = :org);
-- UPDATE jobs SET rerun_of_job_id = NULL WHERE organization_id = :org AND rerun_of_job_id IS NOT NULL;
-- DELETE FROM jobs           WHERE organization_id = :org;
-- configurations point to earlier versions (based_on_id): delete the ones no other configuration
-- is based on, and repeat this one statement until it deletes 0 rows. Zones, points and lines cascade.
-- DELETE FROM analysis_configurations c WHERE c.organization_id = :org
--   AND NOT EXISTS (SELECT 1 FROM analysis_configurations d WHERE d.based_on_id = c.id);
-- DELETE FROM uploads        WHERE organization_id = :org;   -- and the stored files
-- DELETE FROM projects       WHERE organization_id = :org;
-- DELETE FROM organizations  WHERE id = :org;                -- members, invites, notifications cascade
-- COMMIT;

-- ---------- 10. OPTIONAL settings seed ----------
-- Optional. null means "not decided"; the service must refuse to start a feature whose value is null
-- or fall back to the documented default. Remove this block if you prefer to set values by hand.
INSERT INTO settings (key, value, note) VALUES
  ('upload.max_bytes', NULL, 'O8 not decided; the old 20 GB code default is not accepted without asking'),
  ('upload.max_duration_seconds', NULL, 'O8 not decided; unit of MAX_VIDEO_LENGTH unknown'),
  ('retention.source_days', NULL, 'O10 not decided, no default'), ('retention.output_days', NULL, 'O10 not decided, no default'),
  ('retention.result_days', NULL, 'O10 not decided, no default'), ('retention.audit_days', NULL, 'O10 not decided, no default'),
  ('retention.notification_days', NULL, 'O10 not decided, no default')
ON CONFLICT (key) DO NOTHING;

COMMIT;
