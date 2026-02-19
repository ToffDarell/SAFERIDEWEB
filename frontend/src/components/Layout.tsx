import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Camera, LayoutDashboard, AlertTriangle, Settings, LogOut, Bell, FileText, Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useEffect, useState } from 'react';
import { authService } from '@/services/auth';
import { violationsService } from '@/services/violations';

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications  ] = useState<any[]>([]);
  const [lastViolationId, setLastViolationId] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  useEffect(() => {
    // Check if we need to reset notifications for a new day
    const today = new Date().toDateString();
    const lastNotificationDate = localStorage.getItem('lastNotificationDate');
    
    if (lastNotificationDate !== today) {
      // New day - reset notifications
      localStorage.setItem('notifications', '[]');
      localStorage.setItem('lastNotificationDate', today);
      localStorage.setItem('lastViolationId', '0');
      setNotifications([]);
      setLastViolationId(0);
    } else {
      // Same day - load existing notifications
      const storedNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
      setNotifications(storedNotifications);
      
      const storedLastId = parseInt(localStorage.getItem('lastViolationId') || '0');
      setLastViolationId(storedLastId);
    }
    
    // Poll for new violations every 5 seconds
    const pollInterval = setInterval(async () => {
      try {
        const data = await violationsService.getViolations({ ordering: '-id', page_size: 1 });
        const latestViolation = data.results?.[0];
        
        // Only create notification if there's a NEW violation (higher ID than last seen)
        if (latestViolation && latestViolation.id > lastViolationId) {
          const newNotification = {
            id: Date.now(),
            violationId: latestViolation.id,
            message: `New violation detected: ${latestViolation.plate_number || 'Unknown plate'} at ${latestViolation.camera_name || 'Unknown location'}`,
            time: new Date().toISOString(),
            read: false,
          };
          
          setNotifications(prev => {
            const updated = [newNotification, ...prev].slice(0, 50); // Keep last 50 notifications
            localStorage.setItem('notifications', JSON.stringify(updated));
            return updated;
          });
          
          // Update last seen violation ID
          setLastViolationId(latestViolation.id);
          localStorage.setItem('lastViolationId', latestViolation.id.toString());
          
          console.log(`✅ New violation detected: ID ${latestViolation.id}`);
        }
      } catch (error) {
        console.error('Failed to poll violations:', error);
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(pollInterval);
  }, [lastViolationId]);
  
  const handleLogout = () => {
    authService.logout();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('notifications');
    localStorage.removeItem('lastViolationId');
    localStorage.removeItem('lastNotificationDate');
    setShowLogoutDialog(false);
    navigate('/');
  };
  
  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem('notifications', JSON.stringify(updated));
  };
  
  const dismissNotification = (notificationId: number) => {
    const updated = notifications.filter(n => n.id !== notificationId);
    setNotifications(updated);
    localStorage.setItem('notifications', JSON.stringify(updated));
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/violations', icon: AlertTriangle, label: 'Violations' },
    { path: '/cameras', icon: Camera, label: 'Camera Status' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">SafeRide AI</h1>
                  <p className="text-xs text-muted-foreground">Helmet Detection</p>
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6 text-primary-foreground" />
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={!sidebarOpen ? 'hidden' : ''}
            >
              <Menu className="w-4 h-4" />
            </Button>
          </div>
          {!sidebarOpen && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mt-2 w-full"
            >
              <Menu className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-border">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">{currentUser.name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentUser.role === 'admin' ? 'Administrator' : 'TMC Operator'}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowLogoutDialog(true)}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Logout</span>
              </Button>
            </div>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowLogoutDialog(true)}
              className="w-full"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-foreground">
                {navItems.find(item => item.path === location.pathname)?.label || 'SafeRide AI'}
              </h2>
            </div>
            
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Notifications</h4>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                          Mark all read
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No notifications today</p>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            className={`p-3 rounded-lg border relative group ${notif.read ? 'bg-background' : 'bg-accent/10 border-accent'}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => dismissNotification(notif.id)}
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                            <p className="text-sm pr-6">{notif.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notif.time).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You will need to sign in again to access the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};