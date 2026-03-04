import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Wifi, WifiOff, Activity, Eye, RefreshCw } from 'lucide-react';
import { camerasService, type Camera as CameraType } from '@/services/cameras';
import { useToast } from '@/hooks/use-toast';


const CameraStatus = () => {
  const { toast } = useToast();
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [violationCounts, setViolationCounts] = useState<Record<number, number>>({});


  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadCameras, 2000);
    return () => clearInterval(interval);
  }, []);


  const fetchViolationCounts = async (cameraList: CameraType[]) => {
    const counts: Record<number, number> = {};
    const today = new Date().toISOString().split('T')[0];

    await Promise.all(
      cameraList.map(async (cam) => {
        try {
          const res = await fetch(
            `http://127.0.0.1:8000/api/violations/?camera=${cam.id}&date=${today}`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
              },
            }
          );
          const data = await res.json();
          counts[cam.id] = data.count ?? (data.results?.length ?? 0);
        } catch {
          counts[cam.id] = 0;
        }
      })
    );
    setViolationCounts(counts);
  };


  const loadCameras = async () => {
    if (cameras.length > 0) setIsRefreshing(true);

    try {
      const data = await camerasService.getCameras();
      const list = data.results || data || [];
      setCameras(list);
      await fetchViolationCounts(list);
    } catch (error) {
      toast({
        title: "Error loading cameras",
        description: "Failed to fetch cameras from server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };


  const handleCameraClick = async (camera: CameraType) => {
    try {
      const latest = await camerasService.getCamera(camera.id);

      if (latest.status !== 'active') {
        toast({
          title: "Camera Offline",
          description: "This camera is currently offline and cannot be viewed.",
          variant: "destructive"
        });
        return;
      }

      if (!latest.stream_url) {
        toast({
          title: "No Stream Available",
          description: "This camera does not have a stream URL configured.",
          variant: "destructive"
        });
        return;
      }

      setSelectedCamera(latest);
      setIsModalOpen(true);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load latest camera data.",
        variant: "destructive"
      });
    }
  };


  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/50 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
          Online
        </Badge>
      );
    }
    return <Badge variant="secondary">Offline</Badge>;
  };


  const getStatusIcon = (status: string) => {
    if (status === 'active') return <Wifi className="w-5 h-5 text-primary" />;
    return <WifiOff className="w-5 h-5 text-muted-foreground" />;
  };


  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };


  const formatUptime = (lastSeen: string | null) => {
    if (!lastSeen) return 'N/A';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours < 24 ? '99.8%' : '95.0%';
  };


  const getStreamUrl = (camera: CameraType) => {
    // YOLO now stores the MJPEG URL (http://127.0.0.1:8081/stream)
    // directly in camera.stream_url — use it directly, no auth needed
    return camera.stream_url || '';
  };


  const totalCameras  = cameras.length;
  const onlineCameras = cameras.filter(c => c.status === 'active').length;
  const offlineCameras = totalCameras - onlineCameras;
  const avgUptime     = cameras.length > 0 ? '98.2%' : '0%';


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading cameras...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Camera Status</h2>
          <p className="text-muted-foreground">
            Monitor all connected CCTV cameras and their operational status
          </p>
        </div>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Updating...
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cameras</p>
                <h3 className="text-3xl font-bold text-foreground mt-2">{totalCameras}</h3>
              </div>
              <Camera className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Online</p>
                <h3 className="text-3xl font-bold text-primary mt-2">{onlineCameras}</h3>
                {offlineCameras > 0 && (
                  <p className="text-xs text-destructive mt-1">{offlineCameras} offline</p>
                )}
              </div>
              <Wifi className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Uptime</p>
                <h3 className="text-3xl font-bold text-accent mt-2">{avgUptime}</h3>
              </div>
              <Activity className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Grid */}
      {cameras.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No cameras configured yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <Card
              key={camera.id}
              className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => handleCameraClick(camera)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      camera.status === 'active' ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Camera className={`w-6 h-6 ${
                        camera.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-base text-foreground">{camera.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        CAM-{String(camera.id).padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(camera.status)}
                    {camera.status === 'active' && (
                      <Eye className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="text-foreground font-medium">
                    {camera.location || 'Not specified'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  {getStatusBadge(camera.status)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Seen:</span>
                  <span className={`font-medium ${
                    camera.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {formatLastSeen(camera.last_seen_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="text-accent font-medium">
                    {formatUptime(camera.last_seen_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">FPS:</span>
                  <span className="text-primary font-medium">
                    {camera.status === 'active' ? '15' : '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Detections Today:</span>
                  <span className="text-foreground font-bold">
                    {violationCounts[camera.id] ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Live View Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {selectedCamera?.name} - Live View
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {selectedCamera?.stream_url ? (
                <img
                  src={getStreamUrl(selectedCamera)}
                  alt="Live Camera Stream"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    toast({
                      title: "Stream Error",
                      description: "Failed to load camera stream.",
                      variant: "destructive"
                    });
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No stream URL configured</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium">{selectedCamera?.location || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <div>{selectedCamera && getStatusBadge(selectedCamera.status)}</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Camera ID</p>
                <p className="text-sm font-medium">
                  CAM-{String(selectedCamera?.id).padStart(3, '0')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Last Seen</p>
                <p className="text-sm font-medium text-accent">
                  {selectedCamera && formatLastSeen(selectedCamera.last_seen_at)}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};


export default CameraStatus;
