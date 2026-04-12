import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, FileSpreadsheet, FileText, CheckCircle, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { violationsService, type Violation } from '@/services/violations';
import { camerasService } from '@/services/cameras';
import apiClient from '@/services/api';
import { usePermissions } from '@/contexts/PermissionsContext';

type CameraLocationOption = {
  location?: string | null;
};

type ViolationsDateFilterMode =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'specific_date'
  | 'specific_month';

const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isCompleteMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);

const Violations = () => {
  const { toast } = useToast();
  const { currentUser, hasPermission, isAdmin, isLoading: isPermissionsLoading } = usePermissions();
  const canUpdateViolationStatus = hasPermission('can_update_violation_status');
  const canExportReports = hasPermission('can_export_reports');

  // Read preferences saved from Settings page
  const prefs = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  const itemsPerPage: number = prefs.itemsPerPage || 25;
  const defaultFilter: string = prefs.defaultFilter || 'all';
  const showConfidence: boolean = prefs.showConfidence !== false;

  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateMode, setFilterDateMode] = useState<ViolationsDateFilterMode>('all');
  const [specificDate, setSpecificDate] = useState('');
  const [specificMonth, setSpecificMonth] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterDetectionStatus, setFilterDetectionStatus] = useState('all');
  const [filterReviewStatus, setFilterReviewStatus] = useState(defaultFilter);
  const [selectedEvidence, setSelectedEvidence] = useState<Violation | null>(null);
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState('');
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false);
  const [isEvidenceDownloading, setIsEvidenceDownloading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const evidenceObjectUrlRef = useRef<string | null>(null);
  const trimmedSearchQuery = searchQuery.trim();
  const isSearchTooShort =
    !isPermissionsLoading && !isAdmin && trimmedSearchQuery.length > 0 && trimmedSearchQuery.length < 3;

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const cameraResponse = await camerasService.getCameras();
        const cameraList = Array.isArray(cameraResponse)
          ? cameraResponse
          : cameraResponse.results || [];

        const nextLocations = Array.from(
          new Set(
            cameraList
              .map((camera: CameraLocationOption) => camera.location?.trim())
              .filter(Boolean)
          )
        ).sort((a: string, b: string) => a.localeCompare(b));

        setLocationOptions(nextLocations as string[]);
      } catch (error) {
        console.error('Failed to load violation locations:', error);
      }
    };

    loadLocations();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDateMode, specificDate, specificMonth, filterLocation, filterDetectionStatus, filterReviewStatus]);

  useEffect(() => {
    if (filterDateMode === 'specific_date' && specificDate && !isCompleteDate(specificDate)) {
      return;
    }
    if (filterDateMode === 'specific_month' && specificMonth && !isCompleteMonth(specificMonth)) {
      return;
    }

    loadViolations(!hasLoadedOnce);

    const interval = setInterval(async () => {
      if (currentPage !== 1) return;
      await loadViolations(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    filterDateMode,
    specificDate,
    specificMonth,
    filterLocation,
    filterDetectionStatus,
    filterReviewStatus,
    isSearchTooShort,
    isPermissionsLoading,
  ]);

  useEffect(() => {
    return () => {
      if (evidenceObjectUrlRef.current) {
        URL.revokeObjectURL(evidenceObjectUrlRef.current);
      }
    };
  }, []);

  const handleExport = async (format: 'xlsx' | 'pdf' = 'xlsx') => {
    try {
      toast({
        title: "Generating Report...",
        description: `Preparing your ${format.toUpperCase()} file`,
      });

      const params = new URLSearchParams();
      params.append("export_format", format);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (filterDateMode !== 'all' && filterDateMode !== 'specific_date' && filterDateMode !== 'specific_month') {
        params.append('date', filterDateMode);
      }
      if (filterDateMode === 'specific_date' && isCompleteDate(specificDate)) {
        params.append('specific_date', specificDate);
      }
      if (filterDateMode === 'specific_month' && isCompleteMonth(specificMonth)) {
        params.append('specific_month', specificMonth);
      }
      if (filterLocation !== "all") params.append("location", filterLocation);
      if (filterDetectionStatus !== "all") params.append("detection_status", filterDetectionStatus);
      if (filterReviewStatus !== "all") params.append("review_status", filterReviewStatus);

      const response = await apiClient.get(
        `/violations/export/?${params.toString()}`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `saferide_violations_filtered.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Report downloaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not generate report.",
        variant: "destructive",
      });
    }
  };

  const loadViolations = async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    }

    if (isPermissionsLoading) {
      if (showLoader) {
        setIsLoading(false);
      }
      return;
    }

    if (isSearchTooShort) {
      setViolations([]);
      setTotalItems(0);
      setTotalPages(1);
      if (showLoader) {
        setIsLoading(false);
      }
      return;
    }

    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: itemsPerPage,
      };

      if (trimmedSearchQuery) params.search = trimmedSearchQuery;
      if (filterDateMode !== 'all' && filterDateMode !== 'specific_date' && filterDateMode !== 'specific_month') {
        params.date = filterDateMode;
      }
      if (filterDateMode === 'specific_date' && isCompleteDate(specificDate)) {
        params.specific_date = specificDate;
      }
      if (filterDateMode === 'specific_month' && isCompleteMonth(specificMonth)) {
        params.specific_month = specificMonth;
      }
      if (filterLocation !== 'all') params.location = filterLocation;
      if (filterDetectionStatus !== 'all') params.detection_status = filterDetectionStatus;
      if (filterReviewStatus !== 'all') params.review_status = filterReviewStatus;

      const data = await violationsService.getViolations(params);
      const violationsList = data.results || [];
      const count = data.count || 0;
      
      setTotalItems(count);
      setTotalPages(Math.ceil(count / itemsPerPage));

      setViolations(violationsList as Violation[]);
    } catch (error) {
      toast({
        title: "Error loading violations",
        description: "Failed to fetch violations from server",
        variant: "destructive",
      });
    } finally {
      setHasLoadedOnce(true);
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  const handleStatusUpdate = async (violationId: number, newStatus: string) => {
    if (!canUpdateViolationStatus) {
      return;
    }

    const validStatus = newStatus.toLowerCase() as 'pending' | 'reviewed' | 'resolved';

    // Step 1: Optimistic UI update immediately
    const reviewerName = currentUser?.name || currentUser?.username || 'Unknown';
    const reviewerRole = currentUser?.role === 'admin' ? 'TMC Administrator' : 'TMC Operator';
    setViolations(prev =>
      prev.map(v => v.id === violationId ? {
        ...v,
        review_status: validStatus,
        reviewed_by_name: validStatus !== 'pending' ? reviewerName : null,
        reviewed_by_role: validStatus !== 'pending' ? reviewerRole : null,
        reviewed_at: validStatus !== 'pending' ? new Date().toISOString() : null,
      } : v)
    );

    try {
      // Step 2: PATCH to backend
      await violationsService.updateReviewStatus(violationId, validStatus);

      toast({
        title: "Status Updated",
        description: `Violation #${violationId} marked as ${newStatus}`,
      });
    } catch (error) {
      // Step 4: Revert on failure
      setViolations(prev =>
        prev.map(v => v.id === violationId ? { ...v, review_status: 'pending' } : v)
      );
      toast({
        title: "Update Failed",
        description: "Could not save status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  const resetEvidencePreview = () => {
    if (evidenceObjectUrlRef.current) {
      URL.revokeObjectURL(evidenceObjectUrlRef.current);
      evidenceObjectUrlRef.current = null;
    }
    setSelectedEvidenceUrl('');
    setEvidenceError('');
    setIsEvidenceLoading(false);
  };

  const handleEvidenceDialogChange = (open: boolean) => {
    if (!open) {
      resetEvidencePreview();
      setSelectedEvidence(null);
    }
  };

  const handleViewEvidence = async (violation: Violation) => {
    setSelectedEvidence(violation);
    resetEvidencePreview();
    setIsEvidenceLoading(true);

    try {
      const evidenceBlob = await violationsService.getEvidenceBlob(violation.id);
      const previewUrl = URL.createObjectURL(evidenceBlob);
      evidenceObjectUrlRef.current = previewUrl;
      setSelectedEvidenceUrl(previewUrl);
    } catch (error) {
      setEvidenceError('Protected evidence could not be loaded.');
      toast({
        title: 'Evidence Unavailable',
        description: 'This evidence image could not be loaded securely.',
        variant: 'destructive',
      });
    } finally {
      setIsEvidenceLoading(false);
    }
  };

  const getEvidenceFilename = (contentDisposition: string | undefined, violation: Violation) => {
    const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
    if (filenameMatch?.[1]) {
      return filenameMatch[1];
    }

    return `violation-${violation.id_number || violation.id}.jpg`;
  };

  const handleDownloadEvidence = async () => {
    if (!selectedEvidence) {
      return;
    }

    setIsEvidenceDownloading(true);

    try {
      const { blob, contentDisposition } = await violationsService.downloadEvidence(
        selectedEvidence.id,
        selectedEvidence.evidence_download_url,
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = getEvidenceFilename(contentDisposition, selectedEvidence);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Evidence image could not be downloaded.',
        variant: 'destructive',
      });
    } finally {
      setIsEvidenceDownloading(false);
    }
  };

  const getStatusBadge = (classification: string) => {
    if (classification === 'no_helmet') {
      return 'No Helmet';
    }
    if (classification === 'nutshell') {
      return 'Nutshell';
    }
    if (classification === 'license_plate') {
      return 'License Plate';
    }
    return 'Helmet';
  };

  const filteredViolations = violations;

  const handleDateModeChange = (value: ViolationsDateFilterMode) => {
    setFilterDateMode(value);
    if (value !== 'specific_date') {
      setSpecificDate('');
    }
    if (value !== 'specific_month') {
      setSpecificMonth('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="app-hint-text">Loading violations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="app-page-heading">Violations</h2>
          <p className="app-body-text text-muted-foreground">Detected helmet violations and plate recognition</p>
        </div>
        {canExportReports && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-4 text-sm font-semibold shadow-none"
              onClick={() => handleExport('xlsx')}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl px-4 text-sm font-semibold shadow-none"
              onClick={() => handleExport('pdf')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        )}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="app-section-title">Filter By</CardTitle>
              <p className="app-hint-text mt-1">
                Plate number, date, location, status, and review status
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[12px]"
              onClick={() => {
                setSearchQuery('');
                setFilterDateMode('all');
                setSpecificDate('');
                setSpecificMonth('');
                setFilterLocation('all');
                setFilterDetectionStatus('all');
                setFilterReviewStatus('all');
              }}
            >
              Clear
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label className="app-label-text">Plate Number</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search plate number"
                  className="pl-10"
                  value={searchQuery}
                  maxLength={isAdmin ? undefined : 3}
                  onChange={(e) => setSearchQuery(isAdmin ? e.target.value : e.target.value.slice(0, 3))}
                />
              </div>
              <p className="app-hint-text">
                {isPermissionsLoading
                  ? 'Loading your access permissions...'
                  : isSearchTooShort
                  ? 'Enter exactly 3 characters to search plate numbers.'
                  : !canUpdateViolationStatus
                    ? 'Status updates are read-only for your account.'
                    : isAdmin
                      ? 'Search by any plate number fragment.'
                      : 'Operators can search using exactly 3 characters.'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="app-label-text">Date Filter</label>
              <Select value={filterDateMode} onValueChange={(value) => handleDateModeChange(value as ViolationsDateFilterMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                  <SelectItem value="specific_date">Specific Date</SelectItem>
                  <SelectItem value="specific_month">Specific Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="app-label-text">
                {filterDateMode === 'specific_month' ? 'Month' : 'Date'}
              </label>
              {filterDateMode === 'specific_month' ? (
                <Input
                  type="month"
                  value={specificMonth}
                  onChange={(event) => setSpecificMonth(event.target.value)}
                />
              ) : (
                <Input
                  type="date"
                  value={specificDate}
                  disabled={filterDateMode !== 'specific_date'}
                  onChange={(event) => setSpecificDate(event.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="app-label-text">Location</label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="app-label-text">Status</label>
              <Select value={filterDetectionStatus} onValueChange={setFilterDetectionStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="violation">Violation</SelectItem>
                  <SelectItem value="compliant">No Violation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="app-label-text">Review Status</label>
              <Select value={filterReviewStatus} onValueChange={setFilterReviewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Reviews" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h3 className="app-section-title">Recent Violations</h3>
            <p className="app-hint-text mt-1">Filtered violation records</p>
          </div>
          {filteredViolations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No violations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="whitespace-nowrap">Plate Number</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    {showConfidence && <TableHead>Confidence</TableHead>}
                    <TableHead className="whitespace-nowrap">Review Status</TableHead>
                    <TableHead className="whitespace-nowrap">Reviewed By</TableHead>
                    <TableHead className="whitespace-nowrap">Evidence</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViolations.map((violation) => (
                    <TableRow key={violation.id_number || violation.id}>
                      <TableCell className="font-medium">#{violation.id_number || violation.id}</TableCell>
                      <TableCell>{formatDate(violation.detected_at)}</TableCell>
                      <TableCell>{formatTime(violation.detected_at)}</TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-foreground">
                          {violation.plate_number || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>{violation.camera_location || violation.camera_name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge 
                          className="whitespace-nowrap"
                          variant={
                            violation.classification === 'no_helmet' || violation.classification === 'nutshell'
                              ? 'destructive' 
                              : 'secondary'
                          }
                        >
                          {getStatusBadge(violation.classification)}
                        </Badge>
                      </TableCell>
                      {showConfidence && (
                        <TableCell>
                          <span className="text-foreground font-medium">
                            {(violation.confidence_score * 100).toFixed(1)}%
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge 
                          variant={
                            violation.review_status === 'resolved'
                              ? 'default' 
                              : violation.review_status === 'reviewed'
                              ? 'secondary' 
                              : 'destructive'
                          }
                        >
                          {violation.review_status
                            ? violation.review_status.charAt(0).toUpperCase() + violation.review_status.slice(1)
                            : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {violation.reviewed_by_name ? (
                          <div className="whitespace-nowrap text-[13px]">
                            <p className="font-medium text-foreground">{violation.reviewed_by_name}</p>
                            <p className="app-hint-text">{violation.reviewed_by_role}</p>
                          </div>
                        ) : (
                          <span className="app-hint-text">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {violation.has_evidence_image ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-[12px]"
                            onClick={() => void handleViewEvidence(violation)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Evidence
                          </Button>
                        ) : (
                          <span className="app-hint-text">No image</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={violation.review_status || 'pending'}
                            disabled={!canUpdateViolationStatus}
                            onValueChange={(value) => handleStatusUpdate(violation.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="reviewed">
                                <div className="flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  Reviewed
                                </div>
                              </SelectItem>
                              <SelectItem value="resolved">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  Resolved
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
              <div className="app-hint-text">
                Showing page {currentPage} of {totalPages} ({totalItems} total)
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedEvidence)} onOpenChange={handleEvidenceDialogChange}>
        <DialogContent className="max-w-4xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="app-section-title">Violation Evidence</DialogTitle>
          </DialogHeader>

          {selectedEvidence && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="app-label-text">ID Number</p>
                  <p className="app-body-text font-medium text-foreground">
                    #{selectedEvidence.id_number || selectedEvidence.id}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="app-label-text">Camera</p>
                  <p className="app-body-text font-medium text-foreground">
                    {selectedEvidence.camera_name || 'Unknown'}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="app-label-text">Classification</p>
                  <p className="app-body-text font-medium text-foreground">
                    {getStatusBadge(selectedEvidence.classification)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-card p-3">
                  <p className="app-label-text">Detected At</p>
                  <p className="app-body-text font-medium text-foreground">
                    {formatDate(selectedEvidence.detected_at)} {formatTime(selectedEvidence.detected_at)}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl px-4 text-sm font-semibold shadow-none"
                  onClick={() => void handleDownloadEvidence()}
                  disabled={isEvidenceDownloading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isEvidenceDownloading ? 'Downloading...' : 'Download Evidence'}
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-[#F5F6FA]">
                {isEvidenceLoading ? (
                  <div className="flex min-h-[320px] items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
                      <p className="app-hint-text">Loading protected evidence...</p>
                    </div>
                  </div>
                ) : evidenceError ? (
                  <div className="flex min-h-[320px] items-center justify-center px-6 text-center">
                    <p className="app-body-text text-muted-foreground">{evidenceError}</p>
                  </div>
                ) : (
                  <img
                    src={selectedEvidenceUrl}
                    alt={`Evidence for violation ${selectedEvidence.id_number || selectedEvidence.id}`}
                    className="max-h-[70vh] w-full object-contain"
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Violations;
