import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { Camera, LayoutDashboard, AlertTriangle, Settings, LogOut, Bell, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useEffect, useState } from 'react';

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  useEffect(() => {
    const storedNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    setNotifications(storedNotifications);
    
    // Simulate new violation notifications
    const interval = setInterval(() => {
      const newNotification = {
        id: Date.now(),
        message: `New violation detected at ${new Date().toLocaleTimeString()}`,
        time: new Date().toISOString(),
        read: false,
      };
      
      const updated = [newNotification, ...notifications].slice(0, 10);
      setNotifications(updated);
      localStorage.setItem('notifications', JSON.stringify(updated));
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
  };
  
  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Camera className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">SafeRide AI</h1>
              <p className="text-xs text-muted-foreground">Helmet Violation Detection</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right mr-4">
              <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">{currentUser.role === 'admin' ? 'Administrator' : 'TMC Operator'}</p>
            </div>
            
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
                      <p className="text-sm text-muted-foreground text-center py-4">No notifications</p>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`p-3 rounded-lg border ${notif.read ? 'bg-background' : 'bg-accent/10 border-accent'}`}
                        >
                          <p className="text-sm">{notif.message}</p>
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
            
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  isActive(item.path)
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
