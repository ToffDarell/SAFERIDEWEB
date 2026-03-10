import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Maximize2, Minimize2, RefreshCw, WifiOff } from 'lucide-react';
import { camerasService, type Camera as CameraType } from '@/services/cameras';
import { useToast } from '@/hooks/use-toast';

const LiveMonitor = () => {
  const { toast } = useToast();
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadCameras, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCamera) {
      setStreamError(false);
      setStreamKey(k => k + 1);
    }
  }, [selectedCamera]);

  const loadCameras = async () => {
    try {
      const data = await camerasService.getCameras();
      const list: CameraType[] = (data.results || data || []).sort((a: CameraType, b: CameraType) => a.id - b.id);
      setCameras(list);
      // Auto-select first active camera if none selected
      setSelectedCamera(prev => {
        if (prev) {
          // Refresh selected camera's data
          const updated = list.find(c => c.id === prev.id);
          return updated ?? prev;
        }
        return list.find(c => c.status === 'active') ?? list[0] ?? null;
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to load cameras.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStream = () => {
    setStreamError(false);
    setStreamKey(k => k + 1);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">Live Monitor</h2>
        <p className="text-muted-foreground">Real-time camera feeds with active helmet detection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Stream */}
        <div className="lg:col-span-4 space-y-4">
          {/* Camera Selector */}
          {cameras.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cameras.map((cam) => (
                <Button
                  key={cam.id}
                  variant={selectedCamera?.id === cam.id ? 'default' : 'outline'}
                  size="sm"
                  className="flex items-center gap-2 shrink-0"
                  onClick={() => setSelectedCamera(cam)}
                >
                  <Camera className="w-4 h-4" />
                  {cam.name}
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cam.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground'
                    }`}
                  />
                </Button>
              ))}
            </div>
          )}

          {/* Stream Viewer */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">
                  {selectedCamera ? selectedCamera.name : 'No Camera Selected'}
                </CardTitle>
                {selectedCamera && (
                  <Badge
                    className={selectedCamera.status === 'active'
                      ? 'bg-primary/20 text-primary border-primary/50 flex items-center gap-1'
                      : ''}
                    variant={selectedCamera.status === 'active' ? 'outline' : 'secondary'}
                  >
                    {selectedCamera.status === 'active' && (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
                    )}
                    {selectedCamera.status === 'active' ? 'Live' : 'Offline'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleRefreshStream} title="Refresh stream">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(f => !f)}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className={`relative bg-black ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}>
                {isFullscreen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullscreen(false)}
                    className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
                  >
                    <Minimize2 className="w-5 h-5" />
                  </Button>
                )}

                {!selectedCamera ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center space-y-2">
                      <Camera className="w-12 h-12 mx-auto opacity-30" />
                      <p className="text-sm">Select a camera to view the live feed</p>
                    </div>
                  </div>
                ) : selectedCamera.status !== 'active' ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center space-y-2">
                      <WifiOff className="w-12 h-12 mx-auto opacity-30" />
                      <p className="text-sm">Camera is offline</p>
                    </div>
                  </div>
                ) : streamError ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center space-y-3">
                      <Camera className="w-12 h-12 mx-auto opacity-30" />
                      <p className="text-sm">Stream unavailable</p>
                      <Button size="sm" variant="outline" onClick={handleRefreshStream}>
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : (
                  <img
                    key={streamKey}
                    ref={imgRef}
                    src={selectedCamera.stream_url}
                    alt={`Live feed – ${selectedCamera.name}`}
                    className="w-full h-full object-contain"
                    onError={() => setStreamError(true)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default LiveMonitor;
