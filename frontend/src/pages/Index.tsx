import { useNavigate } from 'react-router-dom';
import { ConceptualFramework } from '@/components/ConceptualFramework';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Camera, Cpu, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-gradient-to-b from-background to-background/95">
      {/* Hero Section */}
      <div className="relative w-full min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">SafeRide AI</h1>
                  <p className="text-sm text-muted-foreground">Helmet Violation Detection System</p>
                </div>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30 px-4 py-2 text-sm">
                <Activity className="w-4 h-4 mr-2" />
                System Active
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-bold text-foreground">
                AI-Powered Helmet Detection
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Automated motorcycle helmet violation detection system using computer vision and real-time monitoring
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
              <Card className="p-6 bg-card/80 backdrop-blur-md border-border/50">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/20 border border-primary/30">
                    <Camera className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">CCTV Detection</h3>
                    <p className="text-sm text-muted-foreground">
                      Real-time video analysis with YOLOv11
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/80 backdrop-blur-md border-border/50">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-3 rounded-lg bg-accent/20 border border-accent/30">
                    <Cpu className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Edge Processing</h3>
                    <p className="text-sm text-muted-foreground">
                      Raspberry Pi with OCR recognition
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/80 backdrop-blur-md border-border/50">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/20 border border-primary/30">
                    <AlertTriangle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Violation Tracking</h3>
                    <p className="text-sm text-muted-foreground">
                      Automated recording and reporting
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* CTA Button */}
            <div className="mt-12">
              <Button 
                size="lg"
                onClick={() => navigate('/')}
                className="shadow-lg text-lg px-8 py-6"
              >
                Access Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="p-6 bg-card/50 backdrop-blur-sm border-t border-border/50">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">24</div>
              <div className="text-sm text-muted-foreground">Active Cameras</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">1,284</div>
              <div className="text-sm text-muted-foreground">Violations Detected</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">95.2%</div>
              <div className="text-sm text-muted-foreground">Detection Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">3,891</div>
              <div className="text-sm text-muted-foreground">Plates Recognized</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Conceptual Framework Section */}
      <div className="relative bg-white z-10">
        <ConceptualFramework />
      </div>
    </div>
  );
};

export default Index;