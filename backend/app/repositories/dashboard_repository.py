from app.services import mock_data


class DashboardRepository:
    def get_dashboard_kpis(self) -> dict:
        return mock_data.dashboard_kpis

    def get_traffic_volume_by_hour(self) -> list[dict]:
        return mock_data.TRAFFIC_VOLUME_BY_HOUR

    def get_vehicle_class_breakdown(self) -> list[dict]:
        return mock_data.VEHICLE_CLASS_BREAKDOWN

    def get_weekly_traffic_trend(self) -> list[dict]:
        return mock_data.WEEKLY_TRAFFIC_TREND

    def get_ai_insights(self) -> list[dict]:
        return mock_data.AI_INSIGHTS

    def get_ai_timeline(self) -> list[dict]:
        return mock_data.AI_TIMELINE

    def get_recent_activity(self) -> list[dict]:
        return mock_data.RECENT_ACTIVITY

    def get_quick_actions(self) -> list[dict]:
        return mock_data.QUICK_ACTIONS

    def get_traffic_by_project(self) -> dict:
        return mock_data.TRAFFIC_BY_PROJECT

    def get_segment_details(self) -> dict:
        return mock_data.SEGMENT_DETAILS

    def get_insight_details(self) -> dict:
        return mock_data.INSIGHT_DETAILS
