import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { CCTVCamera } from './models/CCTVCamera';
import { ProcessingUnit } from './models/ProcessingUnit';
import { Cable } from './models/Cable';
import { Suspense } from 'react';
import * as THREE from 'three';

export const CloseUpScene = () => {
  return (
    <div className="w-full h-screen bg-white">
      <Canvas shadows onCreated={({ scene }) => scene.background = new THREE.Color('#ffffff')}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0.8, 3.8, 1.2]} fov={40} />
          <OrbitControls
            enablePan={false}
            minDistance={0.8}
            maxDistance={2}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2}
            target={[0, 3.8, 0]}
          />
          
          {/* Lighting for white background */}
          <ambientLight intensity={0.8} />
          <directionalLight
            position={[3, 4, 2]}
            intensity={1.5}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-2, 3, -1]} intensity={0.4} />
          <pointLight position={[2, 2, 2]} intensity={0.3} />
          
          {/* White ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
            <planeGeometry args={[8, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          
          {/* Models positioned very close for detailed view */}
          <CCTVCamera position={[-0.6, 0, 0]} />
          <ProcessingUnit position={[0.6, 3.6, 0]} />
          <Cable start={[-0.4, 3.8, 0]} end={[0.4, 3.9, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
};
