import { db } from "./db";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const getAuthHeaders = async () => {
  const user = await db.users.toCollection().first();
  if (user) {
    return { "x-user-username": user.username };
  }
  return {};
};

export const api = {
  async searchCourses(query: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/courses?q=${encodeURIComponent(query)}`, { headers });
    if (!res.ok) throw new Error("Failed to search courses");
    const json = await res.json();
    return json.data;
  },

  async getCourse(id: number) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/courses/${id}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch course");
    const json = await res.json();
    return json.data;
  }
};
