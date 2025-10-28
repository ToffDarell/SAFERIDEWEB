import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface ProcessingUnitProps {
  position: [number, number, number];
}

export const ProcessingUnit = ({ position }: ProcessingUnitProps) => {
  const ledRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ledRef.current) {
      const material = ledRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Main Raspberry Pi board */}
      <mesh position={[0, 0.025, 0]} castShadow>
        <boxGeometry args={[1.2, 0.05, 0.85]} />
        <meshStandardMaterial color="#1a5f3a" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Circuit board details - black chips */}
      <mesh position={[-0.2, 0.055, 0]} castShadow>
        <boxGeometry args={[0.25, 0.03, 0.25]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} metalness={0.5} />
      </mesh>
      
      <mesh position={[0.25, 0.055, -0.15]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} />
      </mesh>
      
      {/* GPIO pins */}
      <mesh position={[-0.35, 0.08, 0.15]} castShadow>
        <boxGeometry args={[0.35, 0.08, 0.12]} />
        <meshStandardMaterial color="#1f2937" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* USB ports */}
      <mesh position={[0.61, 0.08, 0.2]} castShadow>
        <boxGeometry args={[0.02, 0.08, 0.2]} />
        <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.7} />
      </mesh>
      
      <mesh position={[0.61, 0.08, -0.05]} castShadow>
        <boxGeometry args={[0.02, 0.08, 0.2]} />
        <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* Ethernet port */}
      <mesh position={[0.61, 0.1, -0.3]} castShadow>
        <boxGeometry args={[0.02, 0.12, 0.18]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
      </mesh>
      
      {/* HDMI port */}
      <mesh position={[-0.5, 0.06, -0.43]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <boxGeometry args={[0.15, 0.02, 0.07]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* Power port (USB-C) */}
      <mesh position={[-0.25, 0.06, -0.43]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.02, 0.05]} />
        <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* SD card slot */}
      <mesh position={[-0.61, 0.04, 0]} castShadow>
        <boxGeometry args={[0.02, 0.03, 0.2]} />
        <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.6} />
      </mesh>
      
      {/* Green Power LED */}
      <mesh ref={ledRef} position={[0.4, 0.06, 0.25]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={1}
        />
      </mesh>
      <pointLight position={[0.4, 0.1, 0.25]} color="#10b981" intensity={0.5} distance={0.5} />
      
      {/* Activity LED (yellow) */}
      <mesh position={[0.35, 0.06, 0.25]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.6}
        />
      </mesh>
      
      {/* Label on the board */}
      <Text
        position={[0.1, 0.06, 0.15]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        SafeRide AI{'\n'}Processing Unit
      </Text>
      
      {/* Raspberry Pi logo area */}
      <mesh position={[0.35, 0.051, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.08, 32]} />
        <meshStandardMaterial color="#c0174d" roughness={0.6} />
      </mesh>
    </group>
  );
};
