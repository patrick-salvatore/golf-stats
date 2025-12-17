import api from './client';

// User API methods
export async function createUser(username: string) {
  const response = await api.post(`/users`, { username });
  return response.data;
}
export async function getMe() {
  const response = await api.get(`/me`);
  return response.data.data;
}
