import apiClient from './api';

export interface Camera {
  id: number;
  name: string;
  location: string;
  stream_url: string;
  rtsp_url: string;
  status: 'active' | 'inactive';
  is_live?: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCameraPayload {
  name: string;
  location: string;
  camera_ip: string;
  rtsp_username: string;
  rtsp_password: string;
  stream_quality: 'stream1' | 'stream2' | 'stream6' | 'stream7';
}

export function parseRtspUrl(url: string): {
  camera_ip: string;
  rtsp_username: string;
  rtsp_password: string;
  stream_quality: string;
} | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'rtsp:') return null;
    return {
      camera_ip: parsed.hostname,
      rtsp_username: parsed.username,
      rtsp_password: parsed.password,
      stream_quality: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

export const camerasService = {
  async getCameras() {
    const response = await apiClient.get('/cameras/');
    return response.data;
  },

  async getCamera(id: number) {
    const response = await apiClient.get(`/cameras/${id}/`);
    return response.data;
  },

  async createCamera(data: CreateCameraPayload) {
    const response = await apiClient.post('/cameras/', data);
    return response.data;
  },

  async updateCamera(id: number, data: Record<string, unknown>) {
    const response = await apiClient.patch(`/cameras/${id}/`, data);
    return response.data;
  },

  async deleteCamera(id: number) {
    await apiClient.delete(`/cameras/${id}/`);
  },

  getStreamUrl(id: number): string {
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:8000';
    const token = localStorage.getItem('accessToken');
    return `${baseURL}/cameras/${id}/stream/?detection=true`;
  },
};
