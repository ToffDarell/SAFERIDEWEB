import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { CCTVCamera } from './models/CCTVCamera';
import { ProcessingUnit } from './models/ProcessingUnit';
import { Cable } from './models/Cable';
import { Suspense } from 'react';

export const CloseUpScene = () => {
  return (
    <div className="w-full h-screen bg-background">
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[3, 2, 3]} fov={60} />
          <OrbitControls
            enablePan={false}
            minDistance={2}
            maxDistance={8}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, 2, 0]}
          />
          
          {/* Enhanced Lighting for close-up */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 8, 3]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-3, 4, -2]} intensity={0.6} color="#00D4FF" />
          <pointLight position={[3, 2, 3]} intensity={0.4} color="#B84FFF" />
          <spotLight
            position={[0, 5, 0]}
            angle={0.5}
            penumbra={1}
            intensity={0.5}
            castShadow
            color="#00D4FF"
          />
          
          <Environment preset="city" />
          
          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <planeGeometry args={[12, 12]} />
            <meshStandardMaterial color="#0A0E1A" opacity={0.8} transparent />
          </mesh>
          
          {/* Grid for reference */}
          <gridHelper args={[12, 12, '#1A2332', '#1A2332']} position={[0, -0.49, 0]} />
          
          {/* Models positioned closer for detailed view */}
          <CCTVCamera position={[-1.2, 0, 0]} />
          <ProcessingUnit position={[1.2, 0, 0]} />
          <Cable start={[-0.8, 3.8, 0]} end={[0.7, 0.8, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
};
