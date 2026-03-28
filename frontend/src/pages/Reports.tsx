import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { violationsService, type Violation } from '@/services/violations';
import apiClient from '@/services/api';
import { camerasService } from '@/services/cameras';
import { usePermissions } from '@/contexts/PermissionsContext';

type CameraLocationOption = {
  location?: string | null;
};

type WeeklyDataPoint = {
  day: string;
  violations: number;
  fullDate: string;
};

const Reports = () => {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const canExportReports = hasPermission('can_export_reports');
  
  const [violations, setViolations] = useState<Violation[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  // Filters
  const [filterYear, setFilterYear] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterDetectionStatus, setFilterDetectionStatus] = useState('all');
  const [filterReviewStatus, setFilterReviewStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, [filterYear, filterDate, filterLocation, filterDetectionStatus, filterReviewStatus]);

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
        ).sort((a, b) => a.localeCompare(b));

        setLocationOptions(nextLocations);
      } catch (error) {
        console.error('Failed to load report locations:', error);
      }
    };

    loadLocations();
  }, []);

  const loadData = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterYear !== 'all') params.year = filterYear;
      if (filterDate !== 'all') params.date = filterDate;
      if (filterLocation !== 'all') params.location = filterLocation;
      if (filterDetectionStatus !== 'all') params.detection_status = filterDetectionStatus;
      if (filterReviewStatus !== 'all') params.review_status = filterReviewStatus;

      const data = await violationsService.getViolations(params);
      const violationsData: Violation[] = data.results || [];
      
      setViolations(violationsData);
      calculateWeeklyData(violationsData);
    } catch (error) {
      toast({
        title: "Error loading data",
        description: "Failed to fetch violations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateWeeklyData = (violationsData: Violation[]) => {
    const today = new Date();
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      last7Days.push(date);
    }
    
    const weeklyStats = last7Days.map(date => {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toDateString();
      
      const count = violationsData.filter(v => {
        const violationDate = new Date(v.detected_at);
        return violationDate.toDateString() === dateStr;
      }).length;
      
      return {
        day: dayName,
        violations: count,
        fullDate: date.toLocaleDateString()
      };
    });
    
    setWeeklyData(weeklyStats);
  };

  const handleGenerateReport = async (format: 'xlsx' | 'pdf') => {
    try {
      toast({
        title: 'Generating Report...',
        description: `Preparing your ${format.toUpperCase()} file`,
      });

      const params = new URLSearchParams();
      params.append('export_format', format);
      if (filterYear !== 'all') params.append('year', filterYear);
      if (filterDate !== 'all') params.append('date', filterDate);
      if (filterLocation !== 'all') params.append('location', filterLocation);
      if (filterDetectionStatus !== 'all') params.append('detection_status', filterDetectionStatus);
      if (filterReviewStatus !== 'all') params.append('review_status', filterReviewStatus);

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
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `saferide_violations_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `violations.${format} downloaded successfully`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Could not generate report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const totalViolations = violations.filter(v => v.detection_status === 'violation').length;
  const reviewedViolations = violations.filter(v => v.review_status === 'reviewed').length;
  const resolvedViolations = violations.filter(v => v.review_status === 'resolved').length;
  const pendingViolations = violations.filter(
    v => !v.review_status || v.review_status === 'pending'
  ).length;

  const summaryData = [
    { title: 'Total Violations', value: totalViolations.toString(), icon: AlertCircle, trend: '+12%', color: 'text-destructive' },
    { title: 'Reviewed', value: reviewedViolations.toString(), icon: CheckCircle, trend: '+8%', color: 'text-primary' },
    { title: 'Resolved', value: resolvedViolations.toString(), icon: CheckCircle, trend: '+15%', color: 'text-green-500' },
    { title: 'Pending', value: pendingViolations.toString(), icon: TrendingUp, trend: '-5%', color: 'text-orange-500' },
  ];

  const recentViolations = violations.slice(0, 3).map(v => ({
    id: v.id_number || v.id,
    plate: v.plate_number || 'N/A',
    date: new Date(v.detected_at).toLocaleDateString(),
    location: v.camera_location || v.camera_name || 'Unknown',
    status: v.review_status
      ? v.review_status.charAt(0).toUpperCase() + v.review_status.slice(1)
      : 'Pending'
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="app-hint-text">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="app-page-heading">Violation Reports</h2>
          <p className="app-body-text text-muted-foreground">Comprehensive violation analytics</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canExportReports && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleGenerateReport('xlsx')}
                variant="outline"
                className="h-11 rounded-xl px-4 text-sm font-semibold shadow-none"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              <Button
                type="button"
                onClick={() => handleGenerateReport('pdf')}
                className="h-11 rounded-xl px-4 text-sm font-semibold shadow-none"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          )}
        </div>
      </div>



      <Card className="bg-card border-border mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="app-section-title">Filter By</CardTitle>
              <p className="app-hint-text mt-1">Year ID, date, location, status, and review status</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[12px]"
              onClick={() => {
                setFilterYear('all');
                setFilterDate('all');
                setFilterLocation('all');
                setFilterDetectionStatus('all');
                setFilterReviewStatus('all');
              }}
            >
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="app-label-text">Year ID</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="app-label-text">Date</label>
              <Select value={filterDate} onValueChange={setFilterDate}>
                <SelectTrigger><SelectValue placeholder="All Time" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past Week</SelectItem>
                  <SelectItem value="month">Past Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="app-label-text">Location</label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger><SelectValue placeholder="All Locations" /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="All Reviews" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryData.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="app-label-text">{item.title}</p>
                    <h3 className="mt-2 text-[18px] font-medium text-foreground">{item.value}</h3>
                    <p className="app-hint-text mt-2">{item.trend} from last week</p>
                  </div>
                  <Icon className={`h-10 w-10 ${item.color} opacity-25`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="app-section-title">Weekly Violations Trend (Last 7 Days)</CardTitle>
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
                  borderRadius: '8px'
                }}
                formatter={(value: number | string) => [`${value} violations`, 'Count']}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullDate;
                  }
                  return label;
                }}
              />
              <Bar dataKey="violations" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Violations Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {recentViolations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No violations found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentViolations.map((violation) => (
                  <TableRow key={violation.id_number || violation.id}>
                    <TableCell className="font-medium">#{violation.id_number || violation.id}</TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-foreground">
                        {violation.plate}
                      </span>
                    </TableCell>
                    <TableCell>{violation.date}</TableCell>
                    <TableCell>{violation.location}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          violation.status === 'Resolved' 
                            ? 'default' 
                            : violation.status === 'Reviewed' 
                            ? 'secondary' 
                            : 'destructive'
                        }
                      >
                        {violation.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
