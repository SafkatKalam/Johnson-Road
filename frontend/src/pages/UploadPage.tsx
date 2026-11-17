import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  Film,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  MapPin,
  Settings2,
  Camera,
  Check,
  ArrowRight,
  ArrowLeft,
  Crosshair,
  Ruler,
  ClipboardCheck,
  Rocket,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge, ProgressBar } from '@/components/ui';
import { WizardStepper, WizardProgress } from '@/components/shared/WizardStepper';
import { DetectionZoneCanvas } from '@/components/shared/DetectionZoneCanvas';
import { CountLineCanvas, type CountLine } from '@/components/shared/CountLineCanvas';
import {
  VideoSetupService,
  describeSetupError,
  type ConfigurationOptions,
  type ProjectItem,
  type VideoItem,
} from '@/services/videoSetup.service';
import { formatBytes } from '@/lib/utils';

const wizardSteps = [
  'Project',
  'Upload',
  'Preview',
  'Metadata',
  'Detection Zone',
  'Count Line',
  'Settings',
  'Review',
  'Queue',
];

const ACCEPTED = ['mp4', 'mkv', 'avi'];
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}

interface Meta { cameraId: string; roadName: string; recordedDate: string; recordedStartTime: string; recordedEndTime: string; weather: string; notes: string }
const emptyMeta: Meta = { cameraId: '', roadName: '', recordedDate: '', recordedStartTime: '', recordedEndTime: '', weather: '', notes: '' };

export function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // step 1
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // step 2-3
  const [dragging, setDragging] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const uploadKey = useRef<string>(newKey());
  const inputRef = useRef<HTMLInputElement>(null);
  // step 4
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  // step 5-6
  const [zonePoints, setZonePoints] = useState<{ x: number; y: number }[]>([]);
  const [lines, setLines] = useState<CountLine[]>([]);
  // step 7
  const [options, setOptions] = useState<ConfigurationOptions | null>(null);
  const [model, setModel] = useState('');
  const [tracker, setTracker] = useState('bytetrack');
  const [confidence, setConfidence] = useState(25);
  const [generateReport, setGenerateReport] = useState(true);
  const [annotatedOutput, setAnnotatedOutput] = useState(true);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const jobKey = useRef<string>(newKey());

  const project = projects.find((p) => p.id === selectedProject) ?? null;

  useEffect(() => {
    VideoSetupService.listProjects({ limit: 100 })
      .then((page) => setProjects(page.items))
      .catch((e) => setError(describeSetupError(e)))
      .finally(() => setProjectsLoaded(true));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      VideoSetupService.locationSuggestions(location.trim() || undefined).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [location]);

  // The preview is protected, so it is loaded with the sign-in header and shown from a temporary local address.
  useEffect(() => {
    if (!video || !video.hasPreview) return;
    let url: string | null = null;
    let alive = true;
    VideoSetupService.previewObjectUrl(video.projectId, video.id)
      .then((u) => { url = u; if (alive) setPreviewUrl(u); else URL.revokeObjectURL(u); })
      .catch(() => setPreviewUrl(null));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [video]);

  useEffect(() => {
    if (!video || options) return;
    VideoSetupService.configurationOptions(video.projectId, video.id).then((o) => {
      setOptions(o);
      setModel(o.models[0] ?? '');
      if (o.trackers.includes(String(o.defaults.tracker))) setTracker(String(o.defaults.tracker));
      const c = Number(o.defaults.confidenceThreshold);
      if (c >= 0.1 && c <= 0.95) setConfidence(Math.round(c * 100));
    }).catch((e) => setError(describeSetupError(e)));
  }, [video, options]);

  const pickFile = (list: FileList | null) => {
    setError('');
    if (!list || list.length === 0) return;
    if (list.length > 1) { setError('Upload one video at a time.'); return; }
    const f = list[0];
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED.includes(ext)) { setError('Only .mp4, .mkv and .avi videos are accepted.'); return; }
    // A different video replaces the old one: its drawings and settings no longer apply.
    setPickedFile(f);
    setVideo(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setZonePoints([]);
    setLines([]);
    setSavedVersion(null);
    setMeta(emptyMeta);
    uploadKey.current = newKey();
    jobKey.current = newKey();
    setReached(1);
  };

  const zoneValid = zonePoints.length >= 3;
  const linesValid = lines.length > 0;
  const canProceed =
    step === 0 ? Boolean(selectedProject || newProjectName.trim()) :
    step === 1 ? Boolean(video) :
    step === 4 ? zonePoints.length === 0 || zoneValid :
    step === 5 ? (linesValid || zoneValid) :
    true;

  const frameW = 480;
  const frameH = video ? Math.round((480 * video.heightPx) / video.widthPx) : 270;

  const go = (next: number) => {
    setError('');
    setStep(next);
    setReached((r) => Math.max(r, next));
  };

  const handleNext = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (step === 0) {
        if (!selectedProject) {
          const created = await VideoSetupService.createProject({ name: newProjectName.trim(), location: location.trim() });
          setProjects((p) => [created, ...p]);
          setSelectedProject(created.id);
          setNewProjectName('');
        }
      } else if (step === 1) {
        if (!video) return;
      } else if (step === 3 && video) {
        const body = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.trim() ? v.trim() : null]));
        setVideo(await VideoSetupService.updateVideo(video.projectId, video.id, body));
        if (project && location.trim() !== project.location) {
          const updated = await VideoSetupService.updateProject(project.id, { location: location.trim() });
          setProjects((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
        }
      } else if (step === 6 && video) {
        const saved = await VideoSetupService.saveConfiguration(video.projectId, video.id, {
          model: model || undefined,
          tracker: tracker as 'bytetrack' | 'sort',
          confidenceThreshold: confidence / 100,
          generateReport,
          annotatedOutput,
          lines: lines.map((l, i) => ({ name: `Line ${i + 1}`, start: l.start, end: l.end, direction: l.direction })),
          zones: zoneValid ? [{ name: 'Zone 1', points: zonePoints }] : [],
        });
        setSavedVersion(saved.version);
      }
      go(step + 1);
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setBusy(false);
    }
  };

  const startUpload = async () => {
    if (!pickedFile || !selectedProject || busy) return;
    setError('');
    setBusy(true);
    try {
      const { upload } = await VideoSetupService.uploadVideo(selectedProject, pickedFile, {}, uploadKey.current, setUploadProgress);
      setVideo(upload);
      setMeta({
        cameraId: upload.metadata.cameraId ?? '', roadName: upload.metadata.roadName ?? '', recordedDate: upload.metadata.recordedDate ?? '',
        recordedStartTime: upload.metadata.recordedStartTime?.slice(0, 5) ?? '', recordedEndTime: upload.metadata.recordedEndTime?.slice(0, 5) ?? '',
        weather: upload.metadata.weather ?? '', notes: upload.metadata.notes ?? '',
      });
      setLocation(project?.location ?? location);
    } catch (e) {
      setError(describeSetupError(e));
      uploadKey.current = newKey(); // a refused file gets a fresh key for the next attempt
    } finally {
      setBusy(false);
    }
  };

  const queueJob = async () => {
    if (!video || busy) return;
    setError('');
    setBusy(true);
    try {
      const { job } = await VideoSetupService.queueJob(video.projectId, video.id, jobKey.current);
      navigate(`/job-queue?job=${job.id}`);
    } catch (e) {
      setError(describeSetupError(e));
      setBusy(false);
    }
  };

  const handleBack = () => {
    if (step > 0) go(step - 1);
  };

  const filteredLocations = useMemo(() => suggestions.filter((s) => s !== location).slice(0, 5), [suggestions, location]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Upload Center</h2>
          <p className="mt-1 text-sm text-ink-400">
            {step === wizardSteps.length - 1
              ? 'Ready to queue for analysis'
              : `Step ${step + 1} of ${wizardSteps.length} — ${wizardSteps[step]}`}
          </p>
        </div>
        {video && (
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <Badge tone="brand" dot>1 video ready</Badge>
            <span>{formatBytes(video.sizeBytes)}</span>
          </div>
        )}
      </div>

      {/* Wizard stepper: a step can be revisited, never skipped */}
      <Card padding="md">
        <WizardStepper steps={wizardSteps} current={step} onStepClick={(i: number) => { if (i <= reached && !busy) go(i); }} />
        <div className="mt-3"><WizardProgress steps={wizardSteps} current={step} /></div>
      </Card>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {/* STEP 1: Choose Project */}
          {step === 0 && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Card padding="lg">
                <CardHeader title="Choose a project" subtitle="Select an existing project or create a new one" icon={<FolderIcon />} />
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-medium text-ink-200">Existing projects</p>
                  {projectsLoaded && projects.length === 0 && <p className="text-xs text-ink-400">No projects yet. Create one below.</p>}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProject(p.id); setNewProjectName(''); setLocation(p.location); }}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                          selectedProject === p.id
                            ? 'border-brand-500/40 bg-brand-500/[0.06]'
                            : 'border-white/[0.05] bg-ink-900/40 hover:border-white/10'
                        }`}
                      >
                        <div className={`h-8 w-8 shrink-0 rounded-lg ${selectedProject === p.id ? 'bg-brand-500/15' : 'bg-white/[0.04]'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-100">{p.name}</p>
                          <p className="truncate text-xs text-ink-400">{p.location || 'No location'}</p>
                        </div>
                        {selectedProject === p.id && <Check size={16} className="text-brand-400" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.06] pt-4">
                    <p className="mb-2 text-xs font-medium text-ink-200">Or create new</p>
                    <Input
                      placeholder="New project name"
                      value={newProjectName}
                      maxLength={120}
                      onChange={(e) => { setNewProjectName(e.target.value); setSelectedProject(''); }}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 2: Upload one video */}
          {step === 1 && (
            <Card padding="none">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) pickFile(e.dataTransfer.files); }}
                onClick={() => { if (!busy) inputRef.current?.click(); }}
                className={`relative m-4 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
                  dragging ? 'border-brand-500/60 bg-brand-500/[0.06]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                }`}
              >
                <input ref={inputRef} type="file" accept=".mp4,.mkv,.avi,video/mp4,video/x-matroska,video/x-msvideo" className="hidden"
                  onChange={(e) => { pickFile(e.target.files); e.target.value = ''; }} />
                <motion.div animate={dragging ? { y: -4 } : { y: 0 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 text-brand-300 ring-1 ring-brand-500/20">
                  <UploadCloud size={30} strokeWidth={1.8} />
                </motion.div>
                <p className="mt-4 text-sm font-medium text-white">{dragging ? 'Release to choose this video' : 'Drag & drop one video file here'}</p>
                <p className="mt-1 text-xs text-ink-400">or <span className="text-brand-300 underline-offset-2 hover:underline">browse files</span> · MP4, MKV, AVI · one video per analysis</p>
              </div>
              {pickedFile && (
                <div className="space-y-2 px-4 pb-4">
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
                      <FileVideo size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-ink-100">{pickedFile.name}</p>
                        <span className="shrink-0 text-xs text-ink-400">{formatBytes(pickedFile.size)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        {video ? (
                          <span className="flex items-center gap-1 text-xs text-brand-300"><CheckCircle2 size={12} /> Checked and ready</span>
                        ) : busy ? (
                          <div className="flex-1"><ProgressBar value={uploadProgress} size="sm" tone="sky" /></div>
                        ) : (
                          <span className="text-xs text-ink-400">Not uploaded yet</span>
                        )}
                        {busy && uploadProgress >= 100 && !video && <span className="text-xs text-ink-400">Checking the video…</span>}
                      </div>
                    </div>
                    {!video && (
                      <Button size="sm" onClick={startUpload} disabled={busy} leftIcon={busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}>
                        {busy ? 'Uploading…' : 'Upload'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STEP 3: Preview (real frame and measured details) */}
          {step === 2 && video && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title={video.name} subtitle="Measured from the uploaded file" icon={<Film size={16} />} />
                <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-ink-950/60" style={{ aspectRatio: `${video.widthPx}/${video.heightPx}` }}>
                  {previewUrl ? <img src={previewUrl} alt={`First frame of ${video.name}`} className="h-full w-full object-contain" /> : null}
                </div>
                <div className="mt-4 space-y-2">
                  <ReviewRow label="Duration" value={formatDuration(video.durationSeconds)} />
                  <ReviewRow label="Resolution" value={`${video.widthPx}×${video.heightPx}`} />
                  <ReviewRow label="Frame rate" value={`${video.frameRate} fps`} />
                  <ReviewRow label="Size" value={formatBytes(video.sizeBytes)} />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 4: Metadata */}
          {step === 3 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Video metadata" subtitle="Camera and recording information (all optional)" icon={<Camera size={16} />} />
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Project" value={project?.name ?? ''} readOnly />
                  <Input label="Camera ID" placeholder="e.g. CAM-NB-014" maxLength={100} value={meta.cameraId} onChange={(e) => setMeta({ ...meta, cameraId: e.target.value })} />
                  <Input label="Road name" placeholder="Street or junction" maxLength={200} leftIcon={<MapPin size={15} />} value={meta.roadName} onChange={(e) => setMeta({ ...meta, roadName: e.target.value })} />
                  <div className="relative">
                    <label className="mb-1.5 block text-xs font-medium text-ink-200">Location</label>
                    <Input placeholder="City, Country" maxLength={200} leftIcon={<MapPin size={15} />} value={location} onChange={(e) => setLocation(e.target.value)} />
                    {location && filteredLocations.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-ink-850 shadow-pop">
                        {filteredLocations.map((s) => (
                          <button key={s} onClick={() => setLocation(s)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 transition-colors hover:bg-white/[0.06]">
                            <MapPin size={13} className="text-ink-400" /> {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input label="Recording date" type="date" value={meta.recordedDate} onChange={(e) => setMeta({ ...meta, recordedDate: e.target.value })} />
                  <Input label="Start time (camera clock)" type="time" value={meta.recordedStartTime} onChange={(e) => setMeta({ ...meta, recordedStartTime: e.target.value })} />
                  <Input label="End time (camera clock)" type="time" value={meta.recordedEndTime} onChange={(e) => setMeta({ ...meta, recordedEndTime: e.target.value })} />
                  <Select label="Weather (optional)" value={meta.weather} onChange={(e) => setMeta({ ...meta, weather: e.target.value })}>
                    <option value="">Not set</option>
                    <option>Clear</option>
                    <option>Cloudy</option>
                    <option>Rain</option>
                    <option>Fog</option>
                    <option>Snow</option>
                    <option>Unknown</option>
                  </Select>
                  <div className="sm:col-span-2">
                    <label htmlFor="upload-notes" className="mb-1.5 block text-xs font-medium text-ink-200">Notes (optional)</label>
                    <textarea
                      id="upload-notes"
                      rows={3}
                      maxLength={2000}
                      value={meta.notes}
                      onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
                      placeholder="Any additional notes about this recording…"
                      className="w-full resize-none rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 5: Detection Zone */}
          {step === 4 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Detection zone" subtitle="Optional with counting lines: draw a polygon (at least 3 points)" icon={<Crosshair size={16} />} />
                <div className="mt-5">
                  <DetectionZoneCanvas width={frameW} height={frameH} imageUrl={previewUrl} value={zonePoints} onChange={setZonePoints} />
                </div>
                {zonePoints.length > 0 && !zoneValid && <p className="mt-3 text-xs text-warn-400">A zone needs at least 3 points, or clear it.</p>}
              </Card>
            </div>
          )}

          {/* STEP 6: Count Line */}
          {step === 5 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Count line" subtitle="Draw counting lines and set traffic direction" icon={<Ruler size={16} />} />
                <div className="mt-5">
                  <CountLineCanvas width={frameW} height={frameH} imageUrl={previewUrl} value={lines} onChange={setLines} />
                </div>
                {!linesValid && !zoneValid && <p className="mt-3 text-xs text-warn-400">Add at least one counting line or a detection zone.</p>}
              </Card>
            </div>
          )}

          {/* STEP 7: Analysis Settings (only what the server supports) */}
          {step === 6 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Analysis settings" subtitle="Configure the AI processing pipeline" icon={<Settings2 size={16} />} />
                <div className="mt-5 space-y-4">
                  <Select label="Detection model" value={model} onChange={(e) => setModel(e.target.value)}>
                    {(options?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                  <Select label="Tracking algorithm" value={tracker} onChange={(e) => setTracker(e.target.value)}>
                    {(options?.trackers ?? ['bytetrack']).map((t) => <option key={t} value={t}>{t === 'bytetrack' ? 'ByteTrack' : t === 'sort' ? 'SORT' : t}</option>)}
                  </Select>
                  <div>
                    <label htmlFor="confidence" className="mb-1.5 block text-xs font-medium text-ink-200">
                      Confidence threshold: <span className="font-mono text-brand-300">{(confidence / 100).toFixed(2)}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="confidence"
                        type="range"
                        min={10}
                        max={95}
                        value={confidence}
                        onChange={(e) => setConfidence(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-brand-500"
                      />
                      <span className="w-12 text-right font-mono text-sm font-medium text-white">{(confidence / 100).toFixed(2)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500">
                      <span>Lower = more detections</span>
                      <span>·</span>
                      <span>Higher = fewer false positives</span>
                    </div>
                  </div>
                  <ToggleRow label="Generate report" desc="Mark this analysis for a report" on={generateReport} onToggle={() => setGenerateReport(!generateReport)} />
                  <ToggleRow label="Annotated video" desc="Save a copy of the video with boxes and lines drawn on it" on={annotatedOutput} onToggle={() => setAnnotatedOutput(!annotatedOutput)} />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 8: Review (real values only) */}
          {step === 7 && video && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Card padding="lg">
                <CardHeader title="Review configuration" subtitle="Confirm before queueing for analysis" icon={<ClipboardCheck size={16} />} />
                <div className="mt-5 space-y-3">
                  <ReviewRow label="Project" value={project?.name ?? '—'} />
                  <ReviewRow label="Video" value={`${video.name} (${formatBytes(video.sizeBytes)}, ${formatDuration(video.durationSeconds)})`} />
                  <ReviewRow label="Camera" value={video.metadata.cameraId || '—'} />
                  <ReviewRow label="Location" value={location || '—'} />
                  <ReviewRow label="Detection model" value={`${model} + ${tracker === 'sort' ? 'SORT' : 'ByteTrack'}`} />
                  <ReviewRow label="Confidence threshold" value={(confidence / 100).toFixed(2)} />
                  <ReviewRow label="Annotated video" value={annotatedOutput ? 'Yes' : 'No'} />
                  <ReviewRow label="Detection zone" value={zoneValid ? `1 polygon (${zonePoints.length} points)` : 'None'} />
                  <ReviewRow label="Count lines" value={lines.length ? `${lines.length} line(s): ${lines.map((l) => l.direction).join(', ')}` : 'None'} />
                  <ReviewRow label="Saved settings" value={savedVersion ? `Version ${savedVersion}` : '—'} />
                </div>
              </Card>
              <div className="rounded-xl border border-white/[0.08] bg-ink-900/40 p-4">
                <p className="text-sm text-ink-200">Processing time depends on the video and the server; it is shown on the Job Queue once processing starts.</p>
                <p className="mt-1 text-xs text-ink-400">Counts are estimates.</p>
              </div>
            </div>
          )}

          {/* STEP 9: Queue */}
          {step === 8 && video && (
            <div className="mx-auto max-w-lg">
              <Card padding="lg">
                <div className="py-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20"
                  >
                    <CheckCircle2 size={32} />
                  </motion.div>
                  <h3 className="mt-4 text-base font-semibold text-white">Ready to queue</h3>
                  <p className="mt-2 text-sm text-ink-400">
                    {video.name} will be processed with {model} + {tracker === 'sort' ? 'SORT' : 'ByteTrack'}.
                  </p>
                  <p className="mt-2 text-xs text-ink-400">Its queue position is shown on the Job Queue after queueing.</p>
                  <Button size="lg" className="mt-6 w-full" leftIcon={busy ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />} onClick={queueJob} disabled={busy}>
                    {busy ? 'Queueing…' : 'Queue for Analysis'}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      {step < wizardSteps.length - 1 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" leftIcon={<ArrowLeft size={15} />} onClick={handleBack} disabled={step === 0 || busy}>
            Back
          </Button>
          <Button rightIcon={busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} onClick={handleNext} disabled={!canProceed || busy}>
            {step === wizardSteps.length - 2 ? 'Review & Queue' : 'Continue'}
          </Button>
        </div>
      )}
    </div>
  );
}

function FolderIcon() {
  return <Film size={16} />;
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 px-3 py-2.5">
      <div>
        <div className="text-sm text-ink-100">{label}</div>
        <div className="text-xs text-ink-400">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-white/[0.1]'}`}
      >
        <motion.span
          layout
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: on ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-2 text-sm">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className="truncate text-right font-medium text-ink-100">{value}</span>
    </div>
  );
}
