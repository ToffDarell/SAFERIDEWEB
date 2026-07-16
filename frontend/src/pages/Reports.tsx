import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { violationsService, type Violation, type ViolationSummary } from '@/services/violations';
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

type ReportsDateFilterMode =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'specific_date'
  | 'specific_month';

type WeekOption = {
  value: string;
  label: string;
  dateFrom: string;
  dateTo: string;
};

const REPORT_START_YEAR = 2023;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const buildYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return Array.from(
    { length: currentYear - REPORT_START_YEAR + 1 },
    (_, index) => String(currentYear - index)
  );
};

const buildWeekOptions = (year: number, month: number): WeekOption[] => {
  const lastDay = new Date(year, month, 0).getDate();
  const options: WeekOption[] = [];

  for (let startDay = 1, weekIndex = 1; startDay <= lastDay; startDay += 7, weekIndex += 1) {
    const endDay = Math.min(startDay + 6, lastDay);
    const startDate = new Date(year, month - 1, startDay);
    const endDate = new Date(year, month - 1, endDay);
    options.push({
      value: String(weekIndex),
      label: `Week ${weekIndex} (${MONTH_NAMES[month - 1].slice(0, 3)} ${startDay}-${endDay})`,
      dateFrom: toIsoDate(startDate),
      dateTo: toIsoDate(endDate),
    });
  }

  return options;
};

const buildReportFilterParams = ({
  filterYear,
  filterDateMode,
  specificDate,
  specificMonth,
  filterLocation,
  filterDetectionStatus,
  filterReviewStatus,
}: {
  filterYear: string;
  filterDateMode: ReportsDateFilterMode;
  specificDate: string;
  specificMonth: string;
  filterLocation: string;
  filterDetectionStatus: string;
  filterReviewStatus: string;
}) => {
  const params: Record<string, string> = {};

  if (filterYear !== 'all') params.year = filterYear;
  if (filterDateMode !== 'all' && filterDateMode !== 'specific_date' && filterDateMode !== 'specific_month') {
    params.date = filterDateMode;
  }
  if (filterDateMode === 'specific_date' && specificDate) {
    params.specific_date = specificDate;
  }
  if (filterDateMode === 'specific_month' && specificMonth) {
    params.specific_month = specificMonth;
  }
  if (filterLocation !== 'all') params.location = filterLocation;
  if (filterDetectionStatus !== 'all') params.detection_status = filterDetectionStatus;
  if (filterReviewStatus !== 'all') params.review_status = filterReviewStatus;

  return params;
};

const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isCompleteMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);

const Reports = () => {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const canExportReports = hasPermission('can_export_reports');

  const today = new Date();
  const defaultWeek = String(Math.floor((today.getDate() - 1) / 7) + 1);

  const [summary, setSummary] = useState<ViolationSummary | null>(null);
  const [recentViolations, setRecentViolations] = useState<Violation[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  const [filterYear, setFilterYear] = useState('all');
  const [filterDateMode, setFilterDateMode] = useState<ReportsDateFilterMode>('all');
  const [specificDate, setSpecificDate] = useState('');
  const [specificMonth, setSpecificMonth] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterDetectionStatus, setFilterDetectionStatus] = useState('all');
  const [filterReviewStatus, setFilterReviewStatus] = useState('all');

  const [chartYear, setChartYear] = useState(() => String(today.getFullYear()));
  const [chartMonth, setChartMonth] = useState(() => String(today.getMonth() + 1));
  const [chartWeek, setChartWeek] = useState(defaultWeek);

  const yearOptions = buildYearOptions();
  const weekOptions = buildWeekOptions(Number(chartYear), Number(chartMonth));
  const selectedWeek = weekOptions.find((option) => option.value === chartWeek) ?? weekOptions[0] ?? null;

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

  useEffect(() => {
    const validWeekOptions = buildWeekOptions(Number(chartYear), Number(chartMonth));
    if (!validWeekOptions.some((option) => option.value === chartWeek) && validWeekOptions[0]) {
      setChartWeek(validWeekOptions[0].value);
    }
  }, [chartYear, chartMonth, chartWeek]);

  useEffect(() => {
    if (filterYear !== 'all') {
      setChartYear(filterYear);
    }
  }, [filterYear]);

  useEffect(() => {
    if (filterDateMode === 'specific_month' && specificMonth) {
      const [year, month] = specificMonth.split('-');
      if (year && month) {
        setChartYear(year);
        setChartMonth(String(Number(month)));
      }
    }
  }, [filterDateMode, specificMonth]);

  useEffect(() => {
    if (filterDateMode === 'specific_date' && specificDate && !isCompleteDate(specificDate)) {
      return;
    }
    if (filterDateMode === 'specific_month' && specificMonth && !isCompleteMonth(specificMonth)) {
      return;
    }

    const loadData = async () => {
      try {
        if (!hasLoadedOnceRef.current) {
          setIsLoading(true);
        }

        const reportParams = buildReportFilterParams({
          filterYear,
          filterDateMode,
          specificDate: isCompleteDate(specificDate) ? specificDate : '',
          specificMonth: isCompleteMonth(specificMonth) ? specificMonth : '',
          filterLocation,
          filterDetectionStatus,
          filterReviewStatus,
        });

        const chartParams: Record<string, string | number> = {
          ...reportParams,
          page_size: 3,
        };

        const selectedChartWeek = buildWeekOptions(Number(chartYear), Number(chartMonth)).find(
          (option) => option.value === chartWeek
        );
        const weeklyChartParams: Record<string, string> = {
          ...(filterLocation !== 'all' ? { location: filterLocation } : {}),
          ...(filterDetectionStatus !== 'all' ? { detection_status: filterDetectionStatus } : {}),
          ...(filterReviewStatus !== 'all' ? { review_status: filterReviewStatus } : {}),
        };

        if (selectedChartWeek) {
          weeklyChartParams.date_from = selectedChartWeek.dateFrom;
          weeklyChartParams.date_to = selectedChartWeek.dateTo;
        }

        const [summaryResponse, recentResponse, weeklyResponse] = await Promise.all([
          violationsService.getSummary(reportParams),
          violationsService.getViolations(chartParams),
          violationsService.getWeeklyChart(weeklyChartParams),
        ]);

        setSummary(summaryResponse);
        setRecentViolations(recentResponse.results || []);
        setWeeklyData(
          weeklyResponse.map((point) => {
            const pointDate = parseIsoDate(point.date);
            return {
              day: pointDate.toLocaleDateString('en-US', { weekday: 'short' }),
              violations: point.count,
              fullDate: pointDate.toLocaleDateString(),
            };
          })
        );
      } catch (error) {
        toast({
          title: 'Error loading data',
          description: 'Failed to fetch violation reports.',
          variant: 'destructive',
        });
      } finally {
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
      }
    };

    void loadData();
  }, [
    filterYear,
    filterDateMode,
    specificDate,
    specificMonth,
    filterLocation,
    filterDetectionStatus,
    filterReviewStatus,
    chartYear,
    chartMonth,
    chartWeek,
    toast,
  ]);

  const handleDateModeChange = (value: ReportsDateFilterMode) => {
    setFilterDateMode(value);
    if (value !== 'specific_date') {
      setSpecificDate('');
    }
    if (value !== 'specific_month') {
      setSpecificMonth('');
    }
  };

  const handleGenerateReport = async (format: 'xlsx' | 'pdf') => {
    try {
      toast({
        title: 'Generating Report...',
        description: `Preparing your ${format.toUpperCase()} file`,
      });

      const filterParams = buildReportFilterParams({
        filterYear,
        filterDateMode,
        specificDate: isCompleteDate(specificDate) ? specificDate : '',
        specificMonth: isCompleteMonth(specificMonth) ? specificMonth : '',
        filterLocation,
        filterDetectionStatus,
        filterReviewStatus,
      });

      const blob = await violationsService.exportViolations(filterParams, format);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
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

  const summaryData = [
    {
      title: 'Total Violations',
      value: String(summary?.total_violations ?? 0),
      icon: AlertCircle,
      subtitle: 'Filtered records',
      color: 'text-destructive',
    },
    {
      title: 'Reviewed',
      value: String(summary?.reviewed_violations ?? 0),
      icon: CheckCircle,
      subtitle: 'Reviewed records',
      color: 'text-primary',
    },
    {
      title: 'Resolved',
      value: String(summary?.resolved_violations ?? 0),
      icon: CheckCircle,
      subtitle: 'Resolved records',
      color: 'text-green-500',
    },
    {
      title: 'Pending',
      value: String(summary?.pending_violations ?? 0),
      icon: TrendingUp,
      subtitle: 'Pending review',
      color: 'text-orange-500',
    },
  ];

  const recentViolationsSummary = recentViolations.map((violation) => ({
    id: violation.id_number || violation.id,
    plate: violation.plate_number || 'N/A',
    date: new Date(violation.detected_at).toLocaleDateString(),
    location: violation.camera_location || violation.camera_name || 'Unknown',
    status: violation.review_status
      ? violation.review_status.charAt(0).toUpperCase() + violation.review_status.slice(1)
      : 'Pending',
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
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

      <Card className="bg-card border-border mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="app-section-title">Filter By</CardTitle>
              <p className="app-hint-text mt-1">Year, date, location, status, and review status</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[12px]"
              onClick={() => {
                setFilterYear('all');
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
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label className="app-label-text">Year</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="app-label-text">Date Filter</label>
              <Select value={filterDateMode} onValueChange={(value) => handleDateModeChange(value as ReportsDateFilterMode)}>
                <SelectTrigger><SelectValue placeholder="All Time" /></SelectTrigger>
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
                    <p className="app-hint-text mt-2">{item.subtitle}</p>
                  </div>
                  <Icon className={`h-10 w-10 ${item.color} opacity-25`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="app-section-title">Weekly Violations Trend</CardTitle>
              <p className="app-hint-text mt-1">
                {selectedWeek
                  ? `Showing ${selectedWeek.label} of ${MONTH_NAMES[Number(chartMonth) - 1]} ${chartYear}`
                  : 'Select a year, month, and week to view the trend.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="app-label-text">Year</label>
                <Select value={chartYear} onValueChange={setChartYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="app-label-text">Month</label>
                <Select value={chartMonth} onValueChange={setChartMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((monthName, index) => (
                      <SelectItem key={monthName} value={String(index + 1)}>
                        {monthName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="app-label-text">Week</label>
                <Select value={chartWeek} onValueChange={setChartWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weekOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
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
          {recentViolationsSummary.length === 0 ? (
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
                {recentViolationsSummary.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell className="font-medium">#{violation.id}</TableCell>
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
