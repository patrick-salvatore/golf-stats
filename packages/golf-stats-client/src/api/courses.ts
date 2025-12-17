import api from './client';
import { ServerCourse } from '~/lib/stores';

export async function searchCourses(query: string) {
  const response = await api.get(`/courses`, { params: { q: query } });
  return response.data.data;
}

export async function getMyCourses() {
  const response = await api.get(`/courses`, { params: { filter: 'mine' } });
  return response.data.data as ServerCourse[]
}

export async function getCourse(id: number) {
  const response = await api.get(`/courses/${id}`);
  return response.data.data as ServerCourse
}

export async function createCourse(course: unknown) {
  const response = await api.post(`/courses`, { course });
  return response.data.data;
}

export async function updateCourse(id: number, course: unknown) {
  const response = await api.put(`/courses/${id}`, { course });
  return response.data.data;
}

export async function updateHole(id: number, data: unknown) {
  const response = await api.put(`/hole_definitions/${id}`, {
    hole_definition: data,
  });
  return response.data.data;
}

export async function publishCourse(id: number) {
  const response = await api.put(`/courses/${id}`, {
    course: { status: 'published' },
  });
  return response.data.data;
}

export async function deleteCourse(id: number) {
  const response = await api.delete(`/courses/${id}`);
  return response.data;
}
