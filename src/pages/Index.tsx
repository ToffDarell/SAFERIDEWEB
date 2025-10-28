import { UIOverlay } from '@/components/UIOverlay';
import hardwareImage from '@/assets/saferide-hardware.jpg';

const Index = () => {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-50">
      <img 
        src={hardwareImage} 
        alt="SafeRide AI Hardware - CCTV Camera connected to Raspberry Pi Processing Unit"
        className="w-full h-full object-cover"
      />
      <UIOverlay />
    </div>
  );
};

export default Index;
