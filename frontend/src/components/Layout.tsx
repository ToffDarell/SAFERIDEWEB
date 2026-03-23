import { Link, useLocation, Outlet } from 'react-router-dom';
import { Camera, LayoutDashboard, AlertTriangle, Settings, LogOut, Bell, FileText, Menu, MonitorPlay, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useState } from 'react';
import { authService } from '@/services/auth';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { useViolationNotifications } from '@/hooks/use-notifications';

export const Layout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const adminNotifications = useAdminNotifications();
  const operatorNotifications = useLocalNotifications();
  const notifications = isAdmin ? adminNotifications.notifications : operatorNotifications.notifications;
  const unreadCount = isAdmin ? adminNotifications.unreadCount : operatorNotifications.unreadCount;
  const loading = isAdmin ? adminNotifications.loading : operatorNotifications.loading;
  const markAllAsRead = isAdmin ? adminNotifications.markAllAsRead : operatorNotifications.markAllAsRead;
  const deleteNotification = isAdmin ? adminNotifications.deleteNotification : operatorNotifications.deleteNotification;
  const notificationHeading = isAdmin ? 'Admin Notifications' : 'Notifications';
  const emptyNotificationMessage = isAdmin ? 'No admin notifications' : 'No notifications yet';

  useViolationNotifications();
  
  const handleLogout = () => {
    authService.logout();
    localStorage.removeItem('currentUser');
    setShowLogoutDialog(false);
    window.location.href = '/';
  };
  
  const isActive = (path: string) => location.pathname === path;
  
  const navItems = [
    { path: '/live-monitor', icon: MonitorPlay, label: 'Live Monitor' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/violations', icon: AlertTriangle, label: 'Violations' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/cameras', icon: Camera, label: 'Camera Status' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} flex shrink-0 flex-col border-r border-border bg-card transition-all duration-300`}>
        {/* Sidebar Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-[13px] font-medium text-foreground">SafeRide AI</h1>
                  <p className="app-hint-text">Helmet Detection</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5">
                <Camera className="h-5 w-5 text-primary" />
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
                className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-[13px] font-medium transition-all ${
                  isActive(item.path)
                    ? 'border-primary/20 bg-primary/10 text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
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
                <p className="truncate text-[13px] font-medium text-foreground">{currentUser.name || 'Admin'}</p>
                <p className="app-hint-text truncate">
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
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-card">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="app-page-heading">
                {navItems.find(item => item.path === location.pathname)?.label || 'SafeRide AI'}
              </h2>
            </div>
            
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <Badge className="app-badge-text absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="app-section-title">{notificationHeading}</h4>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={unreadCount > 0 ? 'default' : 'outline'}
                          className="h-6 px-2"
                        >
                          Unread {unreadCount}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[12px]"
                          onClick={markAllAsRead}
                          disabled={unreadCount === 0}
                        >
                          Read
                        </Button>
                        {loading && (
                          <span className="app-hint-text">Loading...</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {!loading && notifications.length === 0 ? (
                        <p className="app-body-text py-4 text-center text-muted-foreground">
                          {emptyNotificationMessage}
                        </p>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`group relative w-full rounded-lg border p-3 pr-12 text-left transition-colors ${
                              notification.is_read
                                ? 'bg-background'
                                : 'border-primary/20 bg-primary/5'
                            }`}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                              onClick={() => deleteNotification(notification.id)}
                              aria-label="Delete notification"
                              title="Delete notification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <p className="text-[13px] font-medium text-foreground">{notification.title}</p>
                            <p className="mt-1 text-[13px] text-muted-foreground">
                              {notification.message}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <p className="app-hint-text">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                              <Badge variant={notification.is_read ? 'outline' : 'default'} className="ml-2 h-5 px-1.5">
                                {notification.is_read ? 'READ' : 'UNREAD'}
                              </Badge>
                            </div>
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
        <main className="flex-1 overflow-auto bg-background p-6">
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
