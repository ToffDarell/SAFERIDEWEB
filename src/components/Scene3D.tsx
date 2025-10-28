import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { CCTVCamera } from './models/CCTVCamera';
import { ProcessingUnit } from './models/ProcessingUnit';
import { MonitorScreen } from './models/MonitorScreen';
import { Suspense } from 'react';

export const Scene3D = () => {
  return (
    <div className="w-full h-screen bg-background">
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={50} />
          <OrbitControls
            enablePan={false}
            minDistance={5}
            maxDistance={20}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
          />
          
          {/* Lighting */}
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-5, 5, -5]} intensity={0.5} color="#00D4FF" />
          <pointLight position={[5, 3, 5]} intensity={0.3} color="#B84FFF" />
          
          <Environment preset="city" />
          
          {/* Grid floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#0A0E1A" opacity={0.8} transparent />
          </mesh>
          
          {/* Grid lines */}
          <gridHelper args={[20, 20, '#1A2332', '#1A2332']} position={[0, -0.49, 0]} />
          
          {/* 3D Models */}
          <CCTVCamera position={[-3, 0, 0]} />
          <ProcessingUnit position={[2, 0, -2]} />
          <MonitorScreen position={[3, 0, 2]} />
        </Suspense>
      </Canvas>
    </div>
  );
};
