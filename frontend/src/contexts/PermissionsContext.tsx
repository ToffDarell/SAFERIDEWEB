import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authService } from "@/services/auth";
import { usersService } from "@/services/users";
import {
  buildCurrentUser,
  DEFAULT_OPERATOR_PERMISSIONS,
  normalizePermissions,
  parseStoredCurrentUser,
  type CurrentUser,
  type OperatorPermissions,
  type PermissionKey,
} from "@/lib/permissions";

interface PermissionsContextValue {
  currentUser: CurrentUser | null;
  permissions: OperatorPermissions;
  isAdmin: boolean;
  isOperator: boolean;
  isLoading: boolean;
  hasPermission: (permissionKey: PermissionKey) => boolean;
  refreshCurrentUser: () => Promise<void>;
  setCurrentUser: (userData: CurrentUser | null) => void;
  clearCurrentUser: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(() => parseStoredCurrentUser());
  const [isLoading, setIsLoading] = useState(authService.isAuthenticated());

  const setCurrentUser = useCallback((userData: CurrentUser | null) => {
    const nextUser = buildCurrentUser(userData);
    setCurrentUserState(nextUser);
    if (nextUser) {
      localStorage.setItem("currentUser", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("currentUser");
    }
  }, []);

  const clearCurrentUser = useCallback(() => {
    setCurrentUser(null);
  }, [setCurrentUser]);

  const refreshCurrentUser = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setIsLoading(false);
      setCurrentUserState(null);
      return;
    }

    setIsLoading(true);
    try {
      const userData = await usersService.getCurrentUser();
      setCurrentUser(userData);
    } catch {
      setCurrentUserState(parseStoredCurrentUser());
    } finally {
      setIsLoading(false);
    }
  }, [setCurrentUser]);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  useEffect(() => {
    const syncStoredUser = () => {
      if (!authService.isAuthenticated()) {
        setCurrentUserState(null);
        setIsLoading(false);
        return;
      }
      setCurrentUserState(parseStoredCurrentUser());
    };

    window.addEventListener("storage", syncStoredUser);
    return () => window.removeEventListener("storage", syncStoredUser);
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isOperator = currentUser?.role === "tmc_operator";
  const permissions = useMemo(
    () =>
      normalizePermissions(
        isAdmin ? DEFAULT_OPERATOR_PERMISSIONS : currentUser?.permissions
      ),
    [currentUser?.permissions, isAdmin]
  );

  const hasPermission = useCallback(
    (permissionKey: PermissionKey) => isAdmin || Boolean(permissions[permissionKey]),
    [isAdmin, permissions]
  );

  const value = useMemo(
    () => ({
      currentUser,
      permissions,
      isAdmin,
      isOperator,
      isLoading,
      hasPermission,
      refreshCurrentUser,
      setCurrentUser,
      clearCurrentUser,
    }),
    [
      clearCurrentUser,
      currentUser,
      hasPermission,
      isAdmin,
      isLoading,
      isOperator,
      permissions,
      refreshCurrentUser,
      setCurrentUser,
    ]
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
