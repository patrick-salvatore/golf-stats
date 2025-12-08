import api from './client';

// Stats API methods
export async function getStats() {
  const response = await api.get(`/stats`);
  return response.data.data;
}
