import { recentProjects } from "../../data/dashboard";

export default function RecentProjects() {
  return (
    <div className="recent-projects">
      <div className="section-title">
        <h2>Recent Projects</h2>
        <span>View All</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Uploaded</th>
            <th>Videos</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {recentProjects.map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td>{project.uploaded}</td>
              <td>{project.videos}</td>

              <td>
                <span
                  className={
                    project.status === "Completed"
                      ? "status completed"
                      : "status running"
                  }
                >
                  {project.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}