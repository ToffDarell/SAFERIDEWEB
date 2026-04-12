import { useLocation, Outlet } from 'react-router-dom';
import { Bell, Menu, Moon, Sun, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useEffect, useState } from 'react';
import { authService } from '@/services/auth';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { useViolationNotifications } from '@/hooks/use-notifications';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getNavigationLabel, Sidebar } from '@/components/layout/Sidebar';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

export const Layout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isAdmin, clearCurrentUser } = usePermissions();
  const { resolvedTheme, setTheme } = useTheme();
  const isMobile = useIsMobile();
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile, location.pathname]);
  
  const handleLogout = () => {
    authService.logout();
    clearCurrentUser();
    setShowLogoutDialog(false);
    window.location.href = '/';
  };

  const isDarkMode = mounted && resolvedTheme === 'dark';

  const handleThemeToggle = () => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setTheme(isDarkMode ? 'light' : 'dark');
    window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 260);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && (
        <Sidebar
          currentPath={location.pathname}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onLogout={() => setShowLogoutDialog(true)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              {isMobile && (
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full"
                      aria-label="Open navigation"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[86vw] max-w-[320px] p-0 sm:max-w-[320px]">
                    <Sidebar
                      currentPath={location.pathname}
                      sidebarOpen
                      onToggleSidebar={() => setMobileNavOpen(false)}
                      onLogout={() => {
                        setMobileNavOpen(false);
                        setShowLogoutDialog(true);
                      }}
                      mobile
                      onNavigate={() => setMobileNavOpen(false)}
                    />
                  </SheetContent>
                </Sheet>
              )}
              <h2 className="app-page-heading truncate">
                {getNavigationLabel(location.pathname)}
              </h2>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-full px-3"
                onClick={handleThemeToggle}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </span>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative h-9 w-9 rounded-full p-0">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <Badge className="app-badge-text absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
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
                              className="absolute right-2 top-2 h-8 w-8 p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-4 sm:p-6">
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
