import { api } from "../../../services/api";
import type { Project } from "../types/project";

export async function getProjects(): Promise<Project[]> {
  const response = await api.get("/projects");
  return response.data;
}

export async function createProject(
  data: Omit<Project, "id">
): Promise<Project> {
  const response = await api.post("/projects", data);
  return response.data;
}