import { Fragment, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bell, Shield, Database, Monitor, User, Palette, Eye, EyeOff, Lock, Camera, Users, AlertCircle, Trash2, RefreshCw, ChevronDown, ChevronUp, History, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { API_BASE } from '@/config';
import apiClient from '@/services/api';
import { usersService } from '@/services/users';
import { usePermissions } from '@/contexts/PermissionsContext';
import { normalizePermissions, PERMISSION_TOGGLE_ITEMS, type PermissionKey } from '@/lib/permissions';
import { useIsMobile } from '@/hooks/use-mobile';

function getAuthHeaders() {
  // Support both storage keys: 'accessToken' (used elsewhere) and 'access_token'
  const token = localStorage.getItem("accessToken") || localStorage.getItem("access_token") || '';
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, isAdmin, refreshCurrentUser } = usePermissions();
  const isMobile = useIsMobile();

  // Persist selected tab in the URL query param `tab` so refresh keeps the same tab
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    const qp = searchParams.get('tab') || 'profile';
    if (qp !== activeTab) setActiveTab(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [newOperator, setNewOperator] = useState({ name: '', email: '', password: '', role: 'tmc_operator' });
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [creatingOperator, setCreatingOperator] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOpPassword, setShowOpPassword] = useState(false);

  // Detection Settings state
  const [detectionSettings, setDetectionSettings] = useState({
    confidence_threshold: 0.60,
    send_cooldown_seconds: 3.0,
    data_retention_days: 90,
    ocr_confidence: 0.20,
    conf_no_helmet: 0.55,
    conf_nutshell: 0.65,
    conf_helmet: 0.60,
    conf_license_plate: 0.60,
  });

  // Notification Settings state (persisted to localStorage)
  const [notificationSettings, setNotificationSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('notificationSettings');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        live_violation_popups: parsed.live_violation_popups ?? true,
        notification_sound: parsed.notification_sound ?? false,
        auto_hide_ms: parsed.auto_hide_ms ?? 5000,
      };
    } catch {
      return { live_violation_popups: true, notification_sound: false, auto_hide_ms: 5000 };
    }
  });

  // Preferences state
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('userPreferences');
    return saved ? JSON.parse(saved) : {
      itemsPerPage: 25,
      defaultFilter: 'all',
      showConfidence: true,
    };
  });

  // Manage Users state
  const [showManageUsers, setShowManageUsers] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [expandedPermissionUserId, setExpandedPermissionUserId] = useState<number | null>(null);
  const [updatingPermissionStates, setUpdatingPermissionStates] = useState<Record<string, boolean>>({});
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'tmc_operator'>('all');
  const [userDateFilter, setUserDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Pending Registrations state
  const [showPending, setShowPending] = useState(false);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const activityNotifications = useAdminNotifications('activity');

  useEffect(() => {
    if (currentUser) {
      loadSystemSettings();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'detection') {
      loadSystemSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isAdmin && (activeTab === 'users' || activeTab === 'activity')) {
      setActiveTab('profile');
      setSearchParams({ tab: 'profile' });
    }
  }, [activeTab, isAdmin, setSearchParams]);

  const formatActivityTime = (value: string) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const activityLog = isAdmin ? activityNotifications.notifications : [];

  const syncUserPermissions = (userId: number, permissions: Record<string, boolean>) => {
    setUsersList((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              permissions,
              profile: {
                ...user.profile,
                permissions,
              },
            }
          : user
      )
    );
  };

  const getPermissionsForUser = (user: any) =>
    normalizePermissions(user?.permissions || user?.profile?.permissions);

  const getUserAccountStatus = (user: any) =>
    String(user?.profile?.status ?? user?.status ?? 'approved').toLowerCase();

  const loadSystemSettings = async () => {
    try {
      const resp = await fetch(`${API_BASE}/settings/`, { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      setDetectionSettings({
        confidence_threshold:  data.confidence_threshold  != null ? parseFloat(data.confidence_threshold)  : 0.60,
        send_cooldown_seconds: data.send_cooldown_seconds != null ? parseFloat(data.send_cooldown_seconds) : 3.0,
        data_retention_days:   data.data_retention_days  != null ? parseInt(data.data_retention_days)     : 90,
        ocr_confidence:        data.ocr_confidence        != null ? parseFloat(data.ocr_confidence)        : 0.20,
        conf_no_helmet:        data.conf_no_helmet         != null ? parseFloat(data.conf_no_helmet)        : 0.55,
        conf_nutshell:         data.conf_nutshell          != null ? parseFloat(data.conf_nutshell)         : 0.65,
        conf_helmet:           data.conf_helmet            != null ? parseFloat(data.conf_helmet)           : 0.60,
        conf_license_plate:    data.conf_license_plate     != null ? parseFloat(data.conf_license_plate)    : 0.60,
      });
    } catch {}
  };

  // ── Manage Users helpers ──────────────────────────────────────────────────────
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await usersService.getUsers();
      setUsersList(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Could not load users.', variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleManageUsers = () => {
    const next = !showManageUsers;
    setShowManageUsers(next);
    if (next && usersList.length === 0) loadUsers();
  };

  const handlePermissionToggle = async (
    userId: number,
    permissionKey: PermissionKey,
    nextValue: boolean
  ) => {
    const userRecord = usersList.find((user) => user.id === userId);
    if (!userRecord) {
      return;
    }

    const previousPermissions = getPermissionsForUser(userRecord);
    const nextPermissions = {
      ...previousPermissions,
      [permissionKey]: nextValue,
    };
    const requestKey = `${userId}:${permissionKey}`;

    syncUserPermissions(userId, nextPermissions);
    setUpdatingPermissionStates((prev) => ({ ...prev, [requestKey]: true }));

    try {
      const updatedPermissions = await usersService.updatePermissions(userId, {
        [permissionKey]: nextValue,
      });
      syncUserPermissions(userId, updatedPermissions);
      toast({
        title: 'Permission Updated',
        description: 'Operator permissions were saved successfully.',
      });
    } catch (err: any) {
      syncUserPermissions(userId, previousPermissions);
      toast({
        title: 'Permission Update Failed',
        description: err?.message ?? 'Could not save operator permissions.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPermissionStates((prev) => {
        const next = { ...prev };
        delete next[requestKey];
        return next;
      });
    }
  };

  // ── Pending Registrations helpers ─────────────────────────────────────────────
  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const resp = await fetch(`${API_BASE}/users/pending/`, { headers: getAuthHeaders() });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setPendingList(Array.isArray(data) ? data : (data.results ?? []));
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Could not load pending users.', variant: 'destructive' });
    } finally {
      setLoadingPending(false);
    }
  };

  const togglePending = () => {
    const next = !showPending;
    setShowPending(next);
    if (next) loadPending();
  };

  const handleApproveOrReject = async (userId: number, action: 'approve' | 'reject', name: string) => {
    setProcessingId(userId);
    try {
      const resp = await fetch(`${API_BASE}/users/${userId}/${action}/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error(await resp.text());

      const nextStatus = action === 'approve' ? 'approved' : 'rejected';
      setPendingList((prev) => prev.filter((u) => u.id !== userId));
      setUsersList((prev) =>
        prev
          .map((user) =>
            user.id === userId
              ? {
                  ...user,
                  status: nextStatus,
                  profile: {
                    ...(user.profile ?? {}),
                    status: nextStatus,
                  },
                }
              : user
          )
          .filter((user) => getUserAccountStatus(user) !== 'rejected')
      );
      toast({
        title: action === 'approve' ? 'User Approved' : 'User Rejected',
        description: `"${name}" has been ${action === 'approve' ? 'approved and can now log in' : 'rejected'}.`,
      });
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.message ?? `Could not ${action} user.`, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    setDeletingUserId(userId);
    try {
      const resp = await fetch(`${API_BASE}/users/${userId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (resp.status === 204 || resp.ok) {
        setUsersList((prev) => prev.filter((u) => u.id !== userId));
        toast({ title: 'User Deleted', description: `"${username}" has been removed.` });
      } else {
        const body = await resp.text();
        throw new Error(body);
      }
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message ?? 'Could not delete user.', variant: 'destructive' });
    } finally {
      setDeletingUserId(null);
    }
  };

  const matchesUserDateFilter = (createdAt?: string | null) => {
    if (userDateFilter === 'all') {
      return true;
    }

    if (!createdAt) {
      return false;
    }

    const joinedDate = new Date(createdAt);
    if (Number.isNaN(joinedDate.getTime())) {
      return false;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (userDateFilter === 'today') {
      return joinedDate >= startOfToday;
    }

    if (userDateFilter === 'week') {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - 6);
      return joinedDate >= startOfWeek;
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return joinedDate >= startOfMonth;
  };

  const filteredUsersList = usersList.filter((user) => {
    const role = user.profile?.role ?? user.role ?? 'tmc_operator';
    if (userRoleFilter !== 'all' && role !== userRoleFilter) {
      return false;
    }

    if (getUserAccountStatus(user) === 'rejected') {
      return false;
    }

    return matchesUserDateFilter(user.profile?.created_at ?? null);
  });

  const handleExportFilteredUsers = () => {
    if (filteredUsersList.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No admin or operator accounts match the current filters.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Name', 'Username', 'Email', 'Role', 'Status', 'Organization', 'Registered'];
    const rows = filteredUsersList.map((user) => {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
      const role = user.profile?.role ?? user.role ?? 'tmc_operator';
      const status = user.profile?.status ?? user.status ?? 'approved';
      const organization = user.profile?.organization ?? '';
      const registered = user.profile?.created_at
        ? new Date(user.profile.created_at).toLocaleDateString()
        : '';

      return [
        fullName,
        user.username ?? '',
        user.email ?? '',
        role === 'admin' ? 'TMC Administrator' : 'TMC Operator',
        status,
        organization,
        registered,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saferide_users_filtered_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'Filtered admin/operator records were exported successfully.',
    });
  };

  const handleSave = async (section: string) => {
    setSavingSection(section);
    try {
      if (section === 'Profile') {
        const name = (document.getElementById('name') as HTMLInputElement)?.value;
        const email = (document.getElementById('email') as HTMLInputElement)?.value;
        const [first_name, ...rest] = (name ?? '').split(' ');
        const last_name = rest.join(' ');

        const resp = await fetch(`${API_BASE}/users/me/`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ first_name, last_name, email }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        await refreshCurrentUser();
      }

      if (section === 'Password') {
        const currentPw = (document.getElementById('current-password') as HTMLInputElement)?.value;
        const newPw = (document.getElementById('new-password') as HTMLInputElement)?.value;
        const confirmPw = (document.getElementById('confirm-password') as HTMLInputElement)?.value;

        if (!currentPw || !newPw || !confirmPw) {
          toast({ title: "Validation Error", description: "All password fields are required.", variant: "destructive" });
          return;
        }
        if (newPw !== confirmPw) {
          toast({ title: "Validation Error", description: "New passwords do not match.", variant: "destructive" });
          return;
        }

        const resp = await fetch(`${API_BASE}/users/change-password/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
        });
        if (!resp.ok) throw new Error(await resp.text());
      }

      if (section === 'Detection') {
        const resp = await fetch(`${API_BASE}/settings/`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(detectionSettings),
        });
        if (!resp.ok) throw new Error(await resp.text());
      }

      if (section === 'Notifications') {
        localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
      }

      if (section === 'Preferences') {
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
      }

      toast({
        title: "Settings Updated",
        description: `${section} settings have been saved successfully.`,
      });
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message ?? "Could not save settings. Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSection(null);
    }
  };

  const handleCreateOperator = async () => {
    if (!newOperator.email || !newOperator.password) {
      toast({
        title: "Validation Error",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return;
    }

    setCreatingOperator(true);
    try {
      const resp = await fetch(`${API_BASE}/users/create-operator/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newOperator),
      });

      const ctype = resp.headers.get('content-type') || '';
      let json: any = null;

      if (ctype.includes('application/json')) {
        json = await resp.json();
      } else {
        // Non-JSON (likely HTML error page) — include text in error for debugging
        const text = await resp.text();
        throw new Error(`Unexpected non-JSON response from server: ${text.slice(0, 1000)}`);
      }

      if (!resp.ok) {
        throw new Error(json?.error || json?.detail || "Failed to create operator.");
      }

      toast({
        title: newOperator.role === 'admin' ? 'TMC Administrator Created' : 'Operator Created',
        description: json.detail ?? `User ${newOperator.name || newOperator.email} has been added.`,
      });
      setNewOperator({ name: '', email: '', password: '', role: 'tmc_operator' });
      setShowAddOperator(false);
      if (showManageUsers) {
        loadUsers();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message ?? "Could not create operator.",
        variant: 'destructive',
      });
    } finally {
      setCreatingOperator(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="app-page-heading">Settings</h2>
          <p className="app-body-text text-muted-foreground">
            {isAdmin ? 'Manage system configuration and preferences' : 'Manage your personal preferences'}
          </p>
        </div>
        <Badge variant={isAdmin ? "default" : "secondary"} className="h-7 self-start whitespace-nowrap">
          {isAdmin ? (isMobile ? 'Admin Access' : 'TMC Administrator Access') : 'Operator Access'}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v); setSearchParams({ tab: v }); }} className="space-y-4 sm:space-y-6">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 rounded-xl p-1 sm:w-full sm:flex-wrap">
            <TabsTrigger value="profile" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
              <Bell className="w-4 h-4" />
              {isMobile ? 'Alerts' : 'Notifications'}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
              <Palette className="w-4 h-4" />
              {isMobile ? 'Preferences' : 'UI & Preferences'}
            </TabsTrigger>
            <TabsTrigger value="detection" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
              <Monitor className="w-4 h-4" />
              Detection
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="activity" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
                <History className="w-4 h-4" />
                {isMobile ? 'Activity' : 'Activity Log'}
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="users" className="h-auto min-w-[132px] shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-left sm:min-w-0 sm:flex-1 sm:justify-center">
                <Users className="w-4 h-4" />
                Users
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Profile Settings - Available to All */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue={currentUser?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={currentUser?.email || ''} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="role-display">Role</Label>
                  <Input id="role-display" value={isAdmin ? 'TMC Administrator' : 'TMC Operator'} disabled />
                </div>
              </div>
              <Button onClick={() => handleSave('Profile')} disabled={savingSection === 'Profile'}>
                {savingSection === 'Profile' ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings - Available to All with different permissions */}
        <TabsContent value="security" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Authentication & Security</CardTitle>
              <CardDescription>Manage your password and authentication settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type={showCurrentPassword ? 'text' : 'password'} />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((s) => !s)}
                    className="absolute right-3 top-9 text-muted-foreground"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type={showNewPassword ? 'text' : 'password'} />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((s) => !s)}
                    className="absolute right-3 top-9 text-muted-foreground"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute right-3 top-9 text-muted-foreground"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button onClick={() => handleSave('Password')} disabled={savingSection === 'Password'}>
                  {savingSection === 'Password' ? 'Saving...' : 'Update Password'}
                </Button>
              </div>

              {isAdmin && (
                <>
                  <Separator />
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Admin Only:</strong> Configure global password policies in the System tab.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications - Different for Admin vs Operator */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure the in-app alerts used in the bell, popups, and activity flow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="live-violation-popups">Live Violation Popups</Label>
                    <p className="app-hint-text">Show a popup when a new violation is recorded</p>
                  </div>
                  <Switch
                    id="live-violation-popups"
                    checked={notificationSettings.live_violation_popups}
                    onCheckedChange={(val: boolean) => setNotificationSettings((p: typeof notificationSettings) => ({ ...p, live_violation_popups: val }))}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notification-sound">Notification Sound</Label>
                    <p className="app-hint-text">Play a short alert tone together with the live popup</p>
                  </div>
                  <Switch
                    id="notification-sound"
                    checked={notificationSettings.notification_sound}
                    onCheckedChange={(val: boolean) => setNotificationSettings((p: typeof notificationSettings) => ({ ...p, notification_sound: val }))}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="auto-hide">Popup Auto-hide Duration</Label>
                  <Select
                    value={String(notificationSettings.auto_hide_ms)}
                    onValueChange={(value) =>
                      setNotificationSettings((p: typeof notificationSettings) => ({
                        ...p,
                        auto_hide_ms: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger id="auto-hide">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3000">3 seconds</SelectItem>
                      <SelectItem value="5000">5 seconds</SelectItem>
                      <SelectItem value="8000">8 seconds</SelectItem>
                      <SelectItem value="12000">12 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="app-hint-text">Controls how long the live violation popup stays visible</p>
                </div>

                <Separator />

                <Alert className="bg-muted/40">
                  <Bell className="h-4 w-4" />
                  <AlertDescription>
                    {isAdmin
                      ? 'Admin bell notifications and the Activity Log will continue recording operator review actions automatically.'
                      : 'Violation records will still appear in your notification list even if popup alerts are turned off.'}
                  </AlertDescription>
                </Alert>

              </div>

              <Button onClick={() => handleSave('Notifications')} disabled={savingSection === 'Notifications'}>
                {savingSection === 'Notifications' ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* UI & Preferences - Available to All */}
        <TabsContent value="preferences" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>UI & Workspace Preferences</CardTitle>
              <CardDescription>Customize your interface and workspace settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">

                <div className="space-y-2">
                  <Label htmlFor="items-per-page">Items Per Page</Label>
                  <p className="app-hint-text">
                    Number of records displayed per page in violation tables.
                  </p>
                  <select
                    id="items-per-page"
                    value={preferences.itemsPerPage}
                    onChange={(e) => setPreferences((s: any) => ({ ...s, itemsPerPage: Number(e.target.value) }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] text-foreground"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-filter">Default Violation Filter</Label>
                  <p className="app-hint-text">
                    Default filter applied when opening the Violations page.
                  </p>
                  <select
                    id="default-filter"
                    value={preferences.defaultFilter}
                    onChange={(e) => setPreferences((s: any) => ({ ...s, defaultFilter: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] text-foreground"
                  >
                    <option value="all">All Violations</option>
                    <option value="pending">Pending Only</option>
                    <option value="reviewed">Reviewed Only</option>
                    <option value="resolved">Resolved Only</option>
                  </select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Confidence Scores</Label>
                    <p className="app-hint-text">
                      Display AI confidence percentage in violation tables.
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showConfidence}
                    onCheckedChange={(checked) => setPreferences((s: any) => ({ ...s, showConfidence: checked }))}
                  />
                </div>

                <Button
                  onClick={() => handleSave('Preferences')}
                  disabled={savingSection === 'Preferences'}
                >
                  {savingSection === 'Preferences' ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detection Settings - Read-only for TMC Operators */}
        <TabsContent value="detection" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle>AI Detection Configuration</CardTitle>
                  <CardDescription>{isAdmin ? 'Configure detection parameters' : 'View current detection configuration (read-only)'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isAdmin && (
                <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[13px] text-foreground">
                  <Eye className="w-4 h-4 shrink-0 text-primary" />
                  <span>Read-only view. Contact an administrator to modify detection settings.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confidence-threshold">
                    Confidence Threshold - <span className="text-foreground font-medium">
                      {isNaN(detectionSettings.confidence_threshold)
                        ? '60'
                        : (detectionSettings.confidence_threshold * 100).toFixed(0)}%
                    </span>
                  </Label>
                <p className="app-hint-text">
                    YOLO inference floor - applies to all classes before per-class thresholds. Keep this {"<="} your lowest per-class value below.
                  </p>
                  <input
                    id="confidence-threshold"
                    type="range"
                    min="0.30"
                    max="0.95"
                    step="0.05"
                    value={isNaN(detectionSettings.confidence_threshold) ? 0.60 : detectionSettings.confidence_threshold}
                    onChange={(e) =>
                      setDetectionSettings(s => ({ ...s, confidence_threshold: parseFloat(e.target.value) }))
                    }
                    disabled={!isAdmin}
                    className="w-full accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="app-hint-text flex justify-between">
                    <span>30% (Sensitive)</span>
                    <span>95% (Strict)</span>
                  </div>
                  {/* Warning: global threshold overrides per-class values */}
                  {(() => {
                    const global = detectionSettings.confidence_threshold;
                    const blocked = [
                      detectionSettings.conf_no_helmet < global && 'No Helmet',
                      detectionSettings.conf_nutshell  < global && 'Nutshell',
                      detectionSettings.conf_helmet    < global && 'Helmet',
                      detectionSettings.conf_license_plate < global && 'License Plate',
                    ].filter(Boolean);
                    return blocked.length > 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-foreground">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                        <span>
                          <strong>Warning:</strong> Global threshold ({(global * 100).toFixed(0)}%) is higher than the per-class threshold for <strong>{blocked.join(', ')}</strong>. These classes will never be detected. Lower the global threshold or raise the per-class values.
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>

                <Separator />

                {/* Per-class confidence thresholds */}
                <div className="space-y-4">
                  <div>
                    <Label className="app-label-text font-medium">Per-Class Confidence Thresholds</Label>
                    <p className="app-hint-text mt-1">
                      Fine-tune sensitivity per detection class. Must be {">="} the global threshold above to have effect.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conf-no-helmet">
                      No Helmet - <span className="text-foreground font-medium">
                        {(detectionSettings.conf_no_helmet * 100).toFixed(0)}%
                      </span>
                    </Label>
                    <p className="app-hint-text">Lower = catches more violators. Raise if getting false positives.</p>
                    <input
                      id="conf-no-helmet"
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={detectionSettings.conf_no_helmet}
                      onChange={(e) =>
                        setDetectionSettings(s => ({ ...s, conf_no_helmet: parseFloat(e.target.value) }))
                      }
                      disabled={!isAdmin}
                      className="w-full accent-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="app-hint-text flex justify-between">
                      <span>30% (Lenient)</span>
                      <span>95% (Strict)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conf-nutshell">
                      Nutshell (Half-Helmet) - <span className="text-foreground font-medium">
                        {(detectionSettings.conf_nutshell * 100).toFixed(0)}%
                      </span>
                    </Label>
                    <p className="app-hint-text">Keep higher to avoid misidentifying full helmets as nutshells.</p>
                    <input
                      id="conf-nutshell"
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={detectionSettings.conf_nutshell}
                      onChange={(e) =>
                        setDetectionSettings(s => ({ ...s, conf_nutshell: parseFloat(e.target.value) }))
                      }
                      disabled={!isAdmin}
                      className="w-full accent-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="app-hint-text flex justify-between">
                      <span>30% (Lenient)</span>
                      <span>95% (Strict)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conf-helmet">
                      Helmet (Compliant) - <span className="text-foreground font-medium">
                        {(detectionSettings.conf_helmet * 100).toFixed(0)}%
                      </span>
                    </Label>
                    <p className="app-hint-text">Minimum confidence to mark a rider as compliant.</p>
                    <input
                      id="conf-helmet"
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={detectionSettings.conf_helmet}
                      onChange={(e) =>
                        setDetectionSettings(s => ({ ...s, conf_helmet: parseFloat(e.target.value) }))
                      }
                      disabled={!isAdmin}
                      className="w-full accent-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="app-hint-text flex justify-between">
                      <span>30% (Lenient)</span>
                      <span>95% (Strict)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conf-license-plate">
                      License Plate Detection - <span className="text-foreground font-medium">
                        {(detectionSettings.conf_license_plate * 100).toFixed(0)}%
                      </span>
                    </Label>
                    <p className="app-hint-text">Minimum YOLO confidence to attempt reading a plate. Lower if plates are being missed.</p>
                    <input
                      id="conf-license-plate"
                      type="range"
                      min="0.30"
                      max="0.95"
                      step="0.05"
                      value={detectionSettings.conf_license_plate}
                      onChange={(e) =>
                        setDetectionSettings(s => ({ ...s, conf_license_plate: parseFloat(e.target.value) }))
                      }
                      disabled={!isAdmin}
                      className="w-full accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="app-hint-text flex justify-between">
                      <span>30% (Lenient)</span>
                      <span>95% (Strict)</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="send-cooldown">
                    Alert Cooldown - <span className="text-foreground font-medium">
                      {isNaN(detectionSettings.send_cooldown_seconds)
                        ? '3.0'
                        : detectionSettings.send_cooldown_seconds}s
                    </span>
                  </Label>
                  <p className="app-hint-text">
                    Minimum seconds between violation alerts sent to the server. Prevents duplicate detections.
                  </p>
                  <input
                    id="send-cooldown"
                    type="range"
                    min="1"
                    max="30"
                    step="0.5"
                    value={isNaN(detectionSettings.send_cooldown_seconds) ? 3.0 : detectionSettings.send_cooldown_seconds}
                    onChange={(e) =>
                      setDetectionSettings(s => ({ ...s, send_cooldown_seconds: parseFloat(e.target.value) }))
                    }
                    disabled={!isAdmin}
                    className="w-full accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="app-hint-text flex justify-between">
                    <span>1s (Fast)</span>
                    <span>30s (Slow)</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="ocr-confidence">
                    OCR Confidence - <span className="text-foreground font-medium">
                      {isNaN(detectionSettings.ocr_confidence)
                        ? '20'
                        : (detectionSettings.ocr_confidence * 100).toFixed(0)}%
                    </span>
                  </Label>
                  <p className="app-hint-text">
                    Minimum confidence EasyOCR must have to accept a plate reading. Lower = more plate reads, more errors.
                  </p>
                  <input
                    id="ocr-confidence"
                    type="range"
                    min="0.10"
                    max="0.90"
                    step="0.05"
                    value={isNaN(detectionSettings.ocr_confidence) ? 0.20 : detectionSettings.ocr_confidence}
                    onChange={(e) =>
                      setDetectionSettings(s => ({ ...s, ocr_confidence: parseFloat(e.target.value) }))
                    }
                    disabled={!isAdmin}
                    className="w-full accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="app-hint-text flex justify-between">
                    <span>10% (Permissive)</span>
                    <span>90% (Strict)</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="data-retention">Data Retention (days)</Label>
                  <p className="app-hint-text">
                    How many days to keep violation records in the database before auto-deletion.
                  </p>
                  <Input
                    id="data-retention"
                    type="number"
                    min="7"
                    max="365"
                    value={isNaN(detectionSettings.data_retention_days) ? 90 : detectionSettings.data_retention_days}
                    onChange={(e) =>
                      setDetectionSettings(s => ({ ...s, data_retention_days: Number(e.target.value) }))
                    }
                    disabled={!isAdmin}
                  />
                </div>

                <Separator />

              {isAdmin && (
                <Button
                  onClick={() => handleSave('Detection')}
                  disabled={savingSection === 'Detection'}
                >
                  {savingSection === 'Detection' ? 'Saving...' : 'Save Detection Settings'}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="activity" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle>Activity Log</CardTitle>
                      <CardDescription>
                        Review plate searches, evidence views, exports, and violation review actions performed in the system.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="h-6 px-2">
                      {activityLog.length} Entries
                    </Badge>
                    <Badge
                      variant={activityNotifications.unreadCount > 0 ? 'destructive' : 'secondary'}
                      className="h-6 px-2"
                    >
                      {activityNotifications.unreadCount} Unread
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={activityNotifications.markAllAsRead}
                      disabled={activityNotifications.loading || activityNotifications.unreadCount === 0}
                    >
                      Mark All Read
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activityNotifications.loading && activityLog.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : activityLog.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                    <History className="h-8 w-8 text-muted-foreground/50" />
                    <p className="app-body-text">No activity has been recorded yet.</p>
                    <p className="app-hint-text">
                      Searches, evidence views, exports, and review actions will appear here for admin tracking.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full">
                      <thead className="bg-muted/40">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground">User</th>
                          <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground">Action</th>
                          <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground">Violation</th>
                          <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground">Date & Time</th>
                          <th className="px-4 py-3 text-left text-[13px] font-medium text-muted-foreground">Controls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityLog.map((notification) => (
                          <tr key={notification.id} className="border-b border-border/60 align-top last:border-0">
                            <td className="px-4 py-3">
                              <p className="app-body-text font-medium text-foreground">
                                {notification.actor_name || 'Unknown user'}
                              </p>
                              <p className="app-hint-text">
                                {notification.actor_role || 'System User'}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[13px] font-medium text-foreground">
                                {notification.title}
                              </p>
                              <p className="app-hint-text max-w-md">
                                {notification.message}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="app-body-text font-medium text-foreground">
                                {notification.violation_id ? `#${notification.violation_id}` : 'N/A'}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={notification.is_read ? 'secondary' : 'destructive'}>
                                {notification.is_read ? 'Read' : 'Unread'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <p className="app-body-text text-foreground">
                                {formatActivityTime(notification.created_at)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={notification.is_read}
                                onClick={() => activityNotifications.markAsRead(notification.id)}
                              >
                                {notification.is_read ? 'Read' : 'Mark Read'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Users Management - Admin Only */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage operator accounts and permissions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowAddOperator(true)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Add Operator
                </Button>
                {/* ── Manage Users toggle button ── */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={toggleManageUsers}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Operators
                  {showManageUsers
                    ? <ChevronUp className="w-4 h-4 ml-auto" />
                    : <ChevronDown className="w-4 h-4 ml-auto" />}
                </Button>

                {/* ── Inline users table ── */}
                {showManageUsers && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">All Users</p>
                        <p className="app-hint-text mt-1">
                          Filter admin and operator accounts before exporting.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-full space-y-1 sm:w-[180px]">
                          <Label className="text-[12px] text-muted-foreground">Role</Label>
                          <Select value={userRoleFilter} onValueChange={(value) => setUserRoleFilter(value as 'all' | 'admin' | 'tmc_operator')}>
                            <SelectTrigger className="h-9 bg-card">
                              <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Roles</SelectItem>
                              <SelectItem value="admin">TMC Administrator</SelectItem>
                              <SelectItem value="tmc_operator">TMC Operator</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full space-y-1 sm:w-[180px]">
                          <Label className="text-[12px] text-muted-foreground">Registered</Label>
                          <Select value={userDateFilter} onValueChange={(value) => setUserDateFilter(value as 'all' | 'today' | 'week' | 'month')}>
                            <SelectTrigger className="h-9 bg-card">
                              <SelectValue placeholder="All Time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Time</SelectItem>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="week">Past Week</SelectItem>
                              <SelectItem value="month">Past Month</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportFilteredUsers}
                          className="h-9 px-3"
                        >
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadUsers}
                          disabled={loadingUsers}
                          className="h-9 px-3"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${loadingUsers ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {loadingUsers && usersList.length === 0 ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : usersList.length === 0 ? (
                      <p className="app-hint-text py-4 text-center">No users found.</p>
                    ) : filteredUsersList.length === 0 ? (
                      <p className="app-hint-text py-4 text-center">No users match the current filters.</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="app-hint-text">
                          Showing {filteredUsersList.length} of {usersList.length} user account(s).
                        </p>
                        <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 pr-3 text-left text-[13px] font-medium text-muted-foreground">Name</th>
                              <th className="py-2 pr-3 text-left text-[13px] font-medium text-muted-foreground">Email</th>
                              <th className="py-2 pr-3 text-left text-[13px] font-medium text-muted-foreground">Role</th>
                              <th className="py-2 pr-3 text-left text-[13px] font-medium text-muted-foreground">Status</th>
                              <th className="py-2 text-left text-[13px] font-medium text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUsersList.map((u) => {
                              const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
                              const role = u.profile?.role ?? u.role ?? 'tmc_operator';
                              const accStatus = u.profile?.status ?? u.status ?? 'approved';
                              const isCurrentUser = currentUser?.id === u.id;
                              const isAdminUser = role === 'admin';
                              const isOperatorUser = role === 'tmc_operator';
                              const isPermissionRowOpen = expandedPermissionUserId === u.id;
                              const operatorPermissions = getPermissionsForUser(u);
                              return (
                                <Fragment key={u.id}>
                                  <tr className="border-b border-border/50 align-top">
                                    <td className="py-2 pr-3">
                                      <p className="font-medium">{fullName}</p>
                                      <p className="app-hint-text">@{u.username}</p>
                                    </td>
                                    <td className="py-2 pr-3 text-foreground">{u.email || 'N/A'}</td>
                                    <td className="py-2 pr-3">
                                      <Badge variant={isAdminUser ? 'default' : 'secondary'}>
                                        {isAdminUser ? 'Admin' : 'TMC Operator'}
                                      </Badge>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <Badge
                                        variant={
                                          accStatus === 'approved' ? 'default'
                                            : accStatus === 'pending' ? 'secondary'
                                              : 'destructive'
                                        }
                                      >
                                        {accStatus.charAt(0).toUpperCase() + accStatus.slice(1)}
                                      </Badge>
                                    </td>
                                    <td className="py-2">
                                      {isCurrentUser || isAdminUser ? (
                                        <span className="app-hint-text italic">
                                          {isCurrentUser ? 'You' : 'Protected'}
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          {isOperatorUser && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 px-2 text-[12px]"
                                              onClick={() =>
                                                setExpandedPermissionUserId((prev) =>
                                                  prev === u.id ? null : u.id
                                                )
                                              }
                                            >
                                              Permissions
                                              {isPermissionRowOpen ? (
                                                <ChevronUp className="ml-1 h-3.5 w-3.5" />
                                              ) : (
                                                <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                              )}
                                            </Button>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            disabled={deletingUserId === u.id}
                                            onClick={() => handleDeleteUser(u.id, fullName)}
                                            title={`Delete ${fullName}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                  {isOperatorUser && isPermissionRowOpen && (
                                    <tr className="border-b border-border/50 bg-card/70">
                                      <td colSpan={5} className="px-4 py-4">
                                        <div className="space-y-4 rounded-lg border border-border bg-background px-4 py-4">
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <p className="text-[12px] font-medium text-[#6B7280]">
                                                Operator permissions
                                              </p>
                                              <p className="app-hint-text mt-1">
                                                Toggle exactly what this operator can access.
                                              </p>
                                            </div>
                                          </div>
                                          <div className="grid gap-3 md:grid-cols-2">
                                            {PERMISSION_TOGGLE_ITEMS.map((permission) => {
                                              const requestKey = `${u.id}:${permission.key}`;
                                              const isUpdating = Boolean(updatingPermissionStates[requestKey]);
                                              return (
                                                <div
                                                  key={permission.key}
                                                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-3"
                                                >
                                                  <p className="text-[13px] font-normal text-[#1A1A2E]">
                                                    {permission.label}
                                                  </p>
                                                  <Switch
                                                    checked={operatorPermissions[permission.key]}
                                                    disabled={isUpdating}
                                                    onCheckedChange={(checked) =>
                                                      handlePermissionToggle(u.id, permission.key, checked)
                                                    }
                                                    className="data-[state=checked]:!bg-[#1D9E75] data-[state=unchecked]:!bg-[#E4E6ED]"
                                                    aria-label={permission.label}
                                                  />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      </div>
                    )}
                  </div>
                )}
                {/* ── Pending Registrations toggle button ── */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={togglePending}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Pending Registrations
                  {pendingList.length > 0 && !showPending && (
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                      {pendingList.length}
                    </Badge>
                  )}
                  {showPending
                    ? <ChevronUp className="w-4 h-4 ml-auto" />
                    : <ChevronDown className="w-4 h-4 ml-auto" />}
                </Button>

                {/* ── Inline pending registrations panel ── */}
                {showPending && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/40">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium text-foreground">
                        Pending Registrations
                        {pendingList.length > 0 && (
                          <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                            {pendingList.length}
                          </Badge>
                        )}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadPending}
                        disabled={loadingPending}
                        className="h-7 px-2"
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${loadingPending ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>

                    {loadingPending ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : pendingList.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                        <Shield className="w-8 h-8 opacity-30" />
                        <p className="app-body-text">No pending registrations. You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pendingList.map((u) => {
                          const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
                          const org = u.profile?.organization;
                          const joinedDate = u.profile?.created_at
                            ? new Date(u.profile.created_at).toLocaleDateString()
                            : null;
                          const isProcessing = processingId === u.id;
                          return (
                            <div
                              key={u.id}
                              className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{fullName}</p>
                                <p className="app-hint-text truncate">{u.email}</p>
                                {org && (
                                  <p className="app-hint-text mt-0.5">Organization: {org}</p>
                                )}
                                {joinedDate && (
                                  <p className="app-hint-text mt-0.5">Registered: {joinedDate}</p>
                                )}
                              </div>
                              <div className="flex gap-2 shrink-0 pt-0.5">
                                <Button
                                  size="sm"
                                  className="h-7 border border-green-200 bg-green-50 px-3 text-[13px] text-foreground hover:bg-green-100"
                                  disabled={isProcessing}
                                  onClick={() => handleApproveOrReject(u.id, 'approve', fullName)}
                                >
                                  {isProcessing ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-3"
                                  disabled={isProcessing}
                                  onClick={() => handleApproveOrReject(u.id, 'reject', fullName)}
                                >
                                  {isProcessing ? '...' : 'Reject'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {showAddOperator && (
                  <div className="mt-4 border rounded-lg p-4 space-y-3 bg-muted/40">
                    <p className="text-[13px] font-medium text-foreground">Add New User</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="op-name">Full Name</Label>
                        <Input
                          id="op-name"
                          value={newOperator.name}
                          onChange={(e) =>
                            setNewOperator((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="Juan Dela Cruz"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="op-email">Email</Label>
                        <Input
                          id="op-email"
                          type="email"
                          value={newOperator.email}
                          onChange={(e) =>
                            setNewOperator((prev) => ({ ...prev, email: e.target.value }))
                          }
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="op-password">Temporary Password</Label>
                        <div className="relative">
                          <Input
                            id="op-password"
                            type={showOpPassword ? 'text' : 'password'}
                            value={newOperator.password}
                            onChange={(e) =>
                              setNewOperator((prev) => ({ ...prev, password: e.target.value }))
                            }
                            placeholder="Generate or set a temporary password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOpPassword((s) => !s)}
                            className="absolute right-3 top-2 text-muted-foreground"
                            aria-label={showOpPassword ? 'Hide password' : 'Show password'}
                          >
                            {showOpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Role</Label>
                        <Select 
                          value={newOperator.role} 
                          onValueChange={(val) => setNewOperator((prev) => ({ ...prev, role: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tmc_operator">TMC Operator</SelectItem>
                            <SelectItem value="admin">TMC Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddOperator(false);
                          setNewOperator({ name: '', email: '', password: '', role: 'tmc_operator' });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleCreateOperator} disabled={creatingOperator}>
                        {creatingOperator ? 'Creating...' : 'Save User'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {!isAdmin && (
        <Alert className="bg-muted">
          <Eye className="h-4 w-4" />
          <AlertDescription>
            <strong>Operator Access:</strong> You can update your profile, change your password, and configure your personal preferences. Contact an administrator to request changes to system-wide settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Settings;
