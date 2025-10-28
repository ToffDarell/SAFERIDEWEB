import { Shield } from 'lucide-react';

export const UIOverlay = () => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-3">
          <Shield className="w-10 h-10 text-foreground" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">SafeRide AI</h1>
            <p className="text-sm text-muted-foreground">
              Hardware Prototype - Helmet Violation Detection System
            </p>
          </div>
        </div>
      </header>

      {/* Controls hint */}
      <div className="absolute top-6 right-6 text-right">
        <p className="text-xs text-muted-foreground bg-background/80 px-3 py-2 rounded-lg backdrop-blur-sm">
          <span className="font-semibold">Drag</span> to rotate • <span className="font-semibold">Scroll</span> to zoom
        </p>
      </div>
    </div>
  );
};
