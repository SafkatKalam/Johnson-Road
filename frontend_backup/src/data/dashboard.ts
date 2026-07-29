import type {
  DashboardStat,
  ProcessingJob,
  ProjectItem,
} from "../types/dashboard";

export const dashboardStats: DashboardStat[] = [
  {
    id: 1,
    title: "Vehicles",
    value: "124,528",
    change: "+8.4%",
    positive: true,
  },
  {
    id: 2,
    title: "Projects",
    value: "14",
    change: "+2",
    positive: true,
  },
  {
    id: 3,
    title: "Active Jobs",
    value: "6",
    change: "+1",
    positive: true,
  },
  {
    id: 4,
    title: "Reports",
    value: "38",
    change: "+5",
    positive: true,
  },
];

export const processingJobs: ProcessingJob[] = [
  {
    id: 1,
    project: "Johnson Road",
    progress: 54,
    status: "Processing 10:00 AM - 12:00 PM",
    eta: "14 min",
  },
];

export const recentProjects: ProjectItem[] = [
  {
    id: 1,
    name: "Johnson Road",
    uploaded: "Today",
    videos: 12,
    status: "Running",
  },
  {
    id: 2,
    name: "Airport Road",
    uploaded: "Yesterday",
    videos: 8,
    status: "Completed",
  },
  {
    id: 3,
    name: "Dhaka Ring Road",
    uploaded: "2 days ago",
    videos: 5,
    status: "Completed",
  },
];