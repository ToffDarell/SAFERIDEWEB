import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CCTVCameraProps {
  position: [number, number, number];
}

export const CCTVCamera = ({ position }: CCTVCameraProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Camera base/stand */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.2, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
      </mesh>
      
      {/* Camera pivot mount */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.12, 0.15, 0.12]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} metalness={0.6} />
      </mesh>
      
      {/* Main camera body */}
      <mesh position={[0, 0.5, 0.15]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#f7fafc" roughness={0.2} metalness={0.8} />
      </mesh>
      
      {/* Camera top section */}
      <mesh position={[0, 0.65, 0.15]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.35, 0.05, 0.45]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.7} />
      </mesh>
      
      {/* Camera lens housing */}
      <mesh position={[0, 0.5, 0.4]} rotation={[-0.3, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.15, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.9} />
      </mesh>
      
      {/* Camera lens glass */}
      <mesh position={[0, 0.5, 0.48]} rotation={[-0.3, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 32]} />
        <meshStandardMaterial
          color="#1e40af"
          roughness={0.1}
          metalness={0.9}
          emissive="#3b82f6"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* IR LEDs around lens */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * 0.13;
        const z = Math.sin(rad) * 0.13;
        return (
          <mesh key={i} position={[x, 0.5, 0.45 + z]} rotation={[-0.3, 0, 0]}>
            <sphereGeometry args={[0.015, 16, 16]} />
            <meshStandardMaterial
              color="#991b1b"
              emissive="#dc2626"
              emissiveIntensity={0.5}
            />
          </mesh>
        );
      })}
      
      {/* Status LED (green) */}
      <mesh position={[0.15, 0.6, 0.1]} rotation={[-0.3, 0, 0]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#10b981"
          emissiveIntensity={1}
        />
      </mesh>
      
      {/* Camera brand/model text */}
      <mesh position={[0, 0.35, 0.08]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.25, 0.05, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      
      {/* Cable port */}
      <mesh position={[-0.15, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 16]} />
        <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
};
