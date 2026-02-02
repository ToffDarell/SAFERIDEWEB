import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Wifi, WifiOff, Activity } from 'lucide-react';

const CameraStatus = () => {
  const cameras = [
    {
      id: 'CAM-001',
      name: 'Main Street Junction',
      location: 'Sumpong',
      status: 'online',
      uptime: '99.8%',
      fps: '120',
      detections: 1284,
    },
    {
      id: 'CAM-002',
      name: 'Park Road Intersection',
      location: 'Casisang Landing',
      status: 'online',
      uptime: '98.5%',
      fps: '118',
      detections: 956,
    },
    {
      id: 'CAM-003',
      name: 'Highway 101 North',
      location: 'Highway 101 NB',
      status: 'online',
      uptime: '99.2%',
      fps: '120',
      detections: 1456,
    },
    {
      id: 'CAM-004',
      name: 'Downtown Plaza',
      location: 'Downtown Area',
      status: 'online',
      uptime: '97.9%',
      fps: '115',
      detections: 823,
    },
    {
      id: 'CAM-005',
      name: 'School Zone A',
      location: 'Central School',
      status: 'maintenance',
      uptime: '85.3%',
      fps: '0',
      detections: 0,
    },
    {
      id: 'CAM-006',
      name: 'Industrial Area',
      location: 'Factory District',
      status: 'online',
      uptime: '99.5%',
      fps: '119',
      detections: 654,
    },
  ];

  const getStatusBadge = (status: string) => {
    if (status === 'online') {
      return <Badge className="bg-primary/20 text-primary border-primary/50">Online</Badge>;
    }
    return <Badge variant="secondary">Maintenance</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'online') {
      return <Wifi className="w-5 h-5 text-primary" />;
    }
    return <WifiOff className="w-5 h-5 text-muted-foreground" />;
  };

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
                <h3 className="text-3xl font-bold text-foreground mt-2">24</h3>
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
                <h3 className="text-3xl font-bold text-primary mt-2">23</h3>
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
                <h3 className="text-3xl font-bold text-accent mt-2">98.2%</h3>
              </div>
              <Activity className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((camera) => (
          <Card key={camera.id} className="bg-card border-border hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    camera.status === 'online' ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Camera className={`w-6 h-6 ${
                      camera.status === 'online' ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-base text-foreground">{camera.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{camera.id}</p>
                  </div>
                </div>
                {getStatusIcon(camera.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Location:</span>
                <span className="text-foreground font-medium">{camera.location}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                {getStatusBadge(camera.status)}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uptime:</span>
                <span className="text-accent font-medium">{camera.uptime}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">FPS:</span>
                <span className="text-primary font-medium">{camera.fps}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Detections Today:</span>
                <span className="text-foreground font-bold">{camera.detections}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CameraStatus;
