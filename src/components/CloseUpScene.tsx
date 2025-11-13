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
      <Canvas shadows onCreated={({ scene }) => scene.background = new THREE.Color('#f5f5f5')}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[1.2, 0.8, 1.5]} fov={35} />
          <OrbitControls
            enablePan={false}
            minDistance={1}
            maxDistance={3}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, 0.15, 0]}
          />
          
          {/* Realistic studio lighting */}
          <ambientLight intensity={1.2} />
          <directionalLight
            position={[2, 3, 2]}
            intensity={1.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-1, 1, 1]} intensity={0.6} />
          <pointLight position={[1, 0.5, -0.5]} intensity={0.4} />
          
          {/* Lab table surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[3, 3]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} />
          </mesh>
          
          {/* Components positioned on table */}
          <ProcessingUnit position={[-0.4, 0.01, 0]} />
          <CCTVCamera position={[0.5, 0.01, 0.15]} />
          <Cable start={[-0.2, 0.22, 0.1]} end={[0.5, 0.15, 0.15]} />
        </Suspense>
      </Canvas>
    </div>
  );
};
