import { useNavigate } from 'react-router-dom';
import { Scene3D } from '@/components/Scene3D';
import { CloseUpScene } from '@/components/CloseUpScene';
import { UIOverlay } from '@/components/UIOverlay';
import { ConceptualFramework } from '@/components/ConceptualFramework';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <div className="relative w-full h-screen">
        <Scene3D />
        <UIOverlay />
        
        {/* CTA Button */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <Button 
            size="lg"
            onClick={() => navigate('/login')}
            className="shadow-lg"
          >
            Access Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
      
      {/* Close-Up Scene Section */}
      <div className="relative bg-background z-10">
        <div className="text-center py-8 px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            System Components
          </h2>
          <p className="text-muted-foreground">
            Detailed view of CCTV camera connected to Raspberry Pi processing unit
          </p>
        </div>
        <CloseUpScene />
      </div>
      
      {/* Conceptual Framework Section */}
      <div className="relative bg-white z-10">
        <ConceptualFramework />
      </div>
    </div>
  );
};

export default Index;
