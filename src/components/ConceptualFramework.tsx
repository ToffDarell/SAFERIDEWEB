import { Camera, Cpu, Database, Shield, ArrowRight, Hexagon } from 'lucide-react';

export const ConceptualFramework = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-12 bg-white">
      <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
        Conceptual Framework
      </h2>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        {/* INPUT */}
        <div className="flex-1 min-w-[250px]">
          <div className="bg-white border-2 border-gray-300 rounded-lg p-6 shadow-md hover:border-primary/60 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">INPUT</h3>
            </div>
            <div className="space-y-3 text-gray-700">
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
          <div className="bg-white border-2 border-gray-300 rounded-lg p-6 shadow-md hover:border-accent/60 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">PROCESS</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-gray-900" />
                <span className="text-sm text-gray-700">CCTV Camera Capture</span>
              </div>
              <div className="flex items-center gap-3">
                <Hexagon className="w-5 h-5 text-gray-900" />
                <span className="text-sm text-gray-700">Raspberry Pi Processing</span>
              </div>
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-gray-900" />
                <span className="text-sm text-gray-700">YOLOv11 Detection</span>
              </div>
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-gray-900" />
                <span className="text-sm text-gray-700">OCR Plate Recognition</span>
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
          <div className="bg-white border-2 border-gray-300 rounded-lg p-6 shadow-md hover:border-primary-glow/60 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Database className="w-6 h-6 text-gray-900" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">OUTPUT</h3>
            </div>
            <div className="space-y-3 text-gray-700">
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
