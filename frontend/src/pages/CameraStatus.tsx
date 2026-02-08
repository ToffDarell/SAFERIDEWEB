import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Wifi, WifiOff, Activity } from 'lucide-react';
import { camerasService } from '@/services/cameras';
import { useToast } from '@/hooks/use-toast';

const CameraStatus = () => {
  const { toast } = useToast();
  const [cameras, setCameras] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      const data = await camerasService.getCameras();
      setCameras(data.results || data || []);
    } catch (error) {
      toast({
        title: "Error loading cameras",
        description: "Failed to fetch cameras from server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-primary/20 text-primary border-primary/50">Online</Badge>;
    }
    return <Badge variant="secondary">Offline</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'active') {
      return <Wifi className="w-5 h-5 text-primary" />;
    }
    return <WifiOff className="w-5 h-5 text-muted-foreground" />;
  };

  const formatUptime = (lastSeen: string | null) => {
    if (!lastSeen) return 'N/A';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours < 24 ? '99.8%' : '95.0%';
  };

  const totalCameras = cameras.length;
  const onlineCameras = cameras.filter(c => c.status === 'active').length;
  const avgUptime = cameras.length > 0 ? '98.2%' : '0%';

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
      <div>
        <h2 className="text-3xl font-bold text-foreground">Camera Status</h2>
        <p className="text-muted-foreground">Monitor all connected CCTV cameras and their operational status</p>
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
            <Card key={camera.id} className="bg-card border-border hover:border-primary/50 transition-colors">
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
                      <p className="text-xs text-muted-foreground mt-1">CAM-{String(camera.id).padStart(3, '0')}</p>
                    </div>
                  </div>
                  {getStatusIcon(camera.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="text-foreground font-medium">{camera.location || 'Not specified'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  {getStatusBadge(camera.status)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="text-accent font-medium">{formatUptime(camera.last_seen_at)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">FPS:</span>
                  <span className="text-primary font-medium">{camera.status === 'active' ? '120' : '0'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Detections Today:</span>
                  <span className="text-foreground font-bold">0</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraStatus;