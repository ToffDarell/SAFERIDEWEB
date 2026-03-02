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

  // Read preferences saved from Settings page
  const prefs = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  const itemsPerPage: number = prefs.itemsPerPage || 25;
  const defaultFilter: string = prefs.defaultFilter || 'all';
  const showConfidence: boolean = prefs.showConfidence !== false;

  const [violations, setViolations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState(defaultFilter);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadViolations();
    
    const interval = setInterval(async () => {
      if (currentPage !== 1) return;
      
      const data = await violationsService.getViolations({ page: 1 });
      const newViolations = data.results || [];
      
      newViolations.forEach((newV: any) => {
        const exists = violations.find(v => v.id === newV.id);
        if (!exists && newV.detection_status === 'violation') {
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
    }, 10000);
    
    return () => clearInterval(interval);
  }, [currentPage]);

  const loadViolations = async () => {
    setIsLoading(true);
    try {
      const data = await violationsService.getViolations({ page: currentPage, page_size: itemsPerPage });
      const violationsList = data.results || [];
      const count = data.count || 0;
      
      setTotalItems(count);
      setTotalPages(Math.ceil(count / itemsPerPage));

      setViolations(violationsList);
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

  const handleStatusUpdate = async (violationId: number, newStatus: string) => {
    const validStatus = newStatus.toLowerCase() as 'pending' | 'reviewed' | 'resolved';

    // Step 1: Optimistic UI update immediately
    setViolations(prev =>
      prev.map(v => v.id === violationId ? { ...v, review_status: validStatus } : v)
    );

    try {
      // Step 2: PATCH to backend
      await violationsService.updateReviewStatus(violationId, validStatus);

      // Step 3: Notification
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
    } catch (error) {
      // Step 4: Revert on failure
      setViolations(prev =>
        prev.map(v => v.id === violationId ? { ...v, review_status: 'pending' } : v)
      );
      toast({
        title: "Update Failed",
        description: "Could not save status. Please try again.",
        variant: "destructive",
      });
    }
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

  const filteredViolations = violations.filter(v => {
    const matchesSearch =
      v.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.camera_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterStatus === 'all' ||
      (v.review_status || 'pending') === filterStatus;
    return matchesSearch && matchesFilter;
  });

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
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by plate number or camera..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Violations</SelectItem>
                <SelectItem value="pending">Pending Only</SelectItem>
                <SelectItem value="reviewed">Reviewed Only</SelectItem>
                <SelectItem value="resolved">Resolved Only</SelectItem>
              </SelectContent>
            </Select>
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
                    {showConfidence && <TableHead>Confidence</TableHead>}
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
                      {showConfidence && (
                        <TableCell>
                          <span className="text-accent font-medium">
                            {(violation.confidence_score * 100).toFixed(1)}%
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge 
                          variant={
                            violation.review_status === 'resolved'
                              ? 'default' 
                              : violation.review_status === 'reviewed'
                              ? 'secondary' 
                              : 'destructive'
                          }
                        >
                          {violation.review_status
                            ? violation.review_status.charAt(0).toUpperCase() + violation.review_status.slice(1)
                            : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select 
                            value={violation.review_status || 'pending'}
                            onValueChange={(value) => handleStatusUpdate(violation.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="reviewed">
                                <div className="flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  Reviewed
                                </div>
                              </SelectItem>
                              <SelectItem value="resolved">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing page {currentPage} of {totalPages} ({totalItems} total)
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Violations;