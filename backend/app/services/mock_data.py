PROJECTS = [
    {
        "id": "prj_8f2a",
        "name": "M5 Junction 14 — Northbound",
        "location": "Bristol, UK",
        "status": "completed",
        "duration": 18,
        "videoCount": 3,
        "vehicleCount": 84230,
        "avgFlow": 4679,
        "peakHour": "08:00",
        "createdAt": "2026-07-21T09:14:00Z",
        "updatedAt": "2026-07-23T16:30:00Z",
        "thumbnail": "amber",
        "confidence": 0.97,
        "reportCount": 4,
        "aiJobCount": 3,
        "storageUsed": 38.4,
    },
    {
        "id": "prj_1c9b",
        "name": "A406 North Circular — East",
        "location": "London, UK",
        "status": "processing",
        "duration": 24,
        "videoCount": 4,
        "vehicleCount": 112400,
        "avgFlow": 4683,
        "peakHour": "17:30",
        "createdAt": "2026-07-25T13:22:00Z",
        "updatedAt": "2026-07-29T14:22:00Z",
        "thumbnail": "sky",
        "confidence": 0.94,
        "reportCount": 1,
        "aiJobCount": 1,
        "storageUsed": 45.2,
    },
]

LOCATION_SUGGESTIONS = ["Bristol, UK", "London, UK", "Sydney, AU", "Mumbai, IN", "Dubai, UAE"]

UPLOAD_FILES = [
    {"id": "f1", "name": "cam_01_northbound_20260725.mp4", "size": 9660000000, "duration": "8h 00m", "resolution": "1920×1080", "fps": 30, "progress": 100, "status": "done"},
    {"id": "f2", "name": "cam_02_southbound_20260725.mp4", "size": 9840000000, "duration": "8h 00m", "resolution": "1920×1080", "fps": 30, "progress": 100, "status": "done"},
]

PROCESSING_JOBS = [
    {"id": "job_1c9b", "projectName": "A406 North Circular — East", "progress": 67, "stage": "Object Tracking", "eta": "1h 24m", "status": "processing", "fps": 38, "currentFrame": "14:22:08", "vehicleCount": 75240},
    {"id": "job_9a1f", "projectName": "Marine Drive — Bandra", "progress": 0, "stage": "Queued", "eta": "—", "status": "queued", "fps": 0, "currentFrame": "00:00:00", "vehicleCount": 0},
    {"id": "job_8f2a", "projectName": "M5 Junction 14 — Northbound", "progress": 100, "stage": "Report Generation", "eta": "Done", "status": "completed", "fps": 0, "currentFrame": "18:00:00", "vehicleCount": 84230},
]

JOB_QUEUE = [
    {"id": "job_1c9b", "projectName": "A406 North Circular — East", "projectId": "prj_1c9b", "progress": 67, "eta": "1h 24m", "status": "running", "priority": "high", "stage": "Object Tracking", "fps": 38, "gpu": 94, "cpu": 72, "memory": 68, "startedAt": "13:22"},
    {"id": "job_9a1f", "projectName": "Marine Drive — Bandra", "projectId": "prj_9a1f", "progress": 0, "eta": "4h 30m", "status": "queued", "priority": "normal", "stage": "Queued", "fps": 0, "gpu": 0, "cpu": 0, "memory": 0, "queuePosition": 1, "startedAt": "—"},
]

PROCESSING_LOGS = [
    {"id": "1", "time": "14:22:41", "level": "info", "message": "Loaded frame 51984/77840 — segment 3/4"},
    {"id": "2", "time": "14:22:39", "level": "success", "message": "Tracking 42 vehicles in current frame"},
]

TIMELINE_STAGES = [
    {"id": "1", "label": "Upload & Validation", "status": "completed", "startedAt": "13:22:00", "duration": "4m 12s"},
    {"id": "2", "label": "Preprocessing", "status": "completed", "startedAt": "13:26:12", "duration": "8m 40s"},
]

SEGMENTS = [
    {"id": "1", "range": "00:00 — 06:00", "duration": "6h", "vehicles": 19840, "status": "completed"},
    {"id": "2", "range": "06:00 — 12:00", "duration": "6h", "vehicles": 28140, "status": "completed"},
]

dashboard_kpis = {
    "totalVehicles": 387490,
    "totalVehiclesDelta": 12.4,
    "activeJobs": 1,
    "completedReports": 14,
    "completedReportsDelta": 8.3,
    "avgConfidence": 96.2,
    "avgConfidenceDelta": 1.1,
    "hoursAnalyzed": 158,
    "hoursAnalyzedDelta": 22.7,
}

TRAFFIC_VOLUME_BY_HOUR = [
    {"hour": "08", "vehicles": 3762, "flow": "peak"},
    {"hour": "17", "vehicles": 3648, "flow": "peak"},
]

VEHICLE_CLASS_BREAKDOWN = [
    {"name": "Cars", "value": 271243, "color": "#10b981"},
    {"name": "Trucks", "value": 46498, "color": "#38bdf8"},
]

WEEKLY_TRAFFIC_TREND = [
    {"day": "Mon", "vehicles": 51200, "peak": 3762},
    {"day": "Fri", "vehicles": 64280, "peak": 4680},
]

AI_INSIGHTS = [
    {"id": "1", "title": "Morning peak shifted 15 min earlier", "detail": "A406 peak congestion moved from 08:30 to 08:15 this week.", "severity": "info", "icon": "trending"},
]

AI_TIMELINE = [
    {"id": "1", "time": "14:22", "label": "Detection model pass 3/4", "status": "active"},
]

RECENT_ACTIVITY = [
    {"id": "1", "projectName": "A406 North Circular — East", "action": "started processing", "time": "12m ago", "status": "processing", "projectId": "prj_1c9b"},
]

QUICK_ACTIONS = [
    {"id": "upload", "label": "Upload Footage", "icon": "upload", "to": "/upload"},
]

SEGMENT_DETAILS = {
    "1": {"id": "1", "range": "00:00 — 06:00", "vehicleCount": 19840, "avgSpeed": 62, "peakDensity": 4.2, "events": ["Low overnight flow"]},
}

INSIGHT_DETAILS = {
    "1": {"trend": "Morning peak has been gradually shifting earlier.", "reason": "Hybrid work schedules.", "recommendation": "Retiming signals may reduce delay."},
}

TRAFFIC_BY_PROJECT = {
    "prj_8f2a": TRAFFIC_VOLUME_BY_HOUR,
    "prj_1c9b": TRAFFIC_VOLUME_BY_HOUR,
}

PROJECT_VIDEOS = {
    "prj_8f2a": [
        {"id": "v1", "name": "cam_01_northbound_20260721.mp4", "duration": "6h 00m", "resolution": "1920×1080", "fps": 30, "size": "8.2 GB", "status": "analyzed", "camera": "CAM-NB-01"},
    ],
    "prj_1c9b": [
        {"id": "v1", "name": "cam_01_northbound_20260725.mp4", "duration": "6h 00m", "resolution": "1920×1080", "fps": 30, "size": "9.2 GB", "status": "analyzed", "camera": "CAM-NB-03"},
    ],
}

PROJECT_REPORTS = {
    "prj_8f2a": [
        {"id": "r1", "title": "Weekly Summary — Week 30", "date": "2026-07-23", "type": "weekly", "vehicleCount": 84230},
    ],
    "prj_1c9b": [
        {"id": "r1", "title": "Partial Analysis Summary", "date": "2026-07-29", "type": "summary", "vehicleCount": 75240},
    ],
}
