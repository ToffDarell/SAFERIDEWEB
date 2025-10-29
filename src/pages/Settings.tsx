import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bell, Shield, Database, Monitor } from 'lucide-react';

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Manage system configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Detection Settings</CardTitle>
                <CardDescription>Configure AI detection parameters</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence Threshold (%)</Label>
              <Input id="confidence" type="number" defaultValue="85" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fps">Target FPS</Label>
              <Input id="fps" type="number" defaultValue="120" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="realtime">Real-time Processing</Label>
              <Switch id="realtime" defaultChecked />
            </div>
            <Button className="w-full">Save Changes</Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-accent" />
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure alert preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-alerts">Email Alerts</Label>
              <Switch id="email-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-alerts">SMS Alerts</Label>
              <Switch id="sms-alerts" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="push-alerts">Push Notifications</Label>
              <Switch id="push-alerts" defaultChecked />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-email">Alert Email</Label>
              <Input id="alert-email" type="email" placeholder="admin@saferide.ai" />
            </div>
            <Button className="w-full">Update Preferences</Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-destructive" />
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage access and security</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="2fa">Two-Factor Authentication</Label>
              <Switch id="2fa" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-logout">Auto Logout</Label>
              <Switch id="auto-logout" defaultChecked />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session">Session Timeout (minutes)</Label>
              <Input id="session" type="number" defaultValue="30" />
            </div>
            <Button variant="outline" className="w-full">Change Password</Button>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary" />
              <div>
                <CardTitle>Database</CardTitle>
                <CardDescription>Data retention and backup</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retention">Data Retention (days)</Label>
              <Input id="retention" type="number" defaultValue="90" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-backup">Automatic Backup</Label>
              <Switch id="auto-backup" defaultChecked />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">Backup Now</Button>
              <Button variant="outline" className="flex-1">Export Data</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
