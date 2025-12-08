import api from "./client";

// Bag API methods
export async function getBag() {
  const response = await api.get(`/bag`);
  return response.data.data;
}

export async function createBag(bag: Record<string, string>) {
  const response = await api.post(`/bag`, { bag });
  return response.data.data;
}
