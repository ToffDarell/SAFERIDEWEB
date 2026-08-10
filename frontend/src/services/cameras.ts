import apiClient from './api';

export interface Camera {
  id: number;
  name: string;
  location: string;
  stream_url: string;
  rtsp_url?: string;
  status: 'active' | 'inactive';
  is_live?: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedRtspUrl {
  camera_ip: string;
  rtsp_username: string;
  rtsp_password: string;
  stream_quality: string;
}

export function parseRtspUrl(url: string): ParsedRtspUrl | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'rtsp:') {
      return null;
    }
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    return {
      camera_ip: parsed.hostname,
      rtsp_username: decodeURIComponent(parsed.username || ''),
      rtsp_password: decodeURIComponent(parsed.password || ''),
      stream_quality: pathSegments[0] || 'stream1',
    };
  } catch {
    return null;
  }
}

export interface CreateCameraPayload {
  name: string;
  location: string;
  camera_ip: string;
  rtsp_username: string;
  rtsp_password: string;
  stream_quality: 'stream1' | 'stream2' | 'stream6' | 'stream7';
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

  getStreamUrl(camera : Camera): string {
    return camera.stream_url;
  },
};
