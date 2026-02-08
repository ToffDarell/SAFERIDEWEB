import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Shield, UserCircle, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth';
import { googleAuthService } from '@/services/googleAuth';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('admin');
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verify reCAPTCHA
    const recaptchaValue = recaptchaRef.current?.getValue();
    if (!recaptchaValue) {
      toast({
        title: 'Verification Required',
        description: 'Please complete the reCAPTCHA verification',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await authService.login(credentials);
      
      // Get user info to check role
      const userInfo = await authService.getCurrentUser();
      
      // Validate role matches selected tab
      if (userInfo && userInfo.role !== activeTab) {
        authService.logout();
        
        const roleName = userInfo.role === 'admin' ? 'Administrator' : 'TMC Operator';
        
        toast({
          title: 'Login Failed',
          description: `This account is registered as ${roleName}. Please use the ${roleName} tab to login.`,
          variant: 'destructive',
        });
        
        recaptchaRef.current?.reset();
        setIsLoading(false);
        return;
      }
      
      localStorage.setItem('currentUser', JSON.stringify({
        name: credentials.username,
        role: activeTab,
      }));

      toast({
        title: 'Login Successful',
        description: `Welcome back, ${credentials.username}!`,
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
      recaptchaRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast({
        title: 'Google Login Failed',
        description: 'No credential received from Google',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await googleAuthService.loginWithGoogle(credentialResponse.credential);
      
      if (result.success) {
        if (result.user.role !== activeTab) {
          authService.logout();
          
          const roleName = result.user.role === 'admin' ? 'Administrator' : 'TMC Operator';
          
          toast({
            title: 'Login Failed',
            description: `This account is registered as ${roleName}. Please use the ${roleName} tab to login.`,
            variant: 'destructive',
          });
          
          setIsLoading(false);
          return;
        }
        
        toast({
          title: 'Login Successful',
          description: `Welcome, ${result.user.name}!`,
        });

        if (result.user.status === 'pending') {
          toast({
            title: 'Account Pending',
            description: 'Your account is pending admin approval.',
            variant: 'default',
          });
        }

        navigate('/dashboard');
      } else {
        toast({
          title: 'Google Login Failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Google Login Failed',
        description: error.message || 'An error occurred during Google login',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast({
      title: 'Google Login Failed',
      description: 'Failed to authenticate with Google',
      variant: 'destructive',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Camera className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SafeRide AI</h1>
          <p className="text-muted-foreground mt-2">Helmet Violation Detection System</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to access the SafeRide dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Admin
                </TabsTrigger>
                <TabsTrigger value="tmc_operator" className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4" />
                  TMC Operator
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-username">Username</Label>
                    <Input
                      id="admin-username"
                      name="username"
                      type="text"
                      placeholder="Enter your username"
                      value={credentials.username}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      value={credentials.password}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      theme="dark"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign in as Admin'}
                  </Button>
                </form>

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      useOneTap
                      theme="filled_blue"
                      size="large"
                      text="signin_with"
                      shape="rectangular"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tmc_operator">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="operator-username">Username</Label>
                    <Input
                      id="operator-username"
                      name="username"
                      type="text"
                      placeholder="Enter your username"
                      value={credentials.username}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="operator-password">Password</Label>
                    <Input
                      id="operator-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      value={credentials.password}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      theme="dark"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign in as Operator'}
                  </Button>
                </form>

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      useOneTap
                      theme="filled_blue"
                      size="large"
                      text="signin_with"
                      shape="rectangular"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <a href="/register" className="text-primary hover:underline font-medium">
                  Register here
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;