import { locationSuggestions, projects, projectVideos } from '@/lib/mockData';
import type { Project, ProjectStatus, ProjectVideo } from '@/types/project';

export type { Project, ProjectStatus, ProjectVideo };

export const ProjectService = {
  async getProjects(): Promise<Project[]> {
    return Promise.resolve(projects);
  },
  async getProject(projectId: string): Promise<Project | undefined> {
    return Promise.resolve(projects.find((project) => project.id === projectId));
  },
  async getProjectVideos(projectId: string): Promise<ProjectVideo[]> {
    return Promise.resolve(projectVideos[projectId] ?? []);
  },
  async getLocationSuggestions(): Promise<string[]> {
    return Promise.resolve(locationSuggestions);
  },
};

export const projectList = projects as Project[];
export const projectVideoList = projectVideos as Record<string, ProjectVideo[]>;
export const projectLocationSuggestions = locationSuggestions as string[];

export { projectLocationSuggestions as locationSuggestions, projectList as projects, projectVideoList as projectVideos };
