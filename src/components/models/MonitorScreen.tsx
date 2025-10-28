import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface MonitorScreenProps {
  position: [number, number, number];
}

export const MonitorScreen = ({ position }: MonitorScreenProps) => {
  const screenRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (screenRef.current) {
      const material = screenRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group position={position}>
      {/* Monitor stand base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.1, 16]} />
        <meshStandardMaterial color="#2A3342" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Monitor stand pole */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.9, 16]} />
        <meshStandardMaterial color="#2A3342" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Monitor back */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.6, 1, 0.1]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Monitor screen */}
      <mesh ref={screenRef} position={[0, 1.2, 0.06]} castShadow>
        <boxGeometry args={[1.5, 0.9, 0.02]} />
        <meshStandardMaterial
          color="#0A1628"
          emissive="#003366"
          emissiveIntensity={0.3}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      
      {/* Screen content - Detection box */}
      <mesh position={[-0.2, 1.3, 0.07]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial
          color="#00D4FF"
          emissive="#00D4FF"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Detection text */}
      <Text
        position={[-0.45, 1.55, 0.08]}
        fontSize={0.06}
        color="#FF4444"
        anchorX="left"
        anchorY="middle"
      >
        ⚠ NO HELMET DETECTED
      </Text>
      
      <Text
        position={[-0.45, 1.1, 0.08]}
        fontSize={0.05}
        color="#00FF88"
        anchorX="left"
        anchorY="middle"
      >
        Plate: ABC-1234
      </Text>
      
      {/* Stats display */}
      <Text
        position={[0.3, 1.45, 0.08]}
        fontSize={0.05}
        color="#00D4FF"
        anchorX="left"
        anchorY="middle"
      >
        Accuracy: 92.5%
      </Text>
      
      <Text
        position={[0.3, 1.35, 0.08]}
        fontSize={0.05}
        color="#00D4FF"
        anchorX="left"
        anchorY="middle"
      >
        mAP: 95.0%
      </Text>
      
      <Text
        position={[0.3, 1.25, 0.08]}
        fontSize={0.05}
        color="#00D4FF"
        anchorX="left"
        anchorY="middle"
      >
        FPS: 120
      </Text>
      
      {/* Processing indicator */}
      <mesh position={[0.6, 0.95, 0.08]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial
          color="#00FF88"
          emissive="#00FF88"
          emissiveIntensity={1}
        />
      </mesh>
      
      <Text
        position={[0.5, 0.95, 0.08]}
        fontSize={0.04}
        color="#00FF88"
        anchorX="right"
        anchorY="middle"
      >
        LIVE
      </Text>
      
      {/* Monitor label */}
      <Text
        position={[0, 1.8, 0]}
        fontSize={0.12}
        color="#B84FFF"
        anchorX="center"
        anchorY="middle"
      >
        Monitoring Display
      </Text>
    </group>
  );
};
