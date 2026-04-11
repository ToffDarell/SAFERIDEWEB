import { Navigate } from 'react-router-dom';
import { authService } from '@/services/auth';
import { usePermissions } from '@/contexts/PermissionsContext';
import type { PermissionKey } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionKey | PermissionKey[];
}

const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const isAuthenticated = authService.isAuthenticated();
  const { hasPermission, isLoading } = usePermissions();

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          <p className="app-hint-text">Loading your access...</p>
        </div>
      </div>
    );
  }

  if (
    requiredPermission &&
    !(Array.isArray(requiredPermission)
      ? requiredPermission.some((permissionKey) => hasPermission(permissionKey))
      : hasPermission(requiredPermission))
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
