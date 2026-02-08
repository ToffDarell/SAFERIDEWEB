import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { violationsService } from '@/services/violations';

const Reports = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isOperator = currentUser.role === 'tmc_operator';
  const { toast } = useToast();
  
  const [violations, setViolations] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await violationsService.getViolations();
      const violationsData = data.results || [];
      
      // Load persisted review statuses from localStorage (same as Violations page)
      const savedStatuses = JSON.parse(localStorage.getItem('violationStatuses') || '{}');
      
      // Merge saved statuses with fetched data
      const mergedViolations = violationsData.map((v: any) => ({
        ...v,
        reviewStatus: savedStatuses[v.id] || v.reviewStatus || 'Pending'
      }));
      
      setViolations(mergedViolations);
      
      // Calculate real weekly data
      calculateWeeklyData(mergedViolations);
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

  const calculateWeeklyData = (violationsData: any[]) => {
    // Get the last 7 days
    const today = new Date();
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      last7Days.push(date);
    }
    
    // Count violations per day
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

  const handleGenerateReport = () => {
    toast({
      title: 'Report Generation Started',
      description: 'Generate Completed',
    });
  };

  // Calculate stats using merged statuses
  const totalViolations = violations.filter(v => v.detection_status === 'violation').length;
  const reviewedViolations = violations.filter(v => v.reviewStatus === 'Reviewed').length;
  const resolvedViolations = violations.filter(v => v.reviewStatus === 'Resolved').length;
  const pendingViolations = violations.filter(v => !v.reviewStatus || v.reviewStatus === 'Pending').length;

  const summaryData = [
    { title: 'Total Violations', value: totalViolations.toString(), icon: AlertCircle, trend: '+12%', color: 'text-destructive' },
    { title: 'Reviewed', value: reviewedViolations.toString(), icon: CheckCircle, trend: '+8%', color: 'text-accent' },
    { title: 'Resolved', value: resolvedViolations.toString(), icon: CheckCircle, trend: '+15%', color: 'text-green-500' },
    { title: 'Pending', value: pendingViolations.toString(), icon: TrendingUp, trend: '-5%', color: 'text-orange-500' },
  ];

  const recentViolations = violations.slice(0, 3).map(v => ({
    id: v.id,
    plate: v.plate_number || 'N/A',
    date: new Date(v.detected_at).toLocaleDateString(),
    location: v.camera_name || 'Unknown',
    status: v.reviewStatus || 'Pending'
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Violation Reports</h2>
          <p className="text-muted-foreground">
            {isOperator ? 'Read-only violation summaries' : 'Comprehensive violation analytics'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isOperator && (
            <Button onClick={handleGenerateReport}>
              <FileText className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          )}
          <FileText className="w-8 h-8 text-primary" />
        </div>
      </div>

      {isOperator && (
        <Card className="bg-card border-border border-orange-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-500">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">
                TMC Operators have read-only access. Export and system configuration are disabled.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryData.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                    <h3 className="text-3xl font-bold text-foreground mt-2">{item.value}</h3>
                    <p className={`text-sm mt-2 ${item.color}`}>{item.trend} from last week</p>
                  </div>
                  <Icon className={`w-12 h-12 ${item.color} opacity-20`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Weekly Violations Trend (Last 7 Days)</CardTitle>
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
                formatter={(value: any) => [`${value} violations`, 'Count']}
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
                  <TableHead>ID</TableHead>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentViolations.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell className="font-medium">#{violation.id}</TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-primary">
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