import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/contexts/PermissionsContext";
import type { PermissionKey } from "@/lib/permissions";

type NavItem = {
  path: string;
  label: string;
  icon: typeof Camera;
  permission?: PermissionKey | PermissionKey[];
};

export const NAV_ITEMS: NavItem[] = [
  { path: "/live-monitor", icon: MonitorPlay, label: "Live Monitor", permission: "can_view_live_monitor" },
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/violations", icon: AlertTriangle, label: "Violations", permission: "can_view_violations" },
  { path: "/reports", icon: FileText, label: "Reports", permission: "can_view_reports" },
  { path: "/cameras", icon: Camera, label: "Manage Cameras", permission: ["can_view_cameras", "can_manage_cameras"] },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export const getNavigationLabel = (path: string) =>
  NAV_ITEMS.find((item) => item.path === path)?.label || "SafeRide AI";

interface SidebarProps {
  currentPath: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function Sidebar({
  currentPath,
  sidebarOpen,
  onToggleSidebar,
  onLogout,
}: SidebarProps) {
  const { currentUser, hasPermission } = usePermissions();

  const navItems = NAV_ITEMS.filter(
    (item) =>
      !item.permission ||
      (Array.isArray(item.permission)
        ? item.permission.some((permissionKey) => hasPermission(permissionKey))
        : hasPermission(item.permission))
  );

  const isActive = (path: string) => currentPath === path;

  return (
    <aside
      className={`${
        sidebarOpen ? "w-64" : "w-20"
      } flex shrink-0 flex-col border-r border-border bg-card transition-all duration-300`}
    >
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-primary/10 shadow-sm">
                <img
                  src="/tmc.jpg"
                  alt="Traffic Management Center logo"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-[13px] font-medium text-foreground">SafeRide AI</h1>
                <p className="app-hint-text">Helmet Detection</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-primary/10 shadow-sm">
              <img
                src="/tmc.jpg"
                alt="Traffic Management Center logo"
                className="h-full w-full rounded-full object-cover"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className={!sidebarOpen ? "hidden" : ""}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        {!sidebarOpen && (
          <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="mt-2 w-full">
            <Menu className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-[13px] font-medium transition-all ${
                isActive(item.path)
                  ? "border-primary/20 bg-primary/10 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={!sidebarOpen ? item.label : ""}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        {sidebarOpen ? (
          <div className="space-y-2">
            <div className="px-3 py-2">
              <p className="truncate text-[13px] font-medium text-foreground">
                {currentUser?.name || "SafeRide User"}
              </p>
              <p className="app-hint-text truncate">
                {currentUser?.role === "admin" ? "TMC Administrator" : "TMC Operator"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={onLogout} className="w-full" title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
