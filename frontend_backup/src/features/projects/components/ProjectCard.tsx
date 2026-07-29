import type { Project } from "../types/project";

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
  return (
    <div className="project-card">
      <div className="project-card-header">
        <div>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
        </div>

        <span className="status running">
          Running
        </span>
      </div>

      <div className="project-card-footer">
        <span>Open Project →</span>
      </div>
    </div>
  );
}