import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Reports = () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isOperator = currentUser.role === 'tmc_operator';
  const { toast } = useToast();

  const handleGenerateReport = () => {
    toast({
      title: 'Report Generation Started',
      description: 'Generate Completed',
    });
  };

  const summaryData = [
    { title: 'Total Violations', value: '156', icon: AlertCircle, trend: '+12%', color: 'text-destructive' },
    { title: 'Reviewed', value: '98', icon: CheckCircle, trend: '+8%', color: 'text-accent' },
    { title: 'Resolved', value: '78', icon: CheckCircle, trend: '+15%', color: 'text-green-500' },
    { title: 'Pending', value: '58', icon: TrendingUp, trend: '-5%', color: 'text-orange-500' },
  ];

  const weeklyData = [
    { day: 'Mon', violations: 18 },
    { day: 'Tue', violations: 24 },
    { day: 'Wed', violations: 19 },
    { day: 'Thu', violations: 28 },
    { day: 'Fri', violations: 32 },
    { day: 'Sat', violations: 20 },
    { day: 'Sun', violations: 15 },
  ];

  const recentViolations = [
    { id: 1, plate: 'ABC-1234', date: '2025-10-29', location: 'Main St & 5th Ave', status: 'Resolved' },
    { id: 2, plate: 'XYZ-5678', date: '2025-10-29', location: 'Park Rd & Oak St', status: 'Reviewed' },
    { id: 3, plate: 'DEF-9012', date: '2025-10-29', location: 'Highway 101', status: 'Pending' },
  ];

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
          <CardTitle className="text-foreground">Weekly Violations Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
