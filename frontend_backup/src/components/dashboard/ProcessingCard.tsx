import { processingJobs } from "../../data/dashboard";

export default function ProcessingCard() {
  const job = processingJobs[0];

  return (
    <div className="processing-card">
      <div className="section-title">
        <h2>Active Processing</h2>
        <span>{job.progress}%</span>
      </div>

      <div className="progress large">
        <div
          className="progress-fill"
          style={{ width: `${job.progress}%` }}
        />
      </div>

      <div className="processing-info">
        <p>{job.project}</p>

        <small>{job.status}</small>

        <small>ETA: {job.eta}</small>
      </div>
    </div>
  );
}