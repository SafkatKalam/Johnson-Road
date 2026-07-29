import { api } from "./api";

export async function getProjects() {
  const response = await api.get("/projects");
  return response.data;
}

export async function createProject(data: {
  name: string;
  description: string;
}) {
  const response = await api.post("/projects", data);
  return response.data;
}