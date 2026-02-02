import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bell, Shield, Database, Monitor, User, Palette, Globe, Eye, Lock, Camera, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Settings = () => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // simple local state for "Add Operator" modal
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [newOperator, setNewOperator] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      const userData = JSON.parse(user);
      setCurrentUser(userData);
      setIsAdmin(userData.role === 'admin');
    }
  }, []);

  const handleSave = (section: string) => {
    toast({
      title: "Settings Updated",
      description: `${section} settings have been saved successfully.`,
    });
  };

  const handleCreateOperator = () => {
    // TODO: replace with API call to create operator account
    toast({
      title: 'Operator Created',
      description: `Operator ${newOperator.name || newOperator.email} has been added and is now pending activation.`,
    });
    setNewOperator({ name: '', email: '', password: '' });
    setShowAddOperator(false);
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

      <Tabs defaultValue="profile" className="space-y-6">
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
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-display">Role</Label>
                  <Input id="role-display" value={isAdmin ? 'Administrator' : 'TMC Operator'} disabled />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="bio">Bio / Notes</Label>
                <Input id="bio" placeholder="Optional personal notes" />
              </div>
              <Button onClick={() => handleSave('Profile')}>Save Profile</Button>
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
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <Button onClick={() => handleSave('Password')}>Update Password</Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="2fa-personal">Two-Factor Authentication (2FA)</Label>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin ? 'Enforce 2FA for all users' : 'Enable 2FA for your account'}
                    </p>
                  </div>
                  <Switch id="2fa-personal" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Active Sessions</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Current Session</p>
                      <p className="text-muted-foreground">Last login: {currentUser?.loginTime ? new Date(currentUser.loginTime).toLocaleString() : 'N/A'}</p>
                    </div>
                    <Button variant="outline" size="sm">Revoke</Button>
                  </div>
                </div>
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
              <CardTitle>
                {isAdmin ? 'Global Notification Settings' : 'Personal Notification Preferences'}
              </CardTitle>
              <CardDescription>
                {isAdmin 
                  ? 'Configure system-wide notification rules and templates'
                  : 'Choose how you want to receive notifications'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notif">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                  </div>
                  <Switch id="email-notif" defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notif">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Browser push notifications</p>
                  </div>
                  <Switch id="push-notif" defaultChecked />
                </div>

                {!isAdmin && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sms-notif">SMS Alerts</Label>
                      <p className="text-sm text-muted-foreground">Text message notifications</p>
                    </div>
                    <Switch id="sms-notif" />
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="notif-frequency">Notification Frequency</Label>
                  <Select defaultValue="realtime">
                    <SelectTrigger id="notif-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time (Instant)</SelectItem>
                      <SelectItem value="digest-hourly">Hourly Digest</SelectItem>
                      <SelectItem value="digest-daily">Daily Digest</SelectItem>
                      <SelectItem value="mute">Muted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="notif-types">Notification Types</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="notif-new-violations" defaultChecked />
                        <Label htmlFor="notif-new-violations" className="font-normal">New violations detected</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="notif-status-changes" defaultChecked />
                        <Label htmlFor="notif-status-changes" className="font-normal">Violation status changes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="notif-system-alerts" />
                        <Label htmlFor="notif-system-alerts" className="font-normal">System alerts</Label>
                      </div>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">System Alert Email</Label>
                      <Input id="admin-email" type="email" placeholder="admin@saferide.ai" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="escalation">Critical Alert Escalation</Label>
                        <p className="text-sm text-muted-foreground">Send critical alerts to all admins</p>
                      </div>
                      <Switch id="escalation" defaultChecked />
                    </div>
                  </>
                )}
              </div>

              <Button onClick={() => handleSave('Notifications')}>Save Preferences</Button>

              {!isAdmin && (
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Read-only:</strong> Global notification templates and escalation rules are managed by administrators.
                  </AlertDescription>
                </Alert>
              )}
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
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select defaultValue="dark">
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">System Default</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="tl">Filipino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Time Zone</Label>
                  <Select defaultValue="pht">
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pht">Philippines Time (PHT)</SelectItem>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est">Eastern Time (EST)</SelectItem>
                      <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select defaultValue="mdy">
                    <SelectTrigger id="date-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Table Display Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="show-timestamp" defaultChecked />
                      <Label htmlFor="show-timestamp" className="font-normal">Show timestamps</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="show-location" defaultChecked />
                      <Label htmlFor="show-location" className="font-normal">Show location column</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="show-confidence" />
                      <Label htmlFor="show-confidence" className="font-normal">Show confidence scores</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="items-per-page">Items Per Page</Label>
                  <Select defaultValue="25">
                    <SelectTrigger id="items-per-page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-filter">Default Violation Filter</Label>
                  <Select defaultValue="unresolved">
                    <SelectTrigger id="default-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Violations</SelectItem>
                      <SelectItem value="unresolved">Unresolved Only</SelectItem>
                      <SelectItem value="today">Today's Violations</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => handleSave('UI Preferences')}>Save Preferences</Button>
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
              <CardContent className="space-y-4">
                <Alert className="mb-4">
                  <Monitor className="h-4 w-4" />
                  <AlertDescription>
                    <strong>YOLOv11 Backend Configuration:</strong> Detection thresholds and processing parameters are 
                    preconfigured at the backend level for optimal performance. Contact system administrator for backend 
                    parameter adjustments.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
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
                      <Button variant="outline" className="w-full justify-start">
                        <Eye className="w-4 h-4 mr-2" />
                        View All Cameras
                      </Button>
                    </div>
                  </div>
                </div>
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
                <Button variant="outline" className="w-full">Export Data</Button>
                <Button onClick={() => handleSave('Database')}>Save Changes</Button>
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
                  <Switch id="auto-logout" defaultChecked />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input id="session-timeout" type="number" defaultValue="30" min="5" max="120" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password-policy">Password Minimum Length</Label>
                  <Input id="password-policy" type="number" defaultValue="8" min="6" max="32" />
                </div>

                <Button onClick={() => handleSave('Security Policies')}>Save Changes</Button>
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
                <Button variant="outline" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="w-4 h-4 mr-2" />
                  Pending Registrations
                </Button>

                {showAddOperator && (
                  <div className="mt-4 border rounded-lg p-4 space-y-3 bg-muted/40">
                    <p className="font-semibold text-sm">Add New TMC Operator</p>
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
                          placeholder="operator@example.com"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="op-password">Temporary Password</Label>
                        <Input
                          id="op-password"
                          type="password"
                          value={newOperator.password}
                          onChange={(e) =>
                            setNewOperator((prev) => ({ ...prev, password: e.target.value }))
                          }
                          placeholder="Generate or set a temporary password"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Role</Label>
                        <Input value="TMC Operator" disabled />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddOperator(false);
                          setNewOperator({ name: '', email: '', password: '' });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleCreateOperator}>
                        Save Operator
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
            <strong>Read-Only Access:</strong> You can view system detection thresholds, camera list, global notification rules, 
            storage status, and backup schedules in their respective sections, but cannot modify them. Contact an administrator 
            to request changes to system-wide settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Settings;
