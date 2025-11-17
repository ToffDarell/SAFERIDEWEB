import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Download, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const Violations = () => {
  const { toast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.role === 'admin';
  
  const [violations, setViolations] = useState([
    {
      id: 1,
      date: '2025-10-29',
      time: '14:35:22',
      plate: 'ABC-1234',
      location: 'Main St & 5th Ave',
      status: 'No Helmet',
      reviewStatus: 'Pending',
      confidence: '96.5%',
    },
    {
      id: 2,
      date: '2025-10-29',
      time: '14:28:15',
      plate: 'XYZ-5678',
      location: 'Park Rd & Oak St',
      status: 'No Helmet',
      reviewStatus: 'Reviewed',
      confidence: '94.2%',
    },
    {
      id: 3,
      date: '2025-10-29',
      time: '14:15:43',
      plate: 'DEF-9012',
      location: 'Highway 101',
      status: 'Partial Helmet',
      reviewStatus: 'Pending',
      confidence: '89.7%',
    },
    {
      id: 4,
      date: '2025-10-29',
      time: '13:52:08',
      plate: 'GHI-3456',
      location: 'Main St & 5th Ave',
      status: 'No Helmet',
      reviewStatus: 'Resolved',
      confidence: '97.8%',
    },
    {
      id: 5,
      date: '2025-10-29',
      time: '13:45:31',
      plate: 'JKL-7890',
      location: 'Downtown Plaza',
      status: 'No Helmet',
      reviewStatus: 'Pending',
      confidence: '93.4%',
    },
    {
      id: 6,
      date: '2025-10-29',
      time: '13:22:56',
      plate: 'MNO-2345',
      location: 'Park Rd & Oak St',
      status: 'Partial Helmet',
      reviewStatus: 'Reviewed',
      confidence: '88.9%',
    },
    {
      id: 7,
      date: '2025-10-29',
      time: '12:58:19',
      plate: 'PQR-6789',
      location: 'Highway 101',
      status: 'No Helmet',
      reviewStatus: 'Pending',
      confidence: '95.6%',
    },
    {
      id: 8,
      date: '2025-10-29',
      time: '12:33:44',
      plate: 'STU-0123',
      location: 'Main St & 5th Ave',
      status: 'No Helmet',
      reviewStatus: 'Reviewed',
      confidence: '92.3%',
    },
  ]);

  const handleStatusUpdate = (violationId: number, newStatus: string) => {
    setViolations(prev => 
      prev.map(v => v.id === violationId ? { ...v, reviewStatus: newStatus } : v)
    );
    
    // Add notification
    const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    notifications.unshift({
      id: Date.now(),
      message: `Violation #${violationId} status updated to ${newStatus}`,
      time: new Date().toISOString(),
      read: false,
    });
    localStorage.setItem('notifications', JSON.stringify(notifications));

    toast({
      title: "Status Updated",
      description: `Violation #${violationId} marked as ${newStatus}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Violations</h2>
          <p className="text-muted-foreground">Detected helmet violations and plate recognition</p>
        </div>
        {isAdmin && (
          <Button variant="outline">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        )}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Violations</CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by plate number..."
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Review Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell className="font-medium">#{violation.id}</TableCell>
                    <TableCell>{violation.date}</TableCell>
                    <TableCell>{violation.time}</TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-primary">
                        {violation.plate}
                      </span>
                    </TableCell>
                    <TableCell>{violation.location}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={violation.status === 'No Helmet' ? 'destructive' : 'secondary'}
                      >
                        {violation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-accent font-medium">{violation.confidence}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          violation.reviewStatus === 'Resolved' 
                            ? 'default' 
                            : violation.reviewStatus === 'Reviewed' 
                            ? 'secondary' 
                            : 'destructive'
                        }
                      >
                        {violation.reviewStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={violation.reviewStatus}
                          onValueChange={(value) => handleStatusUpdate(violation.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Reviewed">
                              <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                Reviewed
                              </div>
                            </SelectItem>
                            <SelectItem value="Resolved">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Resolved
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Violations;
