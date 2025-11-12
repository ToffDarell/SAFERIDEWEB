import { useNavigate } from 'react-router-dom';
import { Scene3D } from '@/components/Scene3D';
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
      
      {/* Conceptual Framework Section */}
      <div className="relative bg-background z-10">
        <ConceptualFramework />
      </div>
    </div>
  );
};

export default Index;
