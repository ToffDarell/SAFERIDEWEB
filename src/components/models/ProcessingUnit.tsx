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
      {/* Main server box */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.4]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Front panel */}
      <mesh position={[0, 0.6, 0.21]} castShadow>
        <boxGeometry args={[1.15, 1.15, 0.02]} />
        <meshStandardMaterial color="#0A0E1A" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* LED strip */}
      <mesh position={[0, 1.1, 0.22]}>
        <boxGeometry args={[0.8, 0.05, 0.01]} />
        <meshStandardMaterial
          color="#00D4FF"
          emissive="#00D4FF"
          emissiveIntensity={0.8}
        />
      </mesh>
      
      <pointLight ref={lightRef} position={[0, 1.1, 0.5]} color="#00D4FF" intensity={1} />
      
      {/* Ventilation grills */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 0.6, 0.22]}>
          <boxGeometry args={[0.2, 0.8, 0.01]} />
          <meshStandardMaterial color="#1A2332" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      
      {/* Status indicators */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 0.22]}>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#00FF88" : "#00D4FF"}
            emissive={i % 2 === 0 ? "#00FF88" : "#00D4FF"}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      
      {/* Base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[1.3, 0.1, 0.5]} />
        <meshStandardMaterial color="#2A3342" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.15}
        color="#00D4FF"
        anchorX="center"
        anchorY="middle"
      >
        SafeRide AI
      </Text>
      <Text
        position={[0, 1.3, 0]}
        fontSize={0.1}
        color="#B84FFF"
        anchorX="center"
        anchorY="middle"
      >
        Processing Unit
      </Text>
    </group>
  );
};
