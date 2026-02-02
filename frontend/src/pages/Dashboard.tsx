import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Camera, CheckCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const Dashboard = () => {
  const stats = [
    { title: 'Total Violations', value: '1,284', icon: AlertTriangle, trend: '+12.5%', color: 'text-destructive' },
    { title: 'Active Cameras', value: '24', icon: Camera, trend: '100%', color: 'text-primary' },
    { title: 'Plates Recognized', value: '3,891', icon: CheckCircle, trend: '+8.2%', color: 'text-accent' },
    { title: 'Detection Rate', value: '95.2%', icon: TrendingUp, trend: '+2.1%', color: 'text-primary' },
  ];

  const weeklyData = [
    { day: 'Mon', violations: 180 },
    { day: 'Tue', violations: 220 },
    { day: 'Wed', violations: 195 },
    { day: 'Thu', violations: 245 },
    { day: 'Fri', violations: 280 },
    { day: 'Sat', violations: 165 },
    { day: 'Sun', violations: 140 },
  ];

  const violationTypes = [
    { name: 'No Helmet', value: 856, color: 'hsl(var(--destructive))' },
    { name: 'Partial Helmet', value: 284, color: 'hsl(var(--accent))' },
    { name: 'Compliant', value: 2751, color: 'hsl(var(--primary))' },
  ];

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
            <CardTitle className="text-foreground">Weekly Violations</CardTitle>
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
