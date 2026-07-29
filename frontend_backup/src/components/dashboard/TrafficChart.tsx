import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { time: "06", vehicles: 120 },
  { time: "08", vehicles: 420 },
  { time: "10", vehicles: 610 },
  { time: "12", vehicles: 720 },
  { time: "14", vehicles: 540 },
  { time: "16", vehicles: 790 },
  { time: "18", vehicles: 910 },
  { time: "20", vehicles: 500 },
];

export default function TrafficChart() {
  return (
    <div className="chart-card">
      <div className="section-title">
        <h2>Traffic Volume</h2>
        <span>Last 24 Hours</span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />

          <XAxis dataKey="time" stroke="#94A3B8" />

          <YAxis stroke="#94A3B8" />

          <Tooltip />

          <Area
            type="monotone"
            dataKey="vehicles"
            stroke="#3B82F6"
            fill="url(#trafficGradient)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}