import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Shield, Camera, Cpu, Activity } from 'lucide-react';

export const UIOverlay = () => {
  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm pointer-events-auto">
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

      {/* Bottom Info Cards */}
      <div className="absolute bottom-6 left-6 right-6 pointer-events-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-card/80 backdrop-blur-md border-border/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">AI CCTV Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time video analysis with YOLOv8 for helmet detection
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card/80 backdrop-blur-md border-border/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/20 border border-accent/30">
                <Cpu className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Plate Recognition</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic license plate extraction using OCR technology
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card/80 backdrop-blur-md border-border/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Performance</h3>
                <p className="text-sm text-muted-foreground">
                  120 FPS processing with 95% mAP accuracy
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-1/2 right-6 transform -translate-y-1/2 pointer-events-auto">
        <Card className="p-4 bg-card/80 backdrop-blur-md border-border/50 max-w-xs">
          <h4 className="font-semibold text-foreground mb-2">Controls</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>🖱️ Click & drag to rotate</li>
            <li>🖱️ Scroll to zoom</li>
            <li>📷 Explore the system</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
