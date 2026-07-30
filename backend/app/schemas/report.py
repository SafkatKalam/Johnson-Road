from pydantic import BaseModel


class PeakHour(BaseModel):
    hour: str
    vehicles: int
    road: str


class ReportAnalytics(BaseModel):
    trafficVolumeByHour: list[dict]
    vehicleClassBreakdown: list[dict]
    weeklyTrafficTrend: list[dict]
    peakHours: list[PeakHour]


class ProjectReport(BaseModel):
    id: str
    title: str
    date: str
    type: str
    vehicleCount: int


class ReportAnalyticsResponse(ReportAnalytics):
    pass


class ProjectReportsResponse(BaseModel):
    projectId: str
    reports: list[ProjectReport]
