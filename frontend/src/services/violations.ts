import apiClient from './api';

export interface Violation {
  id: number;
  camera: number;
  camera_name: string;
  detected_at: string;
  detection_status: 'compliant' | 'violation';
  confidence_score: number;
  classification: 'no_helmet' | 'nutshell' | 'half_face_helmet' | 'full_face_helmet';
  plate_number: string | null;
  evidence_image: string | null;
  bounding_box: any;
  detected_objects: any;
  processed_at: string;
}

export interface ViolationFilters {
  detection_status?: 'compliant' | 'violation';
  camera?: number;
  classification?: string;
  ordering?: string;
  page?: number;
}

export const violationsService = {
  // Get all violations with filters
  async getViolations(filters?: ViolationFilters) {
    const params = new URLSearchParams();
    
    if (filters?.detection_status) params.append('detection_status', filters.detection_status);
    if (filters?.camera) params.append('camera', filters.camera.toString());
    if (filters?.classification) params.append('classification', filters.classification);
    if (filters?.ordering) params.append('ordering', filters.ordering);
    if (filters?.page) params.append('page', filters.page.toString());

    const response = await apiClient.get(`/violations/?${params.toString()}`);
    return response.data;
  },

  // Get single violation
  async getViolation(id: number) {
    const response = await apiClient.get(`/violations/${id}/`);
    return response.data;
  },

  // Get violation statistics
  async getStats() {
    const response = await apiClient.get('/violations/');
    const data = response.data;
    
    // Calculate stats from results
    const violations = data.results || [];
    const total = data.count || 0;
    const violationCount = violations.filter((v: Violation) => v.detection_status === 'violation').length;
    const compliantCount = violations.filter((v: Violation) => v.detection_status === 'compliant').length;

    return {
      total,
      violations: violationCount,
      compliant: compliantCount,
      detectionRate: total > 0 ? ((total / total) * 100).toFixed(1) : '0',
    };
  },

  // Create violation (for YOLO service testing)
  async createViolation(data: FormData) {
    const response = await apiClient.post('/violations/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};