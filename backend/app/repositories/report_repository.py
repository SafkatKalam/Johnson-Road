from app.services import mock_data


class ReportRepository:
    def get_peak_hours(self) -> list[dict]:
        return [
            {"hour": "08:00", "vehicles": 3762, "road": "A406 East"},
            {"hour": "17:30", "vehicles": 3648, "road": "A406 East"},
            {"hour": "18:00", "vehicles": 3412, "road": "A406 East"},
            {"hour": "08:15", "vehicles": 3290, "road": "Parramatta Rd"},
            {"hour": "09:00", "vehicles": 2981, "road": "M5 J14"},
        ]

    def get_report_analytics(self) -> dict:
        return {
            "trafficVolumeByHour": mock_data.TRAFFIC_VOLUME_BY_HOUR,
            "vehicleClassBreakdown": mock_data.VEHICLE_CLASS_BREAKDOWN,
            "weeklyTrafficTrend": mock_data.WEEKLY_TRAFFIC_TREND,
            "peakHours": self.get_peak_hours(),
        }

    def get_project_reports(self, project_id: str) -> list[dict]:
        return mock_data.PROJECT_REPORTS.get(project_id, [])
