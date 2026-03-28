import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { camerasService, type Camera as BackendCamera } from '@/services/cameras';
import { useToast } from '@/hooks/use-toast';

interface MonitorCamera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  mjpegUrl: string;
}

const getFeedLabel = (camera: MonitorCamera) => {
  const name = camera.name.trim() || 'Camera';
  const location = camera.location.trim();
  if (!location) return name;
  if (name.toLowerCase().includes(location.toLowerCase())) return name;
  if (location.toLowerCase().includes(name.toLowerCase())) return location;
  return `${name} \u00b7 ${location}`;
};

const formatTimestamp = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const LiveMonitor = () => {
  const { toast } = useToast();
  const [backendCameras, setBackendCameras] = useState<BackendCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [cameraFilter, setCameraFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'focus'>('grid');
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadCameras = async () => {
      try {
        const response = await camerasService.getCameras();
        const list: BackendCamera[] = Array.isArray(response)
          ? response
          : response.results || [];
        const sorted = [...list].sort((a, b) => a.id - b.id);
        setBackendCameras(sorted);
      } catch (error) {
        console.error('Failed to load cameras:', error);
        toast({
          title: 'Camera load failed',
          description: 'Could not load cameras from the backend.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCameras();
    const interval = setInterval(loadCameras, 3000);
    return () => clearInterval(interval);
  }, [toast]);

  const monitorCameras = useMemo<MonitorCamera[]>(() => {
    return backendCameras.slice(0, 4).map((camera) => ({
      id: String(camera.id),
      name: camera.name?.trim() || '',
      location: camera.location?.trim() || '',
      status: (camera.is_live ?? camera.status === 'active') ? 'online' : 'offline',
      mjpegUrl: camera.stream_url || '',
    }));
  }, [backendCameras]);

  useEffect(() => {
    if (monitorCameras.length === 0) return;
    setFocusedCameraId((current) => {
      if (current && monitorCameras.some((c) => c.id === current)) return current;
      return monitorCameras[0].id;
    });
  }, [monitorCameras]);

  useEffect(() => {
    if (cameraFilter !== 'all') setFocusedCameraId(cameraFilter);
  }, [cameraFilter]);

  const filteredCameras = useMemo(() => {
    if (cameraFilter === 'all') return monitorCameras;
    return monitorCameras.filter((c) => c.id === cameraFilter);
  }, [cameraFilter, monitorCameras]);

  const focusedCamera = useMemo(() => {
    if (monitorCameras.length === 0) return null;
    if (cameraFilter !== 'all')
      return monitorCameras.find((c) => c.id === cameraFilter) ?? monitorCameras[0];
    return monitorCameras.find((c) => c.id === focusedCameraId) ?? monitorCameras[0];
  }, [cameraFilter, focusedCameraId, monitorCameras]);

  const monitorStatus = useMemo<'online' | 'offline'>(() => {
    if (cameraFilter !== 'all') {
      return filteredCameras.some((camera) => camera.status === 'online') ? 'online' : 'offline';
    }

    if (viewMode === 'focus' && focusedCamera) {
      return focusedCamera.status;
    }

    return filteredCameras.some((camera) => camera.status === 'online') ? 'online' : 'offline';
  }, [cameraFilter, filteredCameras, focusedCamera, viewMode]);

  const openFocusedView = (cameraId?: string) => {
    const next =
      cameraId ??
      (cameraFilter !== 'all' ? cameraFilter : focusedCameraId) ??
      monitorCameras[0]?.id;
    if (!next) return;
    setFocusedCameraId(next);
    setViewMode('focus');
  };

  if (isLoading && monitorCameras.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="app-hint-text">Loading live monitor...</p>
        </div>
      </div>
    );
  }

  if (!focusedCamera) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="app-page-heading">Live Monitor</h2>
          <p className="app-body-text text-muted-foreground">No cameras available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="app-page-heading">Live Monitor</h2>
        <p className="app-body-text text-muted-foreground">
          Real-time MJPEG feed from YOLO detection service
        </p>
      </div>

      {/* Filter bar */}
      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="w-full space-y-2 md:w-[320px]">
                <label className="app-label-text">Camera</label>
                <Select value={cameraFilter} onValueChange={setCameraFilter}>
                  <SelectTrigger className="h-[30px] rounded-md border-border bg-background text-[13px] transition-colors">
                    <SelectValue placeholder="All cameras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cameras</SelectItem>
                    {monitorCameras.map((camera) => (
                      <SelectItem key={camera.id} value={camera.id}>
                        {getFeedLabel(camera)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`h-[30px] rounded-md border px-3 text-[13px] font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  2×2 Grid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`h-[30px] rounded-md border px-3 text-[13px] font-medium transition-colors ${
                    viewMode === 'focus'
                      ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  onClick={() => openFocusedView()}
                >
                  View Camera
                </Button>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
                monitorStatus === 'online'
                  ? 'border border-[#9FE1CB] bg-[#F0FBF7]'
                  : 'border border-[#F3C7C3] bg-[#FEF3F2]'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  monitorStatus === 'online' ? 'bg-[#1D9E75]' : 'bg-[#D92D20]'
                }`}
              />
              <span
                className={`text-[11px] font-medium ${
                  monitorStatus === 'online' ? 'text-[#1D9E75]' : 'text-[#D92D20]'
                }`}
              >
                {monitorStatus === 'online' ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GRID VIEW */}
      {viewMode === 'grid' ? (
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="app-section-title">Camera Grid View</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredCameras.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E4E6ED] px-4 py-12 text-center">
                <p className="app-hint-text">No cameras available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredCameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-[#E4E6ED]"
                    style={{ backgroundColor: '#1A1A2E' }}
                  >
                    {camera.status === 'online' ? (
                      <MjpegFeed
                        url={camera.mjpegUrl}
                        label={getFeedLabel(camera)}
                      />
                    ) : (
                      <OfflineFeed />
                    )}
                    <FeedOverlay
                      camera={camera}
                      timestamp={formatTimestamp(currentTime)}
                      showViewButton
                      onView={() => openFocusedView(camera.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* FOCUS VIEW */
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="app-section-title">Focused Camera View</CardTitle>
              <p className="app-hint-text mt-1">{getFeedLabel(focusedCamera)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-[32px] rounded-md border border-border bg-background px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setViewMode('grid')}
            >
              Back to all cameras
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div
              className="relative h-[400px] overflow-hidden rounded-lg border border-[#E4E6ED]"
              style={{ backgroundColor: '#1A1A2E' }}
            >
              {focusedCamera.status === 'online' ? (
                <MjpegFeed
                  url={focusedCamera.mjpegUrl}
                  label={getFeedLabel(focusedCamera)}
                  fill
                />
              ) : (
                <OfflineFeed />
              )}
              <FeedOverlay
                camera={focusedCamera}
                timestamp={formatTimestamp(currentTime)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MjpegFeed = ({
  url,
  label,
  fill = false,
}: {
  url: string;
  label: string;
  fill?: boolean;
}) => {
  const [imgSrc, setImgSrc] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000;

  useEffect(() => {
    if (!url) {
      setFailed(true);
      setImgSrc('');
      return;
    }
    setImgSrc(url);
    setRetryCount(0);
    setFailed(false);
  }, [url]);

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => {
        setRetryCount((c) => c + 1);
        setImgSrc(url);
      }, RETRY_DELAY_MS);
    } else {
      setFailed(true);
    }
  };

  if (!url || failed) return <OfflineFeed />;
  if (!imgSrc) return null;

  return (
    <>
      <img
        key={`${imgSrc}-${retryCount}`}
        src={imgSrc}
        alt={`Live feed: ${label}`}
        className={
          fill
            ? 'h-full w-full object-cover'
            : 'absolute inset-0 h-full w-full object-cover'
        }
        onError={handleError}
      />
      {retryCount > 0 && retryCount < MAX_RETRIES && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(26,26,46,0.6)' }}
        >
          <div className="text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-white" />
            <p className="text-[11px] text-white/70">Connecting to stream...</p>
          </div>
        </div>
      )}
    </>
  );
};

const OfflineFeed = () => (
  <div className="flex h-full w-full items-center justify-center bg-[#2B2F3D]">
    <div className="text-center">
      <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-[13px] font-normal text-muted-foreground">Camera is offline</p>
    </div>
  </div>
);

const FeedOverlay = ({
  camera,
  timestamp,
  showViewButton = false,
  onView,
}: {
  camera: MonitorCamera;
  timestamp: string;
  showViewButton?: boolean;
  onView?: () => void;
}) => (
  <>
    <div
      className="absolute left-3 top-3 rounded-md px-2.5 py-1"
      style={{ backgroundColor: 'rgba(26,26,46,0.72)' }}
    >
      <span className="text-[11px] font-normal text-white/85">
        {getFeedLabel(camera)}
      </span>
    </div>

    {camera.status === 'online' && (
      <div
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md px-2.5 py-1"
        style={{ backgroundColor: 'rgba(26,26,46,0.72)' }}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#D92D20]" />
        <span className="text-[11px] font-normal text-white/85">REC</span>
      </div>
    )}

    <div className="absolute bottom-3 left-3">
      <span className="text-[11px] font-normal text-white/65">{timestamp}</span>
    </div>

    {showViewButton && (
      <div className="absolute inset-x-0 bottom-3 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="rounded-[5px] border border-white/15 px-3 py-1 text-[11px] font-normal text-white"
          style={{ backgroundColor: 'rgba(26,26,46,0.72)' }}
          onClick={onView}
        >
          View
        </button>
      </div>
    )}
  </>
);

export default LiveMonitor;
