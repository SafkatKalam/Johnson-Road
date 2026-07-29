import KPICard from "../components/dashboard/KPICard";
import ProcessingCard from "../components/dashboard/ProcessingCard";
import TrafficChart from "../components/dashboard/TrafficChart";
import RecentProjects from "../components/dashboard/RecentProjects";

import { dashboardStats } from "../data/dashboard";

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>

      <p className="dashboard-subtitle">
        AI-powered traffic intelligence overview.
      </p>

      <section className="kpi-grid">
        {dashboardStats.map((stat) => (
          <KPICard key={stat.id} stat={stat} />
        ))}
      </section>

      <section className="dashboard-grid">
        <TrafficChart />

        <ProcessingCard />
        <RecentProjects />
      </section>
    </>
  );
}