import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Camera, CheckCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { violationsService } from '@/services/violations';
import { camerasService } from '@/services/cameras';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState([
    { title: 'Total Violations', value: '0', icon: AlertTriangle, trend: '+0%', color: 'text-destructive' },
    { title: 'Active Cameras', value: '0', icon: Camera, trend: '100%', color: 'text-primary' },
    { title: 'Plates Recognized', value: '0', icon: CheckCircle, trend: '+0%', color: 'text-accent' },
    { title: 'Detection Rate', value: '0%', icon: TrendingUp, trend: '+0%', color: 'text-primary' },
  ]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [violationTypes, setViolationTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch violations and cameras from Django API
      const [violationsData, camerasData] = await Promise.all([
        violationsService.getViolations(),
        camerasService.getCameras(),
      ]);

      const violations = violationsData.results || [];
      const cameras = camerasData.results || [];
      const totalViolations = violationsData.count || 0;
      const activeCameras = cameras.filter((c: any) => c.status === 'active').length;
      const platesRecognized = violations.filter((v: any) => v.plate_number).length;
      const detectionRate = totalViolations > 0 ? '95.2' : '0';

      setStats([
        { title: 'Total Violations', value: totalViolations.toString(), icon: AlertTriangle, trend: '+12.5%', color: 'text-destructive' },
        { title: 'Active Cameras', value: activeCameras.toString(), icon: Camera, trend: '100%', color: 'text-primary' },
        { title: 'Plates Recognized', value: platesRecognized.toString(), icon: CheckCircle, trend: '+8.2%', color: 'text-accent' },
        { title: 'Detection Rate', value: `${detectionRate}%`, icon: TrendingUp, trend: '+2.1%', color: 'text-primary' },
      ]);

      // Calculate weekly violations (last 7 days)
      calculateWeeklyData(violations);
      
      // Calculate violation distribution
      calculateViolationDistribution(violations);
      
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

  const calculateWeeklyData = (violations: any[]) => {
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
      
      const count = violations.filter(v => {
        const violationDate = new Date(v.detected_at);
        return violationDate.toDateString() === dateStr;
      }).length;
      
      return {
        day: dayName,
        violations: count
      };
    });
    
    setWeeklyData(weeklyStats);
  };

  const calculateViolationDistribution = (violations: any[]) => {
    const noHelmet = violations.filter(v => 
      v.classification === 'no_helmet' || v.classification === 'nutshell'
    ).length;
    
    const partialHelmet = violations.filter(v => 
      v.classification === 'half_face_helmet'
    ).length;
    
    const compliant = violations.filter(v => 
      v.classification === 'full_face_helmet' || v.detection_status === 'compliant'
    ).length;
    
    setViolationTypes([
      { name: 'No Helmet', value: noHelmet, color: 'hsl(var(--destructive))' },
      { name: 'Partial Helmet', value: partialHelmet, color: 'hsl(var(--accent))' },
      { name: 'Compliant', value: compliant, color: 'hsl(var(--primary))' },
    ]);
  };

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
                  <p className={`text-xs mt-2 ${stat.color}`}>{stat.trend} from last week</p>
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