from app.repositories.dashboard_repository import DashboardRepository

_repository = DashboardRepository()


def get_dashboard_data() -> dict:
    return {
        "dashboardKpis": _repository.get_dashboard_kpis(),
        "trafficVolumeByHour": _repository.get_traffic_volume_by_hour(),
        "vehicleClassBreakdown": _repository.get_vehicle_class_breakdown(),
        "weeklyTrafficTrend": _repository.get_weekly_traffic_trend(),
        "aiInsights": _repository.get_ai_insights(),
        "aiTimeline": _repository.get_ai_timeline(),
        "recentActivity": _repository.get_recent_activity(),
        "quickActions": _repository.get_quick_actions(),
        "trafficByProject": _repository.get_traffic_by_project(),
        "segmentDetails": _repository.get_segment_details(),
        "insightDetails": _repository.get_insight_details(),
    }
