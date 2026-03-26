import { useNavigate } from 'react-router-dom';
import { ConceptualFramework } from '@/components/ConceptualFramework';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Camera, Cpu, Activity, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-background">
      <div className="relative w-full min-h-screen flex flex-col">
        <div className="border-b border-border bg-card p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-2">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="app-page-heading">SafeRide AI</h1>
                  <p className="app-label-text">Helmet Violation Detection System</p>
                </div>
              </div>
              <Badge className="border-primary/20 bg-primary/10 px-4 py-2 text-primary">
                <Activity className="w-4 h-4 mr-2" />
                System Active
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="mx-auto max-w-2xl text-[18px] font-medium text-foreground">
                AI-Powered Helmet Detection
              </h2>
              <p className="app-body-text mx-auto max-w-2xl text-muted-foreground">
                Automated motorcycle helmet violation detection system using computer vision and real-time monitoring
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
              <Card className="border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                    <Camera className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="app-section-title mb-2">CCTV Detection</h3>
                    <p className="app-body-text text-muted-foreground">
                      Real-time video analysis with YOLOv11
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                    <Cpu className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="app-section-title mb-2">Edge Processing</h3>
                    <p className="app-body-text text-muted-foreground">
                      Raspberry Pi with OCR recognition
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                    <AlertTriangle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="app-section-title mb-2">Violation Tracking</h3>
                    <p className="app-body-text text-muted-foreground">
                      Automated recording and reporting
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-12">
              <Button
                size="lg"
                onClick={() => navigate('/')}
                className="px-8 py-6 shadow-sm"
              >
                Access Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card p-6">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-[18px] font-medium text-foreground">24</div>
              <div className="app-label-text">Active Cameras</div>
            </div>
            <div>
              <div className="text-[18px] font-medium text-foreground">1,284</div>
              <div className="app-label-text">Violations Detected</div>
            </div>
            <div>
              <div className="text-[18px] font-medium text-foreground">95.2%</div>
              <div className="app-label-text">Detection Rate</div>
            </div>
            <div>
              <div className="text-[18px] font-medium text-foreground">3,891</div>
              <div className="app-label-text">Plates Recognized</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 bg-background">
        <ConceptualFramework />
      </div>
    </div>
  );
};

export default Index;
