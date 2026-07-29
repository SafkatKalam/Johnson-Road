import ProjectCard from "./ProjectCard";
import type { Project } from "../types/project";

interface Props {
  projects: Project[];
}

export default function ProjectGrid({
  projects,
}: Props) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
        />
      ))}
    </div>
  );
}