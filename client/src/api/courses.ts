import api from './client';

export async function searchCourses(query: string) {
  const response = await api.get(`/courses`, { params: { q: query } });
  return response.data.data;
}

export async function getCourse(id: number) {
  const response = await api.get(`/courses/${id}`);
  return response.data.data;
}

export async function createCourse(course: unknown) {
  const response = await api.post(`/courses`, { course });
  return response.data.data;
}
