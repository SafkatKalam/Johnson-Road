import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  Film,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileVideo,
  MapPin,
  Settings2,
  Cpu,
  Trash2,
  Camera,
  Play,
  Check,
  ArrowRight,
  ArrowLeft,
  Eye,
  Crosshair,
  Ruler,
  ClipboardCheck,
  Rocket,
  Calendar,
  Cloud,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge, ProgressBar } from '@/components/ui';
import { WizardStepper, WizardProgress } from '@/components/shared/WizardStepper';
import { VideoPreview } from '@/components/shared/VideoPreview';
import { DetectionZoneCanvas } from '@/components/shared/DetectionZoneCanvas';
import { CountLineCanvas } from '@/components/shared/CountLineCanvas';
import { projects } from '@/services/project.service';
import { initialUploadFiles, locationSuggestions, type UploadFile } from '@/services/upload.service';
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

const statusConfig = {
  done: { icon: CheckCircle2, tone: 'text-brand-300', label: 'Uploaded' },
  uploading: { icon: Clock, tone: 'text-accent-400', label: 'Uploading' },
  queued: { icon: Clock, tone: 'text-warn-400', label: 'Queued' },
  error: { icon: AlertCircle, tone: 'text-err-400', label: 'Failed' },
} as const;

export function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>(initialUploadFiles);
  const [selectedProject, setSelectedProject] = useState('');
  const [confidence, setConfidence] = useState(45);
  const [generateReport, setGenerateReport] = useState(true);
  const [anonymizePlates, setAnonymizePlates] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [location, setLocation] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: UploadFile[] = Array.from(fileList).map((f, i) => ({
      id: `new-${Date.now()}-${i}`,
      name: f.name || `untitled_${i}.mp4`,
      size: f.size || 5_000_000_000,
      duration: '8h 00m',
      resolution: '1920×1080',
      fps: 30,
      progress: 0,
      status: 'queued',
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (id: string) => setFiles((q) => q.filter((f) => f.id !== id));

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const uploaded = files.filter((f) => f.status === 'done').length;
  const canProceed = step === 0 ? (selectedProject || newProjectName) : step === 1 ? files.length > 0 : true;
  const filteredLocations = useMemo(
    () => !location.trim() ? locationSuggestions.slice(0, 5) : locationSuggestions.filter((s) => s.toLowerCase().includes(location.toLowerCase())).slice(0, 5),
    [location],
  );

  const handleNext = () => {
    if (step < wizardSteps.length - 1) {
      setStep(step + 1);
    } else {
      navigate('/job-queue');
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

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
        {files.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <Badge tone="brand" dot pulse>{uploaded}/{files.length} uploaded</Badge>
            <span>{formatBytes(totalSize)} total</span>
          </div>
        )}
      </div>

      {/* Wizard stepper */}
      <Card padding="md">
        <WizardStepper steps={wizardSteps} current={step} onStepClick={setStep} />
        <div className="mt-3"><WizardProgress steps={wizardSteps} current={step} /></div>
      </Card>

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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProject(p.id); setNewProjectName(''); }}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                          selectedProject === p.id
                            ? 'border-brand-500/40 bg-brand-500/[0.06]'
                            : 'border-white/[0.05] bg-ink-900/40 hover:border-white/10'
                        }`}
                      >
                        <div className={`h-8 w-8 shrink-0 rounded-lg ${selectedProject === p.id ? 'bg-brand-500/15' : 'bg-white/[0.04]'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-100">{p.name}</p>
                          <p className="truncate text-xs text-ink-400">{p.location}</p>
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
                      onChange={(e) => { setNewProjectName(e.target.value); setSelectedProject(''); }}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 2: Upload Videos */}
          {step === 1 && (
            <Card padding="none">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`relative m-4 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
                  dragging ? 'border-brand-500/60 bg-brand-500/[0.06]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                }`}
              >
                <input ref={inputRef} type="file" multiple accept="video/*" className="hidden" onChange={(e) => addFiles(e.target.files)} />
                <motion.div animate={dragging ? { y: -4 } : { y: 0 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 text-brand-300 ring-1 ring-brand-500/20">
                  <UploadCloud size={30} strokeWidth={1.8} />
                </motion.div>
                <p className="mt-4 text-sm font-medium text-white">{dragging ? 'Release to upload' : 'Drag & drop video files here'}</p>
                <p className="mt-1 text-xs text-ink-400">or <span className="text-brand-300 underline-offset-2 hover:underline">browse files</span> · MP4, MKV, AVI · max 12GB each</p>
              </div>
              <div className="space-y-2 px-4 pb-4">
                <AnimatePresence initial={false}>
                  {files.map((file) => {
                    const cfg = statusConfig[file.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <motion.div
                        key={file.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-ink-900/40 p-3 transition-colors hover:border-white/10"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
                          <FileVideo size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-ink-100">{file.name}</p>
                            <span className="shrink-0 text-xs text-ink-400">{formatBytes(file.size)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            {file.status === 'uploading' ? (
                              <div className="flex-1"><ProgressBar value={file.progress} size="sm" tone="sky" /></div>
                            ) : (
                              <span className={`flex items-center gap-1 text-xs ${cfg.tone}`}><StatusIcon size={12} /> {cfg.label}</span>
                            )}
                            <span className="ml-auto shrink-0 text-xs text-ink-500">{file.duration}</span>
                          </div>
                        </div>
                        <button onClick={() => removeFile(file.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 opacity-0 transition-all hover:bg-white/[0.06] hover:text-white group-hover:opacity-100">
                          <X size={14} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </Card>
          )}

          {/* STEP 3: Preview Videos */}
          {step === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((f) => (
                <VideoPreview key={f.id} name={f.name} duration={f.duration} resolution={f.resolution} fps={f.fps} size={formatBytes(f.size)} />
              ))}
              {files.length === 0 && <p className="col-span-full py-10 text-center text-sm text-ink-400">No videos to preview. Go back and upload some.</p>}
            </div>
          )}

          {/* STEP 4: Metadata */}
          {step === 3 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Video metadata" subtitle="Camera and recording information" icon={<Camera size={16} />} />
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Project" placeholder="Project name" defaultValue={selectedProject ? projects.find(p => p.id === selectedProject)?.name : newProjectName} />
                  <Input label="Camera ID" placeholder="e.g. CAM-NB-014" defaultValue="CAM-A406-03" />
                  <Input label="Road name" placeholder="Street or junction" leftIcon={<MapPin size={15} />} defaultValue="A406 North Circular" />
                  <div className="relative">
                    <label className="mb-1.5 block text-xs font-medium text-ink-200">Location</label>
                    <Input placeholder="City, Country" leftIcon={<MapPin size={15} />} value={location} onChange={(e) => setLocation(e.target.value)} onFocus={() => {}} />
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
                  <Input label="Recording date" type="date" defaultValue="2026-07-25" />
                  <Input label="Start time" type="time" defaultValue="00:00" />
                  <Input label="End time" type="time" defaultValue="24:00" />
                  <Select label="Weather (optional)">
                    <option>Clear</option>
                    <option>Cloudy</option>
                    <option>Rain</option>
                    <option>Fog</option>
                    <option>Snow</option>
                    <option>Unknown</option>
                  </Select>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-ink-200">Notes (optional)</label>
                    <textarea
                      rows={3}
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
                <CardHeader title="Detection zone" subtitle="Draw a polygon defining the region where vehicles will be detected" icon={<Crosshair size={16} />} />
                <div className="mt-5">
                  <DetectionZoneCanvas />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 6: Count Line */}
          {step === 5 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Count line" subtitle="Draw counting lines and set traffic direction" icon={<Ruler size={16} />} />
                <div className="mt-5">
                  <CountLineCanvas />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 7: Analysis Settings */}
          {step === 6 && (
            <div className="mx-auto max-w-2xl">
              <Card padding="lg">
                <CardHeader title="Analysis settings" subtitle="Configure the AI processing pipeline" icon={<Settings2 size={16} />} />
                <div className="mt-5 space-y-4">
                  <Select label="Detection model" defaultValue="yolov8x">
                    <option value="yolov8x">YOLOv8x (highest accuracy)</option>
                    <option value="yolov8l">YOLOv8l (balanced)</option>
                    <option value="yolov8m">YOLOv8m (fastest)</option>
                  </Select>
                  <Select label="Tracking algorithm" defaultValue="bytetrack">
                    <option value="bytetrack">ByteTrack</option>
                    <option value="botsort">BoT-SORT</option>
                    <option value="deepsort">DeepSORT</option>
                  </Select>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-200">
                      Confidence threshold: <span className="font-mono text-brand-300">0.{String(confidence).padStart(2, '0')}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={95}
                        value={confidence}
                        onChange={(e) => setConfidence(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-brand-500"
                      />
                      <span className="w-12 text-right font-mono text-sm font-medium text-white">0.{String(confidence).padStart(2, '0')}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500">
                      <span>Lower = more detections</span>
                      <span>·</span>
                      <span>Higher = fewer false positives</span>
                    </div>
                  </div>
                  <ToggleRow label="Generate report" desc="Auto-generate report after analysis" on={generateReport} onToggle={() => setGenerateReport(!generateReport)} />
                  <ToggleRow label="Anonymize plates" desc="Blur license plates for privacy" on={anonymizePlates} onToggle={() => setAnonymizePlates(!anonymizePlates)} />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 8: Review */}
          {step === 7 && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Card padding="lg">
                <CardHeader title="Review configuration" subtitle="Confirm before queueing for analysis" icon={<ClipboardCheck size={16} />} />
                <div className="mt-5 space-y-3">
                  <ReviewRow label="Project" value={selectedProject ? projects.find(p => p.id === selectedProject)?.name ?? '—' : newProjectName || '—'} />
                  <ReviewRow label="Videos" value={`${files.length} files (${formatBytes(totalSize)})`} />
                  <ReviewRow label="Camera" value="CAM-A406-03" />
                  <ReviewRow label="Location" value={location || 'A406 North Circular'} />
                  <ReviewRow label="Detection model" value="YOLOv8x + ByteTrack" />
                  <ReviewRow label="Confidence threshold" value={`0.${String(confidence).padStart(2, '0')}`} />
                  <ReviewRow label="Generate report" value={generateReport ? 'Yes' : 'No'} />
                  <ReviewRow label="Anonymize plates" value={anonymizePlates ? 'Yes' : 'No'} />
                  <ReviewRow label="Detection zone" value="1 polygon defined" />
                  <ReviewRow label="Count lines" value="2 lines (forward)" />
                </div>
              </Card>
              <div className="rounded-xl border border-warn-500/20 bg-warn-500/[0.04] p-4">
                <p className="text-sm text-warn-400">
                  Estimated processing: ~2h 40m · 38 GPU-hours
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  You will be billed from your monthly GPU-hour quota.
                </p>
              </div>
            </div>
          )}

          {/* STEP 9: Queue */}
          {step === 8 && (
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
                    {files.length} videos ({formatBytes(totalSize)}) will be processed with YOLOv8x + ByteTrack.
                  </p>
                  <div className="mt-5 rounded-xl border border-white/[0.06] bg-ink-900/40 p-4 text-left">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-400">Queue position</span>
                      <span className="font-semibold text-white">2nd in queue</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-ink-400">Estimated start</span>
                      <span className="font-semibold text-white">~5 minutes</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-ink-400">Estimated completion</span>
                      <span className="font-semibold text-white">~3 hours</span>
                    </div>
                  </div>
                  <Button size="lg" className="mt-6 w-full" leftIcon={<Rocket size={18} />} onClick={handleNext}>
                    Queue for Analysis
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
          <Button variant="ghost" leftIcon={<ArrowLeft size={15} />} onClick={handleBack} disabled={step === 0}>
            Back
          </Button>
          <Button rightIcon={<ArrowRight size={15} />} onClick={handleNext} disabled={!canProceed}>
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
    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 text-sm">
      <span className="text-ink-400">{label}</span>
      <span className="font-medium text-ink-100">{value}</span>
    </div>
  );
}
