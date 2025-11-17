import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Lock, Mail, UserCog, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'tmc_operator'>('admin');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Login Failed",
        description: "Please enter valid credentials",
        variant: "destructive",
      });
      return;
    }

    // Check if TMC operator and pending approval
    if (selectedRole === 'tmc_operator') {
      const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
      const pendingUser = pendingUsers.find((u: any) => u.email === email);
      
      if (pendingUser && pendingUser.status === 'pending') {
        toast({
          title: "Account Pending",
          description: "Your account is awaiting administrator approval",
          variant: "destructive",
        });
        return;
      }

      const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
      const approvedUser = approvedUsers.find((u: any) => u.email === email && u.password === password);
      
      if (!approvedUser) {
        toast({
          title: "Login Failed",
          description: "Invalid credentials or account not approved",
          variant: "destructive",
        });
        return;
      }
    }

    // Store current user session
    localStorage.setItem('currentUser', JSON.stringify({
      email,
      role: selectedRole,
      name: selectedRole === 'admin' ? 'Administrator' : 'TMC Operator',
      loginTime: new Date().toISOString(),
    }));

    toast({
      title: "Login Successful",
      description: `Welcome back, ${selectedRole === 'admin' ? 'Administrator' : 'TMC Operator'}`,
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
            <Camera className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">SafeRide AI</h1>
            <p className="text-muted-foreground mt-2">Helmet Violation Detection System</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">System Login</CardTitle>
            <CardDescription>
              Select your role and enter credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'tmc_operator')} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="admin" className="gap-2">
                  <Shield className="w-4 h-4" />
                  Admin
                </TabsTrigger>
                <TabsTrigger value="tmc_operator" className="gap-2">
                  <UserCog className="w-4 h-4" />
                  TMC Operator
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={selectedRole === 'admin' ? 'admin@saferide.ai' : 'operator@tmc.gov'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Sign In as {selectedRole === 'admin' ? 'Admin' : 'TMC Operator'}
              </Button>

              {selectedRole === 'tmc_operator' && (
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => navigate('/register')}
                  >
                    Don't have an account? Register here
                  </button>
                </div>
              )}

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => {
                    toast({
                      title: "Demo Mode",
                      description: "Use any email and password to access the demo",
                    });
                  }}
                >
                  Demo Credentials
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          © 2025 SafeRide AI. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
