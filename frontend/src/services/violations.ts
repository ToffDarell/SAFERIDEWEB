import apiClient from './api';

export interface Violation {
  id: number;
  id_number?: string;
  camera: number;
  camera_name: string;
  detected_at: string;
  detection_status: 'compliant' | 'violation';
  confidence_score: number;
  classification: 'no_helmet' | 'helmet' | 'nutshell' | 'license_plate';
  plate_number: string | null;
  evidence_image: string | null;
  bounding_box: any;
  detected_objects: any;
  processed_at: string;
  review_status: 'pending' | 'reviewed' | 'resolved';
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_by_role: string | null;
  reviewed_at: string | null;
}

export interface ViolationSummaryClassItem {
  classification: string;
  label: string;
  count: number;
}

export interface ViolationSummaryCameraItem {
  camera_name: string;
  count: number;
}

export interface ViolationSummary {
  total_violations: number;
  pending_violations: number;
  today_violations: number;
  this_week_violations: number;
  by_class: ViolationSummaryClassItem[];
  by_camera: ViolationSummaryCameraItem[];
}

export interface ViolationWeeklyChartPoint {
  date: string;
  count: number;
}

export interface ViolationFilters {
  detection_status?: 'compliant' | 'violation';
  camera?: number;
  classification?: string;
  ordering?: string;
  page?: number;
  page_size?: number;  
}

export const violationsService = {
  // Get all violations with filters
  async getViolations(params?: any) {
    const response = await apiClient.get('/violations/', { params });
    return response.data;
  },

  // Get single violation
  async getViolation(id: number) {
    const response = await apiClient.get(`/violations/${id}/`);
    return response.data;
  },

  async getSummary(filters?: Record<string, string>): Promise<ViolationSummary> {
    const params = new URLSearchParams(filters || {}).toString();
    const response = await apiClient.get(`/violations/summary/${params ? `?${params}` : ''}`);
    return response.data;
  },

  async getWeeklyChart(filters?: Record<string, string>): Promise<ViolationWeeklyChartPoint[]> {
    const params = new URLSearchParams(filters || {}).toString();
    const response = await apiClient.get(`/violations/weekly-chart/${params ? `?${params}` : ''}`);
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
      detectionRate: (violationCount + compliantCount) > 0
        ? ((compliantCount / (violationCount + compliantCount)) * 100).toFixed(1)
        : '0',
    };
  },

  // Create violation (for YOLO service testing)
  async createViolation(data: FormData) {
    const response = await apiClient.post('/violations/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Update violation (for review)
    async updateReviewStatus(id: number, status: 'pending' | 'reviewed' | 'resolved') {
    const response = await apiClient.patch(`/violations/${id}/`, {
      review_status: status,
    });
    return response.data;
  },
};
