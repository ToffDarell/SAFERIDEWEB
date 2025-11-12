import { Camera, Cpu, Database, Shield, ArrowRight, Hexagon } from 'lucide-react';

export const ConceptualFramework = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-12">
      <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
        Conceptual Framework
      </h2>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        {/* INPUT */}
        <div className="flex-1 min-w-[250px]">
          <div className="bg-card border-2 border-primary/30 rounded-lg p-6 shadow-lg hover:border-primary/60 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">INPUT</h3>
            </div>
            <div className="space-y-3 text-muted-foreground">
              <p className="text-sm leading-relaxed">
                Problems with helmet law enforcement
              </p>
              <p className="text-sm leading-relaxed">
                Need for automation and real-time monitoring
              </p>
              <p className="text-sm leading-relaxed">
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
          <div className="bg-card border-2 border-accent/30 rounded-lg p-6 shadow-lg hover:border-accent/60 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-accent">PROCESS</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">CCTV Camera Capture</span>
              </div>
              <div className="flex items-center gap-3">
                <Hexagon className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Raspberry Pi Processing</span>
              </div>
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">YOLOv8 Detection</span>
              </div>
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">OCR Plate Recognition</span>
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
          <div className="bg-card border-2 border-primary-glow/30 rounded-lg p-6 shadow-lg hover:border-primary-glow/60 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary-glow/20 flex items-center justify-center">
                <Database className="w-6 h-6 text-primary-glow" />
              </div>
              <h3 className="text-xl font-bold text-primary-glow">OUTPUT</h3>
            </div>
            <div className="space-y-3 text-muted-foreground">
              <p className="text-sm leading-relaxed">
                AI-powered detection system
              </p>
              <p className="text-sm leading-relaxed">
                Automated violation recording
              </p>
              <p className="text-sm leading-relaxed">
                Database storage with plate recognition
              </p>
              <p className="text-sm leading-relaxed">
                Real-time enforcement support
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
