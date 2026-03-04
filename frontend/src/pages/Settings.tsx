import { useState, useEffect } from 'react';
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
import { Bell, Shield, Database, Monitor, User, Palette, Eye, EyeOff, Lock, Camera, Users, AlertCircle, Trash2, RefreshCw, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { API_BASE } from '@/config';
import apiClient from '@/services/api';

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

  // Persist selected tab in the URL query param `tab` so refresh keeps the same tab
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    const qp = searchParams.get('tab') || 'profile';
    if (qp !== activeTab) setActiveTab(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [newOperator, setNewOperator] = useState({ name: '', email: '', password: '', role: 'tmc_operator' });
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [creatingOperator, setCreatingOperator] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOpPassword, setShowOpPassword] = useState(false);

  // System Settings state
  const [systemSettings, setSystemSettings] = useState({
    auto_logout: true,
    session_timeout: 30,
    password_min_length: 8,
  });

  // Detection Settings state
  const [detectionSettings, setDetectionSettings] = useState({
    confidence_threshold: 0.60,
    send_cooldown_seconds: 3.0,
    data_retention_days: 90,
    ocr_confidence: 0.20,
  });

  // Notification Settings state (persisted to localStorage)
  const [notificationSettings, setNotificationSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('notificationSettings');
      return saved ? JSON.parse(saved) : {
        email_notifications: true,
        alert_email: 'admin@saferide.ai',
        critical_alert_escalation: true,
      };
    } catch {
      return { email_notifications: true, alert_email: 'admin@saferide.ai', critical_alert_escalation: true };
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

  // Pending Registrations state
  const [showPending, setShowPending] = useState(false);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const userData = JSON.parse(user);
      setCurrentUser(userData);
      setIsAdmin(userData.role === 'admin');
      if (userData.role === 'admin') loadSystemSettings();
    }
  }, []);

  // ← ADD THIS: reload settings whenever detection or system tab is opened
  useEffect(() => {
    if ((activeTab === 'detection' || activeTab === 'system') && isAdmin) {
      loadSystemSettings();
    }
  }, [activeTab, isAdmin]);

  const loadSystemSettings = async () => {
    try {
      const resp = await fetch(`${API_BASE}/settings/`, { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      setSystemSettings({
        auto_logout:         data.auto_logout         ?? true,
        session_timeout:     data.session_timeout     ?? 30,
        password_min_length: data.password_min_length ?? 8,
      });
      setDetectionSettings({
        confidence_threshold:  data.confidence_threshold  != null ? parseFloat(data.confidence_threshold)  : 0.60,
        send_cooldown_seconds: data.send_cooldown_seconds != null ? parseFloat(data.send_cooldown_seconds) : 3.0,
        data_retention_days:   data.data_retention_days  != null ? parseInt(data.data_retention_days)     : 90,
        ocr_confidence:        data.ocr_confidence        != null ? parseFloat(data.ocr_confidence)        : 0.20,
      });
    } catch {}
  };

  // ── Manage Users helpers ──────────────────────────────────────────────────────
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const resp = await fetch(`${API_BASE}/users/`, { headers: getAuthHeaders() });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      // DRF may return paginated {results:[]} or a plain array
      setUsersList(Array.isArray(data) ? data : (data.results ?? []));
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
      setPendingList((prev) => prev.filter((u) => u.id !== userId));
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

      if (section === 'Security Policies') {
        const resp = await fetch(`${API_BASE}/settings/`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(systemSettings),
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
        title: newOperator.role === 'admin' ? 'Administrator Created' : 'Operator Created',
        description: json.detail ?? `User ${newOperator.name || newOperator.email} has been added.`,
      });
      setNewOperator({ name: '', email: '', password: '', role: 'tmc_operator' });
      setShowAddOperator(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage system configuration and preferences' : 'Manage your personal preferences'}
          </p>
        </div>
        <Badge variant={isAdmin ? "default" : "secondary"} className="h-7">
          {isAdmin ? 'Admin Access' : 'Operator Access'}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v); setSearchParams({ tab: v }); }} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-7">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="w-4 h-4" />
            UI & Preferences
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="detection" className="gap-2">
                <Monitor className="w-4 h-4" />
                Detection
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-2">
                <Database className="w-4 h-4" />
                System
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Users
              </TabsTrigger>
              {/* Reports tab removed from Settings; use dedicated Reports page instead */}
            </>
          )}
        </TabsList>

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
                  <Input id="role-display" value={isAdmin ? 'Administrator' : 'TMC Operator'} disabled />
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
                      <strong>Admin Only:</strong> Configure global password policies and session timeouts in the System tab.
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
              <CardTitle>Global Notification Settings</CardTitle>
              <CardDescription>Configure system-wide alert destinations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notif">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Enable email alerts for violations</p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={notificationSettings.email_notifications}
                    onCheckedChange={(val: boolean) => setNotificationSettings((p: typeof notificationSettings) => ({ ...p, email_notifications: val }))}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="admin-email">System Alert Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@saferide.ai"
                    value={notificationSettings.alert_email}
                    onChange={(e) => setNotificationSettings((p: typeof notificationSettings) => ({ ...p, alert_email: e.target.value }))}
                  />
                  <p className="text-sm text-muted-foreground">Email address that receives system alerts</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="escalation">Critical Alert Escalation</Label>
                    <p className="text-sm text-muted-foreground">Send critical alerts to all admins</p>
                  </div>
                  <Switch
                    id="escalation"
                    checked={notificationSettings.critical_alert_escalation}
                    onCheckedChange={(val: boolean) => setNotificationSettings((p: typeof notificationSettings) => ({ ...p, critical_alert_escalation: val }))}
                  />
                </div>

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
                  <p className="text-sm text-muted-foreground">
                    Number of records displayed per page in violation tables.
                  </p>
                  <select
                    id="items-per-page"
                    value={preferences.itemsPerPage}
                    onChange={(e) => setPreferences((s: any) => ({ ...s, itemsPerPage: Number(e.target.value) }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-filter">Default Violation Filter</Label>
                  <p className="text-sm text-muted-foreground">
                    Default filter applied when opening the Violations page.
                  </p>
                  <select
                    id="default-filter"
                    value={preferences.defaultFilter}
                    onChange={(e) => setPreferences((s: any) => ({ ...s, defaultFilter: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                    <p className="text-sm text-muted-foreground">
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

        {/* Detection Settings - Admin Only */}
        {isAdmin && (
          <TabsContent value="detection" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>AI Detection Configuration</CardTitle>
                    <CardDescription>Configure detection parameters and camera management</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                <div className="space-y-2">
                  <Label htmlFor="confidence-threshold">
                    Confidence Threshold — <span className="text-primary font-semibold">
                      {isNaN(detectionSettings.confidence_threshold)
                        ? '60'
                        : (detectionSettings.confidence_threshold * 100).toFixed(0)}%
                    </span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Minimum confidence YOLO must have before flagging a violation. Lower = more detections, more false positives.
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
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>30% (Sensitive)</span>
                    <span>95% (Strict)</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="send-cooldown">
                    Alert Cooldown — <span className="text-primary font-semibold">
                      {isNaN(detectionSettings.send_cooldown_seconds)
                        ? '3.0'
                        : detectionSettings.send_cooldown_seconds}s
                    </span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
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
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1s (Fast)</span>
                    <span>30s (Slow)</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="ocr-confidence">
                    OCR Confidence — <span className="text-primary font-semibold">
                      {isNaN(detectionSettings.ocr_confidence)
                        ? '20'
                        : (detectionSettings.ocr_confidence * 100).toFixed(0)}%
                    </span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
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
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10% (Permissive)</span>
                    <span>90% (Strict)</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="data-retention">Data Retention (days)</Label>
                  <p className="text-sm text-muted-foreground">
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
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Camera Management
                  </Label>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Camera className="w-4 h-4 mr-2" />
                      Add New Camera
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/cameras')}>
                      <Eye className="w-4 h-4 mr-2" />
                      View All Cameras
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => handleSave('Detection')}
                  disabled={savingSection === 'Detection'}
                >
                  {savingSection === 'Detection' ? 'Saving...' : 'Save Detection Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* System Settings - Admin Only */}
        {isAdmin && (
          <TabsContent value="system" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>Database & Storage</CardTitle>
                    <CardDescription>System data export and configuration</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Export all violation records from the database.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const res = await apiClient.get('/violations/export/?export_format=csv', { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `saferide_violations_${new Date().toISOString().slice(0,10)}.csv`;
                        document.body.appendChild(a); a.click(); a.remove();
                        window.URL.revokeObjectURL(url);
                        toast({ title: 'Export Complete', description: 'CSV downloaded successfully.' });
                      } catch {
                        toast({ title: 'Export Failed', description: 'Could not export CSV.', variant: 'destructive' });
                      }
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" /> Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const res = await apiClient.get('/violations/export/?export_format=pdf', { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `saferide_violations_${new Date().toISOString().slice(0,10)}.pdf`;
                        document.body.appendChild(a); a.click(); a.remove();
                        window.URL.revokeObjectURL(url);
                        toast({ title: 'Export Complete', description: 'PDF downloaded successfully.' });
                      } catch {
                        toast({ title: 'Export Failed', description: 'Could not export PDF.', variant: 'destructive' });
                      }
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" /> Export PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-destructive" />
                  <div>
                    <CardTitle>Global Security Policies</CardTitle>
                    <CardDescription>System-wide security and session management</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-logout">Auto Logout</Label>
                    <p className="text-sm text-muted-foreground">Automatically log out inactive users</p>
                  </div>
                  <Switch
                    id="auto-logout"
                    checked={systemSettings.auto_logout}
                    onCheckedChange={(v) => setSystemSettings(s => ({ ...s, auto_logout: v }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    value={systemSettings.session_timeout}
                    min="5"
                    max="120"
                    onChange={(e) => setSystemSettings(s => ({ ...s, session_timeout: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password-policy">Password Minimum Length</Label>
                  <Input
                    id="password-policy"
                    type="number"
                    value={systemSettings.password_min_length}
                    min="6"
                    max="32"
                    onChange={(e) => setSystemSettings(s => ({ ...s, password_min_length: Number(e.target.value) }))}
                  />
                </div>

                <Button onClick={() => handleSave('Security Policies')} disabled={savingSection === 'Security Policies'}>
                  {savingSection === 'Security Policies' ? 'Saving...' : 'Save Changes'}
                </Button>
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
                  <Users className="w-5 h-5 text-accent" />
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
                  Manage Users
                  {showManageUsers
                    ? <ChevronUp className="w-4 h-4 ml-auto" />
                    : <ChevronDown className="w-4 h-4 ml-auto" />}
                </Button>

                {/* ── Inline users table ── */}
                {showManageUsers && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/40">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">All Users</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadUsers}
                        disabled={loadingUsers}
                        className="h-7 px-2 text-xs"
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${loadingUsers ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>

                    {loadingUsers && usersList.length === 0 ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : usersList.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Name</th>
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Email</th>
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Role</th>
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Status</th>
                              <th className="text-left py-2 font-medium text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usersList.map((u) => {
                              const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
                              const role = u.profile?.role ?? 'tmc_operator';
                              const accStatus = u.profile?.status ?? 'approved';
                              const isCurrentUser = currentUser?.id === u.id;
                              const isAdminUser = role === 'admin';
                              return (
                                <tr key={u.id} className="border-b border-border/50 last:border-0">
                                  <td className="py-2 pr-3">
                                    <p className="font-medium">{fullName}</p>
                                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                                  </td>
                                  <td className="py-2 pr-3 text-muted-foreground">{u.email || '—'}</td>
                                  <td className="py-2 pr-3">
                                    <Badge
                                      variant={isAdminUser ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
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
                                      className="text-xs"
                                    >
                                      {accStatus.charAt(0).toUpperCase() + accStatus.slice(1)}
                                    </Badge>
                                  </td>
                                  <td className="py-2">
                                    {isCurrentUser || isAdminUser ? (
                                      <span className="text-xs text-muted-foreground italic">
                                        {isCurrentUser ? 'You' : 'Protected'}
                                      </span>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        disabled={deletingUserId === u.id}
                                        onClick={() => handleDeleteUser(u.id, fullName)}
                                        title={`Delete ${fullName}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
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
                    <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
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
                      <p className="font-semibold text-sm">
                        Pending Registrations
                        {pendingList.length > 0 && (
                          <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                            {pendingList.length}
                          </Badge>
                        )}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadPending}
                        disabled={loadingPending}
                        className="h-7 px-2 text-xs"
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
                        <p className="text-sm">No pending registrations. You're all caught up!</p>
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
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                {org && (
                                  <p className="text-xs text-muted-foreground mt-0.5">🏢 {org}</p>
                                )}
                                {joinedDate && (
                                  <p className="text-xs text-muted-foreground mt-0.5">Registered: {joinedDate}</p>
                                )}
                              </div>
                              <div className="flex gap-2 shrink-0 pt-0.5">
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                                  disabled={isProcessing}
                                  onClick={() => handleApproveOrReject(u.id, 'approve', fullName)}
                                >
                                  {isProcessing ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-3 text-xs"
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
                    <p className="font-semibold text-sm">Add New User</p>
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
                            <SelectItem value="admin">Administrator</SelectItem>
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
