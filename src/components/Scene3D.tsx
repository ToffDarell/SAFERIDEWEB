import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { CCTVCamera } from './models/CCTVCamera';
import { ProcessingUnit } from './models/ProcessingUnit';
import { Cable } from './models/Cable';
import { Suspense } from 'react';

export const Scene3D = () => {
  return (
    <div className="w-full h-screen bg-gradient-to-b from-gray-100 to-white">
      <Canvas shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 4, 8]} fov={45} />
          <OrbitControls
            enablePan={true}
            minDistance={4}
            maxDistance={15}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.2}
          />
          
          {/* Professional studio lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#ffffff" />
          <pointLight position={[0, 5, 3]} intensity={0.3} color="#ffffff" />
          
          {/* Desk surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[15, 15]} />
            <meshStandardMaterial color="#f5f5f5" roughness={0.2} metalness={0.1} />
          </mesh>
          
          {/* 3D Models */}
          <CCTVCamera position={[-2, 0, 0]} />
          <ProcessingUnit position={[2, 0, 0]} />
          <Cable 
            start={[-1.5, 0.3, 0]} 
            end={[1.5, 0.15, 0]} 
          />
          
          {/* Floating labels */}
          <Text
            position={[-2, 1.8, 0]}
            fontSize={0.15}
            color="#1a1a1a"
            anchorX="center"
            anchorY="middle"
            maxWidth={3}
          >
            Helmet & Plate Detection Camera{'\n'}(YOLOv8)
          </Text>
          
          <Text
            position={[2, 1.5, 0]}
            fontSize={0.12}
            color="#1a1a1a"
            anchorX="center"
            anchorY="middle"
            maxWidth={3}
          >
            Connected to Raspberry Pi{'\n'}for Real-Time Processing
          </Text>
          
          <Text
            position={[0, 0.8, -1.5]}
            fontSize={0.11}
            color="#4a5568"
            anchorX="center"
            anchorY="middle"
            maxWidth={4}
          >
            Captures Helmet Violation and Plate Data
          </Text>
        </Suspense>
      </Canvas>
    </div>
  );
};
