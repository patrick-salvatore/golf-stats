import api from './client';

export async function getRounds() {
  const response = await api.get(`/rounds`);
  return response.data.data;
}

export async function createRound(round: unknown) {
  const response = await api.post(`/rounds`, { round });
  return response.data.data;
}

export async function deleteRound(id: number) {
  await api.delete(`/rounds/${id}`);
}
