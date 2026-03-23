import { Camera, Cpu, Database, Shield, ArrowRight, Hexagon } from 'lucide-react';

export const ConceptualFramework = () => {
  return (
    <div className="mx-auto w-full max-w-7xl bg-background px-4 py-12">
      <h2 className="app-page-heading mb-12 text-center">
        Conceptual Framework
      </h2>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        {/* INPUT */}
        <div className="flex-1 min-w-[250px]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Shield className="h-8 w-8 text-foreground" />
              </div>
              <h3 className="app-section-title">INPUT</h3>
            </div>
            <div className="space-y-3">
              <p className="app-body-text leading-relaxed">
                Problems with helmet law enforcement
              </p>
              <p className="app-body-text leading-relaxed">
                Need for automation and real-time monitoring
              </p>
              <p className="app-body-text leading-relaxed">
                Manual violation recording inefficiencies
              </p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden md:block">
          <ArrowRight className="w-8 h-8 text-primary animate-pulse" />
        </div>

        {/* PROCESS */}
        <div className="flex-1 min-w-[250px]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Cpu className="h-8 w-8 text-foreground" />
              </div>
              <h3 className="app-section-title">PROCESS</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Camera className="h-7 w-7 text-foreground" />
                <span className="app-body-text">CCTV Camera Capture</span>
              </div>
              <div className="flex items-center gap-3">
                <Hexagon className="h-7 w-7 text-foreground" />
                <span className="app-body-text">Raspberry Pi Processing</span>
              </div>
              <div className="flex items-center gap-3">
                <Cpu className="h-7 w-7 text-foreground" />
                <span className="app-body-text">YOLOv11 Detection</span>
              </div>
              <div className="flex items-center gap-3">
                <Database className="h-7 w-7 text-foreground" />
                <span className="app-body-text">OCR Plate Recognition</span>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden md:block">
          <ArrowRight className="w-8 h-8 text-primary animate-pulse" />
        </div>

        {/* OUTPUT */}
        <div className="flex-1 min-w-[250px]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Database className="h-8 w-8 text-foreground" />
              </div>
              <h3 className="app-section-title">OUTPUT</h3>
            </div>
            <div className="space-y-3">
              <p className="app-body-text leading-relaxed">
                AI-powered detection system
              </p>
              <p className="app-body-text leading-relaxed">
                Automated violation recording
              </p>
              <p className="app-body-text leading-relaxed">
                Database storage with plate recognition
              </p>
              <p className="app-body-text leading-relaxed">
                Real-time enforcement support
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
