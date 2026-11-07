# Johnson Road Blueprint

## 1. Product summary

Johnson Road is a video-analytics platform for road, traffic, and site
operations teams. A user uploads a road video, configures an analysis, and
receives detections, counts, tracking results, visual evidence, processing
status, and exportable reports from one workspace.

The product combines:

- A React and TypeScript web application for authentication, projects,
  uploads, processing, dashboards, and reports.
- A FastAPI service for application APIs, persistence, uploads, and job
  orchestration.
- A Python computer-vision pipeline using YOLO detection, configurable object
  tracking, frame reading, analytics, and generated output media.
- SQLite for local development, with a path to a managed relational database
  and object storage for production.

## 2. Objective

### Primary objective

Turn raw road video into trustworthy, reviewable, and actionable traffic
intelligence with a workflow that a non-technical operations user can complete
without writing code.

### Business objectives

1. Reduce the time required to review road footage manually.
2. Provide repeatable vehicle and object counts across projects and time
   periods.
3. Make every result traceable to its source video, configuration, and
   processing run.
4. Support team-based operational decisions through dashboards and reports.
5. Establish an extensible foundation for new detectors, trackers, analytics,
   and integrations.

### Success measures

- A new user can sign up, create a project, upload a supported video, and
  start processing without assistance.
- Users can understand job state and errors without inspecting server logs.
- Completed analyses include counts, visual evidence, metadata, and a
  downloadable report.
- Re-running the same input with the same configuration produces a
  reproducible result within the accepted tolerance of the selected model.
- The system handles failed, cancelled, oversized, and unsupported uploads
  explicitly.

## 3. User personas

### Primary persona: Traffic operations analyst

Reviews road footage to understand traffic volume, vehicle mix, congestion,
and movement patterns. Needs fast setup, defensible counts, filters, visual
verification, and report exports.

### Secondary persona: Road project manager

Monitors multiple sites and reporting periods. Needs project-level status,
summary KPIs, comparisons, deadlines, and clear stakeholder-ready outputs.

### Secondary persona: Transport or municipal decision-maker

Consumes reports rather than configuring models. Needs concise trends, evidence,
confidence context, and recommendations that can support planning decisions.

### Administrative persona: Organization administrator

Manages members, access, billing, settings, retention, and support. Needs
secure controls and visibility into usage and processing health.

## 4. Target audience

- Municipal and regional transportation departments.
- Traffic engineering and road safety consultancies.
- Construction and infrastructure project teams.
- Private road, campus, and facility operators.
- Research and planning teams analyzing traffic behavior.
- Organizations that need auditable video-based counts but do not want to
  build and maintain a computer-vision pipeline.

The initial audience should prioritize teams with recurring video-analysis
needs, a small number of analysts, and a requirement for repeatable reports.

## 5. Product scope

### In scope

- Account registration, login, email verification, and password recovery.
- Organization and profile management.
- Projects and project detail views.
- Video upload and validation.
- Processing job creation, queue visibility, progress, cancellation, and
  failure states.
- Detection, tracking, counting, zones, and time-based analytics.
- Annotated video or frame evidence.
- Dashboard KPIs and trend visualizations.
- Reports, filtering, export, and sharing-ready summaries.
- Settings, support, billing placeholders, and operational notifications.

### Out of scope for the first production release

- Real-time camera streaming.
- Fully automated enforcement or legally binding decisions.
- Face recognition, license-plate recognition, or identity inference.
- Autonomous traffic-control actions.
- Multi-region distributed processing before usage requires it.
- Custom model training inside the customer-facing product.

## 6. Detailed feature plan

### Authentication and onboarding

- Register and validate email.
- Log in and log out securely.
- Recover and reset passwords.
- Protect authenticated routes.
- Collect organization and user profile basics during onboarding.
- Display actionable validation and server errors.

### Organization and profile

- View and edit personal profile.
- Manage organization name and preferences.
- Invite members and assign roles.
- Show usage and plan limits.
- Keep account, organization, and project permissions separate.

### Projects

- Create, rename, archive, and view projects.
- Store project location, description, owner, and analysis defaults.
- Show recent uploads, processing runs, KPIs, and report history.
- Search and filter projects.
- Preserve project-level audit history.

### Uploads

- Accept supported video formats with size and duration validation.
- Show upload progress and retry behavior.
- Store source metadata: filename, size, duration, resolution, frame rate,
  checksum, and upload time.
- Reject invalid files with a clear reason.
- Keep source files isolated from generated outputs.
- Support future image and batch-upload workflows without coupling the UI to
  a particular storage provider.

### Analysis configuration

- Select detector and tracker strategy.
- Configure confidence and IoU thresholds.
- Configure frame sampling, batch size, and maximum duration.
- Define counting lines and detection zones.
- Select classes of interest.
- Save a versioned configuration with each processing job.

### Processing

- Create a queued job from an uploaded source and configuration.
- Display queued, running, completed, failed, and cancelled states.
- Show progress, frames processed, elapsed time, and estimated time remaining
  where available.
- Allow cancellation when the worker supports safe interruption.
- Retry transient failures without duplicating final results.
- Persist structured errors and a correlation/job identifier.

### Computer vision and analytics

- Read video frames consistently and report source metadata.
- Run configurable YOLO detection.
- Use a tracker abstraction so ByteTrack, BoT-SORT, SORT, and future trackers
  can be selected independently.
- Associate detections with stable track IDs.
- Count crossings over configured lines.
- Aggregate counts by class, direction, time interval, and zone.
- Preserve confidence scores and source-frame references.
- Generate annotated frames and output video when enabled.
- Provide detector and tracker health information in service diagnostics.

### Dashboard

- Show total projects, active jobs, completed analyses, and recent activity.
- Show traffic totals and class breakdowns.
- Show time-series trends and comparisons.
- Link every KPI to the underlying project or report.
- Handle loading, empty, stale, and error states explicitly.

### Reports

- Create a report from a completed analysis.
- Include methodology, input metadata, configuration, counts, trends, and
  evidence.
- Filter by project, period, class, direction, and zone.
- Export a stable report format such as CSV and PDF.
- Include generated-at timestamp and analysis version.
- Make report generation idempotent and traceable.

### Notifications and support

- Notify users when uploads and jobs complete or fail.
- Show unread and historical notifications.
- Provide support contact and troubleshooting guidance.
- Avoid exposing internal stack traces or credentials in user-facing messages.

## 7. Technical architecture

```text
Browser
  |
  | React + TypeScript + Tailwind + React Router
  v
Frontend service layer
  |
  | Axios / authenticated API requests
  v
FastAPI application
  |
  +-- Routers/API schemas
  +-- Services/use cases
  +-- Repositories
  +-- SQLite now; managed relational DB later
  +-- Local storage now; object storage later
  |
  v
Processing orchestration
  |
  +-- Job queue and worker boundary
  +-- Frame reader
  +-- Detector factory
  +-- Tracker factory
  +-- Counting and analytics
  +-- Annotated media and report generation
```

### Frontend layers

- `pages/`: route-level composition and page state.
- `components/`: reusable UI, layouts, shared visualizations, and controls.
- `services/`: API-facing promise-based service modules.
- `types/`: shared domain types for compile-time safety.
- `lib/`: authentication, Supabase client, helpers, and mock data.
- `data/`: local seed and fallback data used by the current UI.

Pages should not fetch directly. New API calls belong in a service and should
return typed data. Shared components should be reused instead of duplicated.

### Backend layers

- `routers/`: HTTP transport and request/response boundaries.
- `schemas/`: Pydantic request and response contracts.
- `services/`: business workflows and orchestration.
- `repositories/`: persistence access.
- `database/`: engine, session, and models.
- `ai/`: detector, tracker, frame, pipeline, analytics, and runtime
  abstractions.
- `core/`: application configuration and shared infrastructure.

### Data model direction

Core entities should be versionable and traceable:

- User
- Organization
- Project
- Upload
- ProcessingJob
- AnalysisConfiguration
- Detection/Track aggregate
- CountingZone or CountingLine
- Report
- Notification
- AuditEvent

Every processing result should reference its source upload, configuration
version, model version, and job identifier.

### Environment and configuration

Local defaults are defined in the root `.env` template. The frontend consumes
`VITE_*` variables. The backend consumes AI variables from the process
environment. Production deployments must inject secrets through the platform's
secret manager rather than committing them.

Important configuration groups:

- API URL and CORS origins.
- Supabase URL and public client key.
- Database and storage providers.
- Detector, model path, device, tracker, thresholds, and sampling.
- Upload limits and processing timeouts.
- Logging, timing, warmup, and observability.

## 8. End-to-end workflow

1. User registers or logs in.
2. User completes onboarding and enters an organization workspace.
3. User creates or selects a project.
4. User uploads a source video.
5. The API validates file type, size, duration, and metadata.
6. The upload is stored and represented as a project asset.
7. User chooses analysis settings, zones, lines, and classes.
8. The API creates a versioned processing job and queues it.
9. A worker loads the configured detector and tracker.
10. The pipeline reads frames, detects objects, updates tracks, applies zones
    and line crossings, and aggregates analytics.
11. The worker stores progress and intermediate/final artifacts.
12. The UI polls or subscribes to job status and renders progress.
13. On success, the system exposes counts, visual evidence, and report data.
14. The user reviews results, filters insights, and exports a report.
15. The system records audit metadata and retains the result according to the
    organization's retention policy.

Failure workflow:

1. Validate early and fail before expensive processing where possible.
2. Mark the job as failed or cancelled, never silently as completed.
3. Store a safe user-facing message and an internal diagnostic reference.
4. Allow retry only when the failure is retryable.
5. Preserve the failed attempt for audit and troubleshooting.

## 9. Delivery roadmap and sprint plan

Each sprint should end with a demonstrable increment, passing checks, updated
documentation, and a short review of risks and metrics.

### Sprint 0: Foundation and alignment

- Confirm product scope, personas, terminology, and acceptance criteria.
- Establish environment handling and local run instructions.
- Confirm API conventions, error shape, logging, and route protection.
- Baseline frontend build, lint, typecheck, and backend health checks.

### Sprint 1: Authentication and organization

- Complete login, registration, verification, recovery, and protected routes.
- Implement user profile and organization onboarding.
- Define roles and permission checks.
- Add loading, empty, and error states.

### Sprint 2: Projects and upload foundations

- Complete project CRUD and project detail.
- Add upload validation, progress, metadata, and storage abstraction.
- Connect frontend services to backend endpoints.
- Add upload failure and retry UX.

### Sprint 3: Processing pipeline

- Finalize job schema and lifecycle.
- Connect queue/worker boundary to the existing AI runtime.
- Add detector and tracker configuration.
- Persist progress and structured failures.
- Add processing page with cancellation where supported.

### Sprint 4: Counting and analytics

- Implement lines, zones, crossing counts, class aggregates, and time buckets.
- Add annotated evidence and output artifact metadata.
- Validate repeatability with representative sample videos.
- Surface model and configuration versions.

### Sprint 5: Dashboard and reports

- Connect dashboard KPIs and trend charts to real services.
- Implement report generation and CSV/PDF export.
- Add report filters, methodology, evidence, and timestamps.
- Validate that dashboard values reconcile with report values.

### Sprint 6: Reliability, security, and operations

- Add authorization checks to every organization-scoped operation.
- Add rate limits, file safety checks, retention controls, and audit events.
- Add structured logs, metrics, tracing, and job retry policies.
- Test large files, malformed files, worker restarts, and partial failures.

### Sprint 7: Production readiness

- Move production persistence and media to managed services.
- Add CI for lint, typecheck, unit, integration, and smoke tests.
- Build deployment images and environment-specific configuration.
- Run accessibility, performance, backup/restore, and disaster-recovery
  checks.
- Conduct user acceptance testing with representative customers.

## 10. Quality strategy

### Frontend

- TypeScript compilation with strict settings.
- ESLint on all changed frontend files.
- Component and service tests for important states and transformations.
- Route smoke tests for authentication and core workflows.
- Accessibility checks for keyboard navigation, labels, focus, and contrast.

### Backend

- Unit tests for services, repositories, schemas, and AI analytics.
- API tests for validation, authorization, status transitions, and errors.
- Pipeline tests using short deterministic fixtures.
- Test detector/tracker factories independently from model execution.
- Verify migrations and database constraints.

### End-to-end acceptance

- Register -> create project -> upload -> configure -> process -> review ->
  export.
- Invalid upload -> useful validation error.
- Worker failure -> failed job -> diagnostic reference -> retry.
- Unauthorized organization access -> rejected request.
- Refresh during processing -> state remains correct.

## 11. Security, privacy, and responsible AI

- Never commit secrets, service keys, model credentials, or private media.
- Treat uploaded video as untrusted input.
- Validate file type by content as well as filename and enforce size/duration
  limits.
- Scope every project, upload, job, and report to an authorized organization.
- Use least-privilege storage access and signed URLs where appropriate.
- Encrypt data in transit and at rest in production.
- Define retention and deletion behavior for source and generated media.
- Do not use face recognition, identity inference, or license-plate
  recognition without explicit product, legal, and consent review.
- Present model outputs as estimates with confidence and methodology context.
- Provide human review paths for consequential decisions.

## 12. Observability and operations

Track:

- Request latency, error rate, and response status by route.
- Upload success/failure and validation reasons.
- Queue depth, job duration, throughput, retries, and cancellation rate.
- Frames processed per second and detector/tracker errors.
- Storage usage and report generation time.
- Model version, configuration version, and runtime device for each job.

Operational requirements:

- Health endpoint for service and AI runtime readiness.
- Correlation IDs across API request, job, worker, and artifacts.
- Structured logs with secrets and personal data redacted.
- Alerts for queue growth, repeated worker failures, storage exhaustion, and
  elevated API errors.
- Document backup, restore, rollback, and incident-response procedures.

## 13. Definition of done

A feature is done when:

1. The user-facing behavior and error states are implemented.
2. Types, API schemas, and persistence contracts are updated together.
3. Authorization and data ownership are enforced.
4. Tests cover the important success and failure paths.
5. Frontend lint and typecheck pass.
6. Backend tests and health checks pass.
7. Relevant documentation and environment variables are updated.
8. Logs and metrics make failures diagnosable.
9. No secrets or generated media are added to version control.

## 14. Immediate next actions

1. Add a tracked `.env.example` derived from the local `.env` without secrets.
2. Make backend settings load environment variables consistently, including
   API name, prefix, CORS, and database configuration.
3. Add a root development command or documented commands for starting both
   services.
4. Replace remaining mock service paths with typed API integrations.
5. Add automated tests around upload validation and processing state
   transitions.
6. Define the production storage, queue, database, and authentication choices.
7. Establish representative, consented video fixtures for deterministic
   pipeline tests.
