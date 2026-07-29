import { motion } from "framer-motion";
import type { DashboardStat } from "../../types/dashboard";

interface Props {
  stat: DashboardStat;
}

export default function KPICard({ stat }: Props) {
  return (
    <motion.div
      className="kpi-card"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="kpi-header">
        <span>{stat.title}</span>

        <span
          className={
            stat.positive
              ? "positive-change"
              : "negative-change"
          }
        >
          {stat.change}
        </span>
      </div>

      <h2>{stat.value}</h2>
    </motion.div>
  );
}