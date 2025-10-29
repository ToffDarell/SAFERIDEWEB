import { Scene3D } from '@/components/Scene3D';
import { UIOverlay } from '@/components/UIOverlay';

const Index = () => {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Scene3D />
      <UIOverlay />
    </div>
  );
};

export default Index;
