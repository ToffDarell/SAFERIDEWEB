import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Violations from "./pages/Violations";
import CameraStatus from "./pages/CameraStatus";
import AdminLogin from "./pages/AdminLogin";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Registration from "./pages/Registration";
import Reports from "./pages/Reports";
import LiveMonitor from "./pages/LiveMonitor";

import { authService } from "./services/auth";
import { useState, useEffect } from "react";
import { PermissionsProvider } from "./contexts/PermissionsContext";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());

  // Listen for storage changes (when logout happens)
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(authService.isAuthenticated());
    };

    // Check auth on storage change (logout in another tab)
    window.addEventListener('storage', checkAuth);
    
    // Check auth periodically (for same-tab logout)
    const interval = setInterval(checkAuth, 100);

    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/" 
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AdminLogin />} 
              />
              <Route path="/landing" element={<Index />} />
              <Route path="/register" element={<Registration />} />
              
              {/* Protected Routes */}
              <Route element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route
                  path="/live-monitor"
                  element={
                    <ProtectedRoute requiredPermission="can_view_live_monitor">
                      <LiveMonitor />
                    </ProtectedRoute>
                  }
                />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route
                  path="/violations"
                  element={
                    <ProtectedRoute requiredPermission="can_view_violations">
                      <Violations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cameras"
                  element={
                    <ProtectedRoute requiredPermission={["can_view_cameras", "can_manage_cameras"]}>
                      <CameraStatus />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requiredPermission="can_view_reports">
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route path="/settings" element={<Settings />} />
              </Route>
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PermissionsProvider>
    </QueryClientProvider>
  );
};

export default App;
