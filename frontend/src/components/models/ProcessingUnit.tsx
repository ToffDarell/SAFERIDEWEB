import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface ProcessingUnitProps {
  position: [number, number, number];
}

export const ProcessingUnit = ({ position }: ProcessingUnitProps) => {
  const lightRef = useRef<THREE.PointLight>(null);
  
  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.intensity = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Raspberry Pi Board - Main PCB */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.56, 0.02, 0.35]} />
        <meshStandardMaterial color="#1B7B2E" metalness={0.3} roughness={0.7} />
      </mesh>
      
      {/* CPU/SoC Chip */}
      <mesh position={[0, 0.22, 0.05]} castShadow>
        <boxGeometry args={[0.15, 0.015, 0.15]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* RAM Chip */}
      <mesh position={[0.15, 0.22, -0.05]} castShadow>
        <boxGeometry args={[0.12, 0.012, 0.12]} />
        <meshStandardMaterial color="#2A2A2A" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* USB Ports */}
      {[0, 1].map((i) => (
        <mesh key={`usb-${i}`} position={[-0.25, 0.23, -0.1 + i * 0.08]} castShadow>
          <boxGeometry args={[0.05, 0.03, 0.06]} />
          <meshStandardMaterial color="#4A4A4A" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      
      {/* Ethernet Port */}
      <mesh position={[-0.25, 0.24, 0.1]} castShadow>
        <boxGeometry args={[0.05, 0.04, 0.08]} />
        <meshStandardMaterial color="#525252" metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* HDMI Port */}
      <mesh position={[0.25, 0.22, 0.05]} castShadow>
        <boxGeometry args={[0.04, 0.02, 0.06]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Power LED */}
      <mesh position={[0.22, 0.22, -0.12]}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshStandardMaterial
          color="#FF0000"
          emissive="#FF0000"
          emissiveIntensity={0.6}
        />
      </mesh>
      
      {/* Activity LED */}
      <mesh position={[0.18, 0.22, -0.12]}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshStandardMaterial
          color="#00FF00"
          emissive="#00FF00"
          emissiveIntensity={0.6}
        />
      </mesh>
      
      <pointLight ref={lightRef} position={[0.2, 0.3, -0.12]} color="#00FF00" intensity={0.3} distance={0.5} />
      
      {/* GPIO Header Pins */}
      <mesh position={[0.1, 0.22, -0.1]} castShadow>
        <boxGeometry args={[0.25, 0.03, 0.05]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* MicroSD Card Slot */}
      <mesh position={[0, 0.21, 0.175]} castShadow>
        <boxGeometry args={[0.08, 0.01, 0.02]} />
        <meshStandardMaterial color="#2A2A2A" metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.08}
        color="#1A1A1A"
        anchorX="center"
        anchorY="middle"
      >
        Raspberry Pi 4
      </Text>
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.05}
        color="#666666"
        anchorX="center"
        anchorY="middle"
      >
        Processing Unit
      </Text>
    </group>
  );
};
