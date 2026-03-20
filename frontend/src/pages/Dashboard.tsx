import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CalendarDays, CheckCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { violationsService } from '@/services/violations';
import { useToast } from '@/hooks/use-toast';
import { useViolationNotifications } from '@/hooks/use-notifications';

const Dashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState([
    { title: 'Total Violations', value: '0', subtitle: 'All recorded violations', icon: AlertTriangle, color: 'text-destructive' },
    { title: 'Pending Review', value: '0', subtitle: 'Awaiting action', icon: CheckCircle, color: 'text-orange-500' },
    { title: "Today's Violations", value: '0', subtitle: 'Detected today', icon: CalendarDays, color: 'text-accent' },
    { title: 'This Week', value: '0', subtitle: 'Last 7 days', icon: TrendingUp, color: 'text-primary' },
  ]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [violationTypes, setViolationTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [summary, weeklyChart] = await Promise.all([
        violationsService.getSummary(),
        violationsService.getWeeklyChart(),
      ]);

      setStats([
        { title: 'Total Violations', value: summary.total_violations.toString(), subtitle: 'All recorded violations', icon: AlertTriangle, color: 'text-destructive' },
        { title: 'Pending Review', value: summary.pending_violations.toString(), subtitle: 'Awaiting action', icon: CheckCircle, color: 'text-orange-500' },
        { title: "Today's Violations", value: summary.today_violations.toString(), subtitle: 'Detected today', icon: CalendarDays, color: 'text-accent' },
        { title: 'This Week', value: summary.this_week_violations.toString(), subtitle: 'Last 7 days', icon: TrendingUp, color: 'text-primary' },
      ]);

      setWeeklyData(
        weeklyChart.map((item) => ({
          day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
          violations: item.count,
          fullDate: new Date(item.date).toLocaleDateString(),
        }))
      );

      setViolationTypes(
        summary.by_class.map((item, index) => ({
          name: item.label,
          value: item.count,
          color: [
            'hsl(var(--destructive))',
            'hsl(var(--accent))',
            'hsl(var(--primary))',
            'hsl(var(--muted-foreground))',
          ][index % 4],
        }))
      );
    } catch (error) {
      toast({
        title: 'Error loading dashboard',
        description: 'Failed to fetch data from server',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useViolationNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Overview of helmet violation detection system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <h3 className="text-3xl font-bold text-foreground mt-2">{stat.value}</h3>
                  <p className={`text-xs mt-2 ${stat.color}`}>{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-lg bg-primary/10`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <CardTitle className="text-foreground">Violation Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={violationTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {violationTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
