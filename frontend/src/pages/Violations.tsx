import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Download, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { violationsService } from '@/services/violations';

const Violations = () => {
  const { toast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.role === 'admin';
  
  const [violations, setViolations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadViolations();
    
    // Poll for new violations every 10 seconds
    const interval = setInterval(async () => {
      const data = await violationsService.getViolations();
      const newViolations = data.results || [];
      
      // Check for new violations
      newViolations.forEach((newV: any) => {
        const exists = violations.find(v => v.id === newV.id);
        if (!exists && newV.detection_status === 'violation') {
          // New violation detected - add notification
          const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
          notifications.unshift({
            id: Date.now(),
            message: `New violation detected: ${newV.plate_number || 'Unknown'} at ${newV.camera_name}`,
            time: new Date().toISOString(),
            read: false,
          });
          localStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 50)));
          
          toast({
            title: "New Violation Detected",
            description: `${newV.plate_number || 'Unknown'} at ${newV.camera_name}`,
          });
        }
      });
      
      setViolations(newViolations);
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [violations]);

  const loadViolations = async () => {
    try {
      const data = await violationsService.getViolations();
      const violationsData = data.results || [];
      
      // Load persisted review statuses from localStorage
      const savedStatuses = JSON.parse(localStorage.getItem('violationStatuses') || '{}');
      
      // Merge saved statuses with fetched data
      const mergedViolations = violationsData.map((v: any) => ({
        ...v,
        reviewStatus: savedStatuses[v.id] || v.reviewStatus || 'Pending'
      }));
      
      setViolations(mergedViolations);
    } catch (error) {
      toast({
        title: "Error loading violations",
        description: "Failed to fetch violations from server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = (violationId: number, newStatus: string) => {
    // Update state
    setViolations(prev => 
      prev.map(v => v.id === violationId ? { ...v, reviewStatus: newStatus } : v)
    );
    
    // Persist to localStorage
    const savedStatuses = JSON.parse(localStorage.getItem('violationStatuses') || '{}');
    savedStatuses[violationId] = newStatus;
    localStorage.setItem('violationStatuses', JSON.stringify(savedStatuses));
    
    // Add notification
    const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    notifications.unshift({
      id: Date.now(),
      message: `Violation #${violationId} status updated to ${newStatus}`,
      time: new Date().toISOString(),
      read: false,
    });
    localStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 50)));

    toast({
      title: "Status Updated",
      description: `Violation #${violationId} marked as ${newStatus}`,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  const getStatusBadge = (classification: string) => {
    if (classification === 'no_helmet' || classification === 'nutshell') {
      return 'No Helmet';
    } else if (classification === 'half_face_helmet') {
      return 'Partial Helmet';
    } else {
      return 'Full Face Helmet';
    }
  };

  const filteredViolations = violations.filter(v => 
    v.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.camera_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading violations...</p>
        </div>
      </div>
    );
  }

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
              placeholder="Search by plate number or camera..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredViolations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No violations found
            </div>
          ) : (
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
                  {filteredViolations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell className="font-medium">#{violation.id}</TableCell>
                      <TableCell>{formatDate(violation.detected_at)}</TableCell>
                      <TableCell>{formatTime(violation.detected_at)}</TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-primary">
                          {violation.plate_number || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>{violation.camera_name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            violation.classification === 'no_helmet' || violation.classification === 'nutshell'
                              ? 'destructive' 
                              : 'secondary'
                          }
                        >
                          {getStatusBadge(violation.classification)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-accent font-medium">
                          {(violation.confidence_score * 100).toFixed(1)}%
                        </span>
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
                          {violation.reviewStatus || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={violation.reviewStatus || 'Pending'}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Violations;