import apiClient from './api';
export interface SystemSettings {
  // Security
  password_min_length: number;
  // Detection YOLO
  confidence_threshold: number;
  send_cooldown_seconds: number;
  data_retention_days: number;
  // Per-class confidence
  conf_no_helmet: number;
  conf_nutshell: number;
  conf_helmet: number;
  conf_license_plate: number;
  // OCR
  ocr_confidence: number;
  // Notifications
  notify_on_new_detection: boolean;
  notify_on_operator_activity: boolean;
  notify_on_camera_offline: boolean;
  // Database
  database_backup_enabled: boolean;
  database_backup_frequency_hours: number;
  database_backup_retention_days: number;
}
export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    const response = await apiClient.get('/settings/');
    return response.data;
  },
  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await apiClient.patch('/settings/', data);
    return response.data;
  },
};