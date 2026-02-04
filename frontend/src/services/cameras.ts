import apiClient from './api';

export interface Camera {
  id: number;
  name: string;
  location: string;
  stream_url: string;
  status: 'active' | 'inactive';
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export const camerasService = {
  // Get all cameras
  async getCameras() {
    const response = await apiClient.get('/cameras/');
    return response.data;
  },

  // Get single camera
  async getCamera(id: number) {
    const response = await apiClient.get(`/cameras/${id}/`);
    return response.data;
  },

  // Create camera
  async createCamera(data: Partial<Camera>) {
    const response = await apiClient.post('/cameras/', data);
    return response.data;
  },

  // Update camera
  async updateCamera(id: number, data: Partial<Camera>) {
    const response = await apiClient.patch(`/cameras/${id}/`, data);
    return response.data;
  },

  // Delete camera
  async deleteCamera(id: number) {
    await apiClient.delete(`/cameras/${id}/`);
  },
};