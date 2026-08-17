import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { camerasService, type Camera as CameraType } from '@/services/cameras';
import {
  violationsService,
  type ViolationSummary,
} from '@/services/violations';
import {
  AlertTriangle,
  CalendarDays,
  Camera as CameraIcon,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type StatCard = {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
};

type WeeklyChartItem = {
  day: string;
  violations: number;
  fullDate: string;
};

type ViolationTypeItem = {
  name: string;
  value: number;
  color: string;
};

const EMPTY_SUMMARY: ViolationSummary = {
  total_violations: 0,
  pending_violations: 0,
  reviewed_violations: 0,
  resolved_violations: 0,
  today_violations: 0,
  this_week_violations: 0,
  by_class: [],
  by_camera: [],
};

const CHART_COLORS = [
  'hsl(var(--destructive))',
  'hsl(var(--primary))',
  'hsl(160 84% 39%)',
  'hsl(var(--muted-foreground))',
];

const Dashboard = () => {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [summary, setSummary] = useState<ViolationSummary>(EMPTY_SUMMARY);
  const [weeklyData, setWeeklyData] = useState<WeeklyChartItem[]>([]);
  const [violationTypes, setViolationTypes] = useState<ViolationTypeItem[]>([]);
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const canViewLiveMonitor = hasPermission('can_view_live_monitor');
  const canViewCameraStatus =
    hasPermission('can_view_cameras') ||
    hasPermission('can_manage_cameras') ||
    canViewLiveMonitor;
  const canAccessViolationAnalytics =
    hasPermission('can_view_violations') || hasPermission('can_view_reports');
  const canAccessCameraData = canViewCameraStatus;

  const loadDashboardData = async () => {
    if (!canAccessViolationAnalytics) {
      setSummary(EMPTY_SUMMARY);
      setWeeklyData([]);
      setViolationTypes([]);
      return;
    }

    try {
      const [summaryData, weeklyChart] = await Promise.all([
        violationsService.getSummary(),
        violationsService.getWeeklyChart(),
      ]);

      setSummary(summaryData);
      setWeeklyData(
        weeklyChart.map((item) => ({
          day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
          violations: item.count,
          fullDate: new Date(item.date).toLocaleDateString(),
        }))
      );
      setViolationTypes(
        summaryData.by_class.map((item, index) => ({
          name: item.label,
          value: item.count,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }))
      );
    } catch {
      toast({
        title: 'Error loading dashboard',
        description: 'Failed to fetch dashboard data from the server.',
        variant: 'destructive',
      });
    }
  };

  const loadCameras = async (showError = false) => {
    if (!canAccessCameraData) {
      setCameras([]);
      setSelectedCamera(null);
      return;
    }

    try {
      const data = await camerasService.getCameras();
      const rawList = Array.isArray(data)
        ? data
        : data && Array.isArray(data.results)
        ? data.results
        : [];
      const cameraList: CameraType[] = [...rawList].sort(
        (a: CameraType, b: CameraType) => a.id - b.id
      );

      setCameras(cameraList);
      setSelectedCamera((currentCamera) => {
        if (currentCamera) {
          return (
            cameraList.find((camera) => camera.id === currentCamera.id) ??
            cameraList.find((camera) => camera.status === 'active') ??
            cameraList[0] ??
            null
          );
        }

        return cameraList.find((camera) => camera.status === 'active') ?? cameraList[0] ?? null;
      });
    } catch {
      // Silently handle offline camera state
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([loadDashboardData(), loadCameras(true)]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
    const interval = setInterval(() => {
      void loadCameras();
    }, 10000);

    return () => clearInterval(interval);
  }, [canAccessCameraData, canAccessViolationAnalytics]);

  useEffect(() => {
    if (selectedCamera) {
      setStreamError(false);
      setStreamKey((currentKey) => currentKey + 1);
    }
  }, [selectedCamera?.id, selectedCamera?.status, selectedCamera?.stream_url]);

  useEffect(() => {
    if (!selectedCamera?.stream_url || selectedCamera.status !== 'active') return;

    // Some browsers keep the last MJPEG frame on screen when the socket stalls.
    // Periodically reconnect so the dashboard recovers without a manual refresh.
    // 10 s matches the STALE_THRESHOLD_MS in MjpegFeed on LiveMonitor.
    const interval = setInterval(() => {
      setStreamKey((currentKey) => currentKey + 1);
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedCamera?.id, selectedCamera?.status, selectedCamera?.stream_url]);

  const handleRefreshStream = () => {
    setStreamError(false);
    setStreamKey((currentKey) => currentKey + 1);
  };

  const selectedStreamUrl = selectedCamera?.stream_url
    ? `${selectedCamera.stream_url}${selectedCamera.stream_url.includes('?') ? '&' : '?'}t=${streamKey}`
    : '';

  const totalCameras = cameras.length;
  const onlineCameras = cameras.filter((camera) => camera.status === 'active').length;
  const offlineCameras = totalCameras - onlineCameras;

  const stats: StatCard[] = [
    {
      title: 'Total Cameras',
      value: totalCameras.toString(),
      subtitle: 'Configured camera feeds',
      icon: CameraIcon,
      color: 'text-primary',
    },
    {
      title: 'Online Cameras',
      value: onlineCameras.toString(),
      subtitle: offlineCameras > 0 ? `${offlineCameras} offline` : 'All cameras online',
      icon: Wifi,
      color: onlineCameras > 0 ? 'text-primary' : 'text-muted-foreground',
    },
    {
      title: 'Total Violations',
      value: summary.total_violations.toString(),
      subtitle: 'All recorded violations',
      icon: AlertTriangle,
      color: 'text-destructive',
    },
    {
      title: 'Pending Review',
      value: summary.pending_violations.toString(),
      subtitle: 'Awaiting action',
      icon: CheckCircle,
      color: 'text-orange-500',
    },
    {
      title: "Today's Violations",
      value: summary.today_violations.toString(),
      subtitle: 'Detected today',
      icon: CalendarDays,
      color: 'text-primary',
    },
    {
      title: 'This Week',
      value: summary.this_week_violations.toString(),
      subtitle: 'Last 7 days',
      icon: TrendingUp,
      color: 'text-primary',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="app-hint-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="app-page-heading">Dashboard</h2>
        <p className="app-body-text text-muted-foreground">Overview of helmet violation detection system</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <p className="app-label-text">{stat.title}</p>
                  <h3 className="mt-2 text-[18px] font-medium text-foreground">{stat.value}</h3>
                  <p className="app-hint-text mt-2">{stat.subtitle}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {canViewCameraStatus && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className={canViewLiveMonitor ? 'lg:col-span-4' : 'lg:col-span-12'}>
          <Card className="h-full bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="app-section-title">Camera Status</CardTitle>
              <Badge className="border-primary/30 bg-primary/10 text-primary">
                {onlineCameras} Online
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cameras.map((camera) => (
                  <button
                    key={camera.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      selectedCamera?.id === camera.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedCamera(camera)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{camera.name}</p>
                      <p className="app-hint-text truncate">
                        {camera.location || 'No location set'}
                      </p>
                    </div>
                    <span
                      className={`app-badge-text ml-3 flex shrink-0 items-center gap-1.5 ${
                        camera.status === 'active' ? 'text-green-500' : 'text-destructive'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          camera.status === 'active' ? 'bg-green-500' : 'bg-destructive'
                        }`}
                      />
                      {camera.status === 'active' ? 'Online' : 'Offline'}
                    </span>
                  </button>
                ))}

                {cameras.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
                    No cameras connected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>

          {canViewLiveMonitor && (
            <div className="lg:col-span-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="app-section-title">
                    Live Monitor - {selectedCamera?.name || 'Select a camera'}
                  </h3>
                  <p className="app-body-text text-muted-foreground">
                    Real-time feed based on the selected camera status.
                  </p>
                </div>
                {selectedCamera && (
                  <Button variant="outline" size="sm" onClick={handleRefreshStream}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                )}
              </div>

              <Card className="relative min-h-[400px] overflow-hidden border-border bg-[#1B1B2B]">
                {!selectedCamera ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20">
                    <CameraIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="app-body-text text-muted-foreground">Select a camera to view the feed</p>
                  </div>
                ) : selectedCamera.status !== 'active' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20">
                    <WifiOff className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="app-body-text text-muted-foreground">Camera is currently offline</p>
                  </div>
                ) : !selectedCamera.stream_url || streamError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20">
                    <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
                    <p className="app-body-text text-foreground">Stream unavailable</p>
                    <Button variant="outline" className="mt-4" onClick={handleRefreshStream}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry connection
                    </Button>
                  </div>
                ) : (
                  <div className="relative h-full min-h-[400px] w-full bg-[#1B1B2B]">
                    <div className="absolute left-4 top-4 z-10 rounded-full border border-border/60 bg-white/10 px-4 py-2 backdrop-blur-md">
                      <span className="feed-overlay-text text-[13px] font-medium">
                        {selectedCamera.name}
                      </span>
                      <span className="feed-overlay-muted px-2 text-[11px]">|</span>
                      <span className="feed-overlay-muted text-[11px]">
                        {selectedCamera.location || 'No location set'}
                      </span>
                    </div>
                    <div className="absolute right-4 top-4 z-10 rounded-full border border-border/60 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                      <span className="feed-overlay-text app-badge-text flex items-center gap-2 tracking-wider">
                        <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                        REC
                      </span>
                    </div>
                    <img
                      key={selectedStreamUrl}
                      src={selectedStreamUrl}
                      alt={`Live stream from ${selectedCamera.name}`}
                      className="h-full min-h-[400px] w-full object-cover"
                      onLoad={() => setStreamError(false)}
                      onError={() => setStreamError(true)}
                    />
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Weekly Violations (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}`, 'Violations']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                />
                <Bar dataKey="violations" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Violation Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {violationTypes.some((item) => item.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={violationTypes.filter((item) => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {violationTypes
                      .filter((item) => item.value > 0)
                      .map((entry, index) => (
                        <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-center text-muted-foreground">
                No violation distribution data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
