import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Search,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  X,
  Camera,
  Check,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { violationsService, type Violation } from '@/services/violations';
import { camerasService } from '@/services/cameras';
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

// ── Secure Plate Crop Thumbnail Component ─────────────────────────────────────
const SecurePlateCrop = ({
  violationId,
  hasCrop,
  displayedPlate,
}: {
  violationId: number;
  hasCrop: boolean;
  displayedPlate: string;
}) => {
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    if (hasCrop) {
      setLoading(true);
      setFailed(false);
      violationsService
        .getEvidenceBlob(violationId, 'plate')
        .then((blob) => {
          if (!isMounted) return;
          objectUrl = URL.createObjectURL(blob);
          setCropUrl(objectUrl);
        })
        .catch(() => {
          if (!isMounted) return;
          setFailed(true);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [violationId, hasCrop]);

  if (!hasCrop || failed) {
    return (
      <div
        title="No plate crop image available"
        className="flex h-10 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-[10px] text-muted-foreground/70 select-none"
      >
        <Camera className="h-4 w-4 opacity-40" />
      </div>
    );
  }

  if (loading) {
    return <Skeleton className="h-10 w-16 flex-shrink-0 rounded-lg" />;
  }

  return (
    <div
      title={`Cropped plate evidence for ${displayedPlate}`}
      className="group relative flex-shrink-0 overflow-hidden rounded-lg border border-border/80 bg-background shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs"
    >
      <img
        src={cropUrl || undefined}
        alt={`Plate crop for ${displayedPlate}`}
        className="h-10 w-16 object-cover transition-transform duration-200 group-hover:scale-105"
      />
    </div>
  );
};

// ── Main Violations Page Component ────────────────────────────────────────────
const Violations = () => {
  const { toast } = useToast();
  const { currentUser, hasPermission, isAdmin, isLoading: isPermissionsLoading } = usePermissions();
  const canUpdateViolationStatus = hasPermission('can_update_violation_status');
  const canExportReports = hasPermission('can_export_reports');
  const canCorrectPlateNumber = isAdmin || hasPermission('can_correct_plate_number');

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
  const [filterClassification, setFilterClassification] = useState('all');
  const [filterReviewStatus, setFilterReviewStatus] = useState(defaultFilter);

  // Evidence Dialog State
  const [selectedEvidence, setSelectedEvidence] = useState<Violation | null>(null);
  const [selectedEvidenceUrl, setSelectedEvidenceUrl] = useState('');
  const [selectedPlateCropUrl, setSelectedPlateCropUrl] = useState('');
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false);
  const [isPlateCropLoading, setIsPlateCropLoading] = useState(false);
  const [isEvidenceDownloading, setIsEvidenceDownloading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [plateCropError, setPlateCropError] = useState('');
  const [evidenceViewIndex, setEvidenceViewIndex] = useState(0);

  // Plate Correction Dialog State
  const [correctionTarget, setCorrectionTarget] = useState<Violation | null>(null);
  const [correctionInputValue, setCorrectionInputValue] = useState('');
  const [correctionCropUrl, setCorrectionCropUrl] = useState<string | null>(null);
  const [isCorrectionCropLoading, setIsCorrectionCropLoading] = useState(false);
  const [isSavingPlateCorrection, setIsSavingPlateCorrection] = useState(false);

  const evidenceObjectUrlRef = useRef<string | null>(null);
  const plateCropObjectUrlRef = useRef<string | null>(null);
  const correctionCropObjectUrlRef = useRef<string | null>(null);

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
  }, [searchQuery, filterDateMode, specificDate, specificMonth, filterLocation, filterDetectionStatus, filterClassification, filterReviewStatus]);

  useEffect(() => {
    if (filterDateMode === 'specific_date' && specificDate && !isCompleteDate(specificDate)) {
      return;
    }
    if (filterDateMode === 'specific_month' && specificMonth && !isCompleteMonth(specificMonth)) {
      return;
    }

    loadViolations(!hasLoadedOnce);

    // Auto-refresh the first page so a newly detected violation shows up without
    // a manual reload.
    //  - Fast path: the 'saferide-new-violation' window event dispatched by
    //    useViolationNotifications (its poll fires ~1s after detection), so the
    //    table updates within ~1-2s.
    //  - Slow fallback: a 5s interval, for sessions where that poll is not
    //    running (e.g. live popups disabled).
    // Both are gated to page 1 so a user paging through history is never yanked
    // back. Changing any filter resets the view to page 1 (see the effect
    // above) and this effect re-runs with fresh closures, so a filtered page-1
    // view refreshes correctly on the event.
    const refreshFirstPage = () => {
      if (currentPage !== 1) return;
      void loadViolations(false);
    };

    // A detection burst fires 'saferide-new-violation' many times in seconds.
    // Debounce the (heavy) first-page reload so a burst collapses to ONE request
    // that lands between notification-poll cycles, instead of N heavy
    // /violations/?page=1 calls starving the 1s /violations/recent/ poll.
    let eventDebounce: ReturnType<typeof setTimeout> | undefined;
    const onNewViolation = () => {
      clearTimeout(eventDebounce);
      eventDebounce = setTimeout(refreshFirstPage, 1200);
    };

    window.addEventListener('saferide-new-violation', onNewViolation);
    const interval = setInterval(refreshFirstPage, 5000); // unchanged fallback

    return () => {
      window.removeEventListener('saferide-new-violation', onNewViolation);
      clearTimeout(eventDebounce);
      clearInterval(interval);
    };
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    filterDateMode,
    specificDate,
    specificMonth,
    filterLocation,
    filterDetectionStatus,
    filterClassification,
    filterReviewStatus,
    isSearchTooShort,
    isPermissionsLoading,
  ]);

  useEffect(() => {
    return () => {
      if (evidenceObjectUrlRef.current) {
        URL.revokeObjectURL(evidenceObjectUrlRef.current);
      }
      if (plateCropObjectUrlRef.current) {
        URL.revokeObjectURL(plateCropObjectUrlRef.current);
      }
      if (correctionCropObjectUrlRef.current) {
        URL.revokeObjectURL(correctionCropObjectUrlRef.current);
      }
    };
  }, []);

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
      if (filterClassification !== 'all') params.classification = filterClassification;
      if (filterReviewStatus !== 'all') params.review_status = filterReviewStatus;

      const data = await violationsService.getViolations(params);
      const violationsList = data.results || [];
      const count = data.count || 0;

      setTotalItems(count);
      setTotalPages(Math.ceil(count / itemsPerPage));
      setViolations(violationsList as Violation[]);
    } catch (error) {
      toast({
        title: 'Error loading violations',
        description: 'Failed to fetch violations from server',
        variant: 'destructive',
      });
    } finally {
      setHasLoadedOnce(true);
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  const handleExport = async (format: 'xlsx' | 'pdf' = 'xlsx') => {
    try {
      toast({
        title: 'Generating Report...',
        description: `Preparing your ${format.toUpperCase()} file`,
      });

      const params = new URLSearchParams();
      params.append('export_format', format);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (filterDateMode !== 'all' && filterDateMode !== 'specific_date' && filterDateMode !== 'specific_month') {
        params.append('date', filterDateMode);
      }
      if (filterDateMode === 'specific_date' && isCompleteDate(specificDate)) {
        params.append('specific_date', specificDate);
      }
      if (filterDateMode === 'specific_month' && isCompleteMonth(specificMonth)) {
        params.append('specific_month', specificMonth);
      }
      if (filterLocation !== 'all') params.append('location', filterLocation);
      if (filterDetectionStatus !== 'all') params.append('detection_status', filterDetectionStatus);
      if (filterClassification !== 'all') params.append('classification', filterClassification);
      if (filterReviewStatus !== 'all') params.append('review_status', filterReviewStatus);

      const filters: Record<string, string> = {};
      params.forEach((value, key) => {
        filters[key] = value;
      });
      const blob = await violationsService.exportViolations(filters, format as 'csv' | 'xlsx' | 'pdf');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saferide_violations_filtered.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: 'Report downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not generate report.',
        variant: 'destructive',
      });
    }
  };

  const handleStatusUpdate = async (violationId: number, newStatus: string) => {
    if (!canUpdateViolationStatus) return;

    const validStatus = newStatus.toLowerCase() as 'pending' | 'reviewed' | 'resolved';

    const reviewerName = currentUser?.name || currentUser?.username || 'Unknown';
    const reviewerRole = currentUser?.role === 'admin' ? 'TMC Administrator' : 'TMC Operator';
    setViolations((prev) =>
      prev.map((v) =>
        v.id === violationId
          ? {
              ...v,
              review_status: validStatus,
              reviewed_by_name: validStatus !== 'pending' ? reviewerName : null,
              reviewed_by_role: validStatus !== 'pending' ? reviewerRole : null,
              reviewed_at: validStatus !== 'pending' ? new Date().toISOString() : null,
            }
          : v
      )
    );

    try {
      await violationsService.updateReviewStatus(violationId, validStatus);
      toast({
        title: 'Status Updated',
        description: `Violation #${violationId} marked as ${newStatus}`,
      });
    } catch (error) {
      setViolations((prev) =>
        prev.map((v) => (v.id === violationId ? { ...v, review_status: 'pending' } : v))
      );
      toast({
        title: 'Update Failed',
        description: 'Could not save status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Plate Correction Modal Flow
  const openCorrectionModal = async (violation: Violation) => {
    setCorrectionTarget(violation);
    setCorrectionInputValue(
      violation.plate_number_corrected?.trim() || violation.plate_number || ''
    );

    if (correctionCropObjectUrlRef.current) {
      URL.revokeObjectURL(correctionCropObjectUrlRef.current);
      correctionCropObjectUrlRef.current = null;
    }
    setCorrectionCropUrl(null);

    if (violation.has_plate_crop_image) {
      setIsCorrectionCropLoading(true);
      try {
        const cropBlob = await violationsService.getEvidenceBlob(violation.id, 'plate');
        const url = URL.createObjectURL(cropBlob);
        correctionCropObjectUrlRef.current = url;
        setCorrectionCropUrl(url);
      } catch {
        try {
          const evidenceBlob = await violationsService.getEvidenceBlob(violation.id, 'evidence');
          const url = URL.createObjectURL(evidenceBlob);
          correctionCropObjectUrlRef.current = url;
          setCorrectionCropUrl(url);
        } catch {
          setCorrectionCropUrl(null);
        }
      } finally {
        setIsCorrectionCropLoading(false);
      }
    }
  };

  const closeCorrectionModal = () => {
    setCorrectionTarget(null);
    setCorrectionInputValue('');
    if (correctionCropObjectUrlRef.current) {
      URL.revokeObjectURL(correctionCropObjectUrlRef.current);
      correctionCropObjectUrlRef.current = null;
    }
    setCorrectionCropUrl(null);
  };

  const handleSaveCorrection = async () => {
    if (!correctionTarget) return;

    const correctedValue = correctionInputValue.trim().toUpperCase();
    if (!correctedValue) {
      toast({
        title: 'Validation Error',
        description: 'Plate number corrected must not be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPlateCorrection(true);
    try {
      const updatedViolation = await violationsService.correctPlateNumber(
        correctionTarget.id,
        correctedValue
      );
      setViolations((prev) =>
        prev.map((v) => (v.id === updatedViolation.id ? updatedViolation : v))
      );
      if (selectedEvidence && selectedEvidence.id === updatedViolation.id) {
        setSelectedEvidence(updatedViolation);
      }
      closeCorrectionModal();
      toast({
        title: 'Plate Number Corrected',
        description: `Violation #${updatedViolation.id_number || updatedViolation.id} plate set to ${correctedValue}`,
      });
    } catch {
      toast({
        title: 'Correction Failed',
        description: 'Could not save the corrected plate number. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPlateCorrection(false);
    }
  };

  // Evidence Dialog Flow
  const resetEvidencePreview = () => {
    if (evidenceObjectUrlRef.current) {
      URL.revokeObjectURL(evidenceObjectUrlRef.current);
      evidenceObjectUrlRef.current = null;
    }
    if (plateCropObjectUrlRef.current) {
      URL.revokeObjectURL(plateCropObjectUrlRef.current);
      plateCropObjectUrlRef.current = null;
    }
    setSelectedEvidenceUrl('');
    setSelectedPlateCropUrl('');
    setEvidenceError('');
    setPlateCropError('');
    setIsEvidenceLoading(false);
    setIsPlateCropLoading(false);
    setEvidenceViewIndex(0);
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
    setIsPlateCropLoading(violation.has_plate_crop_image);

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

    if (violation.has_plate_crop_image) {
      try {
        const plateCropBlob = await violationsService.getEvidenceBlob(violation.id, 'plate');
        const previewUrl = URL.createObjectURL(plateCropBlob);
        plateCropObjectUrlRef.current = previewUrl;
        setSelectedPlateCropUrl(previewUrl);
      } catch {
        setPlateCropError('Cropped plate image could not be loaded.');
      } finally {
        setIsPlateCropLoading(false);
      }
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
    if (!selectedEvidence) return;

    setIsEvidenceDownloading(true);
    const isPlateView = evidenceViewIndex === 1 && selectedEvidence.has_plate_crop_image;

    try {
      const { blob, contentDisposition } = await violationsService.downloadEvidence(
        selectedEvidence.id,
        isPlateView
          ? selectedEvidence.plate_crop_download_url
          : selectedEvidence.evidence_download_url,
        isPlateView ? 'plate' : 'evidence'
      );
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = getEvidenceFilename(contentDisposition, selectedEvidence);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      toast({
        title: 'Download Failed',
        description: 'Evidence image could not be downloaded.',
        variant: 'destructive',
      });
    } finally {
      setIsEvidenceDownloading(false);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString();

  const getStatusBadge = (classification: string) => {
    if (classification === 'no_helmet') return 'No Helmet';
    if (classification === 'nutshell') return 'Nutshell';
    if (classification === 'license_plate') return 'License Plate';
    return 'Helmet';
  };

  const getDisplayedPlateNumber = (violation?: Violation | null) =>
    violation?.plate_number_corrected?.trim() || violation?.plate_number || 'N/A';

  const isPlateNumberCorrected = (violation?: Violation | null) =>
    Boolean(violation?.plate_number_corrected?.trim());

  const handleDateModeChange = (value: ViolationsDateFilterMode) => {
    setFilterDateMode(value);
    if (value !== 'specific_date') setSpecificDate('');
    if (value !== 'specific_month') setSpecificMonth('');
  };

  const evidenceSlides = selectedEvidence
    ? [
        {
          key: 'evidence',
          label: 'Full Evidence',
          url: selectedEvidenceUrl,
          isLoading: isEvidenceLoading,
          error: evidenceError,
        },
        ...(selectedEvidence.has_plate_crop_image
          ? [
              {
                key: 'plate',
                label: 'Plate Crop',
                url: selectedPlateCropUrl,
                isLoading: isPlateCropLoading,
                error: plateCropError,
              },
            ]
          : []),
      ]
    : [];
  const activeEvidenceSlide = evidenceSlides[evidenceViewIndex] || null;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="app-hint-text">Loading violations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="app-page-heading text-2xl font-bold tracking-tight">Violations</h2>
          <p className="app-body-text text-sm text-muted-foreground">
            Real-time helmet violation surveillance and verified plate records
          </p>
        </div>
        {canExportReports && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-4 text-xs font-medium transition-all hover:bg-accent"
              onClick={() => handleExport('xlsx')}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Export Excel
            </Button>
            <Button
              type="button"
              variant="default"
              className="h-10 rounded-xl px-4 text-xs font-medium shadow-xs transition-all"
              onClick={() => handleExport('pdf')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Filter Card */}
      <Card className="border-border bg-card shadow-2xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Search & Filters</CardTitle>
              <p className="app-hint-text text-xs text-muted-foreground mt-0.5">
                Filter by plate number, date, location, or status
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery('');
                setFilterDateMode('all');
                setSpecificDate('');
                setSpecificMonth('');
                setFilterLocation('all');
                setFilterDetectionStatus('all');
                setFilterClassification('all');
                setFilterReviewStatus('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            {/* Plate Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plate Number</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  placeholder="Search plate"
                  className="h-9 pl-9 text-xs"
                  value={searchQuery}
                  maxLength={isAdmin ? undefined : 3}
                  onChange={(e) =>
                    setSearchQuery(isAdmin ? e.target.value : e.target.value.slice(0, 3))
                  }
                />
              </div>
            </div>

            {/* Date Filter Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date Filter</label>
              <Select
                value={filterDateMode}
                onValueChange={(val) => handleDateModeChange(val as ViolationsDateFilterMode)}
              >
                <SelectTrigger className="h-9 text-xs">
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

            {/* Specific Date/Month Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {filterDateMode === 'specific_month' ? 'Month' : 'Date'}
              </label>
              {filterDateMode === 'specific_month' ? (
                <Input
                  type="month"
                  className="h-9 text-xs"
                  value={specificMonth}
                  onChange={(e) => setSpecificMonth(e.target.value)}
                />
              ) : (
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={specificDate}
                  disabled={filterDateMode !== 'specific_date'}
                  onChange={(e) => setSpecificDate(e.target.value)}
                />
              )}
            </div>

            {/* Location Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={filterDetectionStatus}
                onValueChange={setFilterDetectionStatus}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="violation">Violation</SelectItem>
                  <SelectItem value="compliant">No Violation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Classification Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Classification</label>
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Classifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classifications</SelectItem>
                  <SelectItem value="no_helmet">No Helmet</SelectItem>
                  <SelectItem value="nutshell">Nutshell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Review Status Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Review Status</label>
              <Select value={filterReviewStatus} onValueChange={setFilterReviewStatus}>
                <SelectTrigger className="h-9 text-xs">
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
      </Card>

      {/* Violations Table Card */}
      <Card className="border-border bg-card shadow-2xs">
        <CardContent className="p-0">
          {violations.length === 0 ? (
            <div className="py-16 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No violation records found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border">
                    <TableHead className="w-[100px] text-xs font-semibold">ID Number</TableHead>
                    <TableHead className="text-xs font-semibold">Date & Time</TableHead>
                    <TableHead className="min-w-[150px] text-xs font-semibold">Plate Number</TableHead>
                    <TableHead className="text-xs font-semibold">Location</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    {showConfidence && (
                      <TableHead className="text-xs font-semibold">Confidence</TableHead>
                    )}
                    <TableHead className="text-xs font-semibold">Review Status</TableHead>
                    <TableHead className="text-xs font-semibold">Reviewed By</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {violations.map((violation) => {
                    const isCorrected = isPlateNumberCorrected(violation);
                    const displayedPlate = getDisplayedPlateNumber(violation);

                    return (
                      <TableRow
                        key={violation.id_number || violation.id}
                        className="group transition-colors hover:bg-muted/30"
                      >
                        {/* ID Number */}
                        <TableCell className="font-mono text-xs font-medium text-foreground">
                          #{violation.id_number || violation.id}
                        </TableCell>

                        {/* Date & Time */}
                        <TableCell className="whitespace-nowrap text-xs">
                          <div className="font-medium text-foreground">
                            {formatDate(violation.detected_at)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatTime(violation.detected_at)}
                          </div>
                        </TableCell>

                        {/* License Plate Display Badge */}
                        <TableCell className="min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <div
                              title={
                                isCorrected
                                  ? `Original OCR: ${violation.plate_number || 'None'}${
                                      violation.plate_corrected_by
                                        ? ` • Corrected by ${violation.plate_corrected_by}`
                                        : ''
                                    }`
                                  : undefined
                              }
                              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-bold tracking-wider transition-colors ${
                                isCorrected
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-help'
                                  : 'border-border bg-muted/30 text-foreground'
                              }`}
                            >
                              {isCorrected && (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>{displayedPlate}</span>
                            </div>

                            {/* Edit Pencil Button */}
                            {canCorrectPlateNumber && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Correct plate number"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => openCorrectionModal(violation)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>

                        {/* Location */}
                        <TableCell className="text-xs font-medium text-foreground">
                          {violation.camera_location || violation.camera_name || 'Unknown'}
                        </TableCell>

                        {/* Classification Badge */}
                        <TableCell>
                          <Badge
                            variant={
                              violation.classification === 'no_helmet' ||
                              violation.classification === 'nutshell'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-[11px] font-medium"
                          >
                            {getStatusBadge(violation.classification)}
                          </Badge>
                        </TableCell>

                        {/* Confidence */}
                        {showConfidence && (
                          <TableCell className="text-xs font-medium text-foreground">
                            {(violation.confidence_score * 100).toFixed(1)}%
                          </TableCell>
                        )}

                        {/* Interactive Review Status Dropdown */}
                        <TableCell>
                          <Select
                            value={violation.review_status || 'pending'}
                            disabled={!canUpdateViolationStatus}
                            onValueChange={(val) => handleStatusUpdate(violation.id, val)}
                          >
                            <SelectTrigger
                              className={`h-8 w-28 text-xs font-semibold rounded-full border-0 shadow-2xs transition-all ${
                                violation.review_status === 'resolved'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
                                  : violation.review_status === 'reviewed'
                                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
                              }`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  Pending
                                </span>
                              </SelectItem>
                              <SelectItem value="reviewed">
                                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                  <Eye className="h-3.5 w-3.5" />
                                  Reviewed
                                </div>
                              </SelectItem>
                              <SelectItem value="resolved">
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Resolved
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Reviewed By */}
                        <TableCell className="text-xs">
                          {violation.reviewed_by_name ? (
                            <div>
                              <div className="font-medium text-foreground">
                                {violation.reviewed_by_name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {violation.reviewed_by_role}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>

                        {/* Evidence Button */}
                        <TableCell className="text-right">
                          {violation.has_evidence_image ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-medium hover:border-primary/50"
                              onClick={() => void handleViewEvidence(violation)}
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                              Evidence
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">No image</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              <div className="text-xs text-muted-foreground">
                Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages}</span> ({totalItems} records)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Admin Plate Correction Modal ──────────────────────────────────────────── */}
      <Dialog open={Boolean(correctionTarget)} onOpenChange={(open) => !open && closeCorrectionModal()}>
        <DialogContent className="max-w-md border-border bg-card sm:rounded-2xl p-6">
          {correctionTarget && (
            <>
              <DialogHeader className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <DialogTitle className="text-lg font-bold">
                    Correct License Plate
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Violation #{correctionTarget.id_number || correctionTarget.id} • Compare the cropped plate image with the OCR reading.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3">
                {/* Cropped Plate Image Container */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Cropped Plate Image (Visual Evidence)
                  </label>
                  <div className="relative flex min-h-[110px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/20 p-2">
                    {isCorrectionCropLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs text-muted-foreground">Loading plate crop...</span>
                      </div>
                    ) : correctionCropUrl ? (
                      <img
                        src={correctionCropUrl}
                        alt="Cropped plate evidence"
                        className="max-h-36 rounded-lg object-contain shadow-xs"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-4 text-center">
                        <Camera className="h-6 w-6 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">No plate crop available</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* OCR vs Correction Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Original OCR</span>
                    <div className="mt-1 font-mono text-sm font-bold text-foreground">
                      {correctionTarget.plate_number || 'N/A'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Status
                    </span>
                    <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      {isPlateNumberCorrected(correctionTarget) ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Corrected
                        </>
                      ) : (
                        'Needs Review'
                      )}
                    </div>
                  </div>
                </div>

                {/* Correction Input Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Corrected Plate Number
                  </label>
                  <Input
                    autoFocus
                    placeholder="e.g. 845KTH"
                    maxLength={20}
                    className="h-11 font-mono text-base font-bold uppercase tracking-wider"
                    value={correctionInputValue}
                    onChange={(e) => setCorrectionInputValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveCorrection();
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This will override the OCR display for admins and reports while retaining raw OCR logs.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl text-xs font-medium"
                  onClick={closeCorrectionModal}
                  disabled={isSavingPlateCorrection}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-xl text-xs font-semibold"
                  onClick={() => void handleSaveCorrection()}
                  disabled={isSavingPlateCorrection}
                >
                  {isSavingPlateCorrection ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save Correction
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Full Evidence View Dialog ──────────────────────────────────────────────── */}
      <Dialog open={Boolean(selectedEvidence)} onOpenChange={handleEvidenceDialogChange}>
        <DialogContent className="max-w-4xl border-border bg-card sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Violation Evidence Details</DialogTitle>
          </DialogHeader>

          {selectedEvidence && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">ID Number</p>
                  <p className="font-mono text-xs font-bold text-foreground">
                    #{selectedEvidence.id_number || selectedEvidence.id}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Camera</p>
                  <p className="text-xs font-semibold text-foreground">
                    {selectedEvidence.camera_name || 'Unknown'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Classification</p>
                  <p className="text-xs font-semibold text-foreground">
                    {getStatusBadge(selectedEvidence.classification)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">Detected At</p>
                  <p className="text-xs font-semibold text-foreground">
                    {formatDate(selectedEvidence.detected_at)} {formatTime(selectedEvidence.detected_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <div className="flex items-center gap-2">
                  {evidenceSlides.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg px-2.5 text-xs font-medium"
                        onClick={() =>
                          setEvidenceViewIndex((prev) =>
                            prev === 0 ? evidenceSlides.length - 1 : prev - 1
                          )
                        }
                      >
                        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                        Previous
                      </Button>
                      <span className="text-xs font-semibold text-foreground px-2">
                        {activeEvidenceSlide?.label}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg px-2.5 text-xs font-medium"
                        onClick={() =>
                          setEvidenceViewIndex((prev) => (prev + 1) % evidenceSlides.length)
                        }
                      >
                        Next
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs font-medium"
                  onClick={() => void handleDownloadEvidence()}
                  disabled={isEvidenceDownloading}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {isEvidenceDownloading
                    ? 'Downloading...'
                    : `Download ${evidenceViewIndex === 1 ? 'Plate Crop' : 'Evidence'}`}
                </Button>
              </div>

              <div className="relative flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 p-2">
                {activeEvidenceSlide?.isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-xs text-muted-foreground">Loading protected image...</p>
                  </div>
                ) : activeEvidenceSlide?.error ? (
                  <div className="px-6 text-center text-xs text-muted-foreground">
                    {activeEvidenceSlide.error}
                  </div>
                ) : (
                  <img
                    src={activeEvidenceSlide?.url}
                    alt={`${activeEvidenceSlide?.label || 'Evidence'} for violation #${
                      selectedEvidence.id_number || selectedEvidence.id
                    }`}
                    className="max-h-[65vh] w-full rounded-lg object-contain"
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
