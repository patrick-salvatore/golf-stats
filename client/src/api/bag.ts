import api from "./client";

export interface ClubDefinition {
  id: number;
  name: string;
  type: string;
  category: string;
  default_selected: boolean;
}

// Bag API methods
export async function getBag() {
  const response = await api.get(`/bag`);
  return response.data.data;
}

export async function createBag(bag: Record<string, string>) {
  const response = await api.post(`/bag`, { bag });
  return response.data.data;
}

export async function getClubDefinitions() {
  const response = await api.get(`/club_definitions`);
  return response.data.data as ClubDefinition[];
}
