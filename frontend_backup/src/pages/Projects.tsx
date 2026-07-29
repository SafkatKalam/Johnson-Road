import { useEffect, useState } from "react";

import { getProjects } from "../features/projects/api/projects";

import type { Project } from "../features/projects/types/project";

import ProjectGrid from "../features/projects/components/ProjectGrid";
import NewProjectButton from "../features/projects/components/NewProjectButton";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function load() {
      const data = await getProjects();
      setProjects(data);
    }

    load();
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Projects</h1>

        <NewProjectButton />
      </div>

      <ProjectGrid projects={projects} />
    </>
  );
}