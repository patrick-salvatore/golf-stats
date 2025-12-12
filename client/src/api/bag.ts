import { ClubDefinition } from "~/lib/db";
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

export async function updateBag(bag: Record<string, string>) {
  const response = await api.put(`/bag`, { bag });
  return response.data.data;
}

export async function getClubDefinitions() {
  const response = await api.get(`/club_definitions`);
  return response.data.data as ClubDefinition[];
}
