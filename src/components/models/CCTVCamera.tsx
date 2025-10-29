import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface CCTVCameraProps {
  position: [number, number, number];
}

export const CCTVCamera = ({ position }: CCTVCameraProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Pole */}
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 4, 16]} />
        <meshStandardMaterial color="#2A3342" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Pole base */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.35, 0.3, 16]} />
        <meshStandardMaterial color="#1A2332" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Camera body */}
      <mesh position={[0, 3.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.8, 16]} />
        <meshStandardMaterial color="#E8E8E8" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Camera lens */}
      <mesh position={[0.4, 3.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
        <meshStandardMaterial color="#0A0A0A" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Lens glass with cyan glow */}
      <mesh position={[0.45, 3.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
        <meshStandardMaterial
          color="#00D4FF"
          emissive="#00D4FF"
          emissiveIntensity={0.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      
      {/* Camera mount */}
      <mesh position={[-0.2, 3.8, 0]} castShadow>
        <boxGeometry args={[0.15, 0.4, 0.4]} />
        <meshStandardMaterial color="#2A3342" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* LED indicator */}
      <mesh position={[0.3, 4.1, 0]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial
          color="#00FF88"
          emissive="#00FF88"
          emissiveIntensity={1}
        />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, 4.5, 0]}
        fontSize={0.2}
        color="#00D4FF"
        anchorX="center"
        anchorY="middle"
      >
        AI CCTV UNIT
      </Text>
    </group>
  );
};
