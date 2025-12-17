import axios from 'axios';
import { UserStore } from '../lib/stores';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth header
api.interceptors.request.use(async (config) => {
  const user = await UserStore.getUser();
  if (user) {
    config.headers['x-user'] = user.username;
  }
  return config;
});

// Response interceptor to unwrap data
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  },
);

export default api;
