from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    totalVehicles: int
    totalVehiclesDelta: float
    activeJobs: int
    completedReports: int
    completedReportsDelta: float
    avgConfidence: float
    avgConfidenceDelta: float
    hoursAnalyzed: int
    hoursAnalyzedDelta: float


class TrafficPoint(BaseModel):
    hour: str
    vehicles: int
    flow: str


class VehicleClassBreakdownItem(BaseModel):
    name: str
    value: int
    color: str


class WeeklyTrafficTrendPoint(BaseModel):
    day: str
    vehicles: int
    peak: int


class AiInsight(BaseModel):
    id: str
    title: str
    detail: str
    severity: str
    icon: str


class AiTimelineItem(BaseModel):
    id: str
    time: str
    label: str
    status: str


class RecentActivityItem(BaseModel):
    id: str
    projectName: str
    action: str
    time: str
    status: str
    projectId: Optional[str] = None


class QuickAction(BaseModel):
    id: str
    label: str
    icon: str
    to: str


class SegmentDetail(BaseModel):
    id: str
    range: str
    vehicleCount: int
    avgSpeed: int
    peakDensity: float
    events: list[str]


class InsightDetail(BaseModel):
    trend: str
    reason: str
    recommendation: str


class DashboardResponse(BaseModel):
    dashboardKpis: DashboardKpis
    trafficVolumeByHour: list[TrafficPoint]
    vehicleClassBreakdown: list[VehicleClassBreakdownItem]
    weeklyTrafficTrend: list[WeeklyTrafficTrendPoint]
    aiInsights: list[AiInsight]
    aiTimeline: list[AiTimelineItem]
    recentActivity: list[RecentActivityItem]
    quickActions: list[QuickAction]
    trafficByProject: dict[str, list[TrafficPoint]]
    segmentDetails: dict[str, SegmentDetail]
    insightDetails: dict[str, InsightDetail]
