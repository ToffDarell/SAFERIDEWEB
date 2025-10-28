import { useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface CableProps {
  start: [number, number, number];
  end: [number, number, number];
}

export const Cable = ({ start, end }: CableProps) => {
  // Create a curved path for the cable
  const points: THREE.Vector3[] = [];
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  
  // Create a natural cable sag
  const midPoint = new THREE.Vector3(
    (start[0] + end[0]) / 2,
    Math.min(start[1], end[1]) - 0.15, // Sag down
    (start[2] + end[2]) / 2
  );
  
  // Generate smooth curve points
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const t2 = t * t;
    const t3 = t2 * t;
    const invT = 1 - t;
    const invT2 = invT * invT;
    const invT3 = invT2 * invT;
    
    // Quadratic Bezier curve
    const point = new THREE.Vector3(
      invT2 * start[0] + 2 * invT * t * midPoint.x + t2 * end[0],
      invT2 * start[1] + 2 * invT * t * midPoint.y + t2 * end[1],
      invT2 * start[2] + 2 * invT * t * midPoint.z + t2 * end[2]
    );
    
    points.push(point);
  }
  
  return (
    <>
      {/* Main cable */}
      <Line
        points={points}
        color="#1f2937"
        lineWidth={3}
      />
      
      {/* Cable connector at camera end */}
      <mesh position={start} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 16]} />
        <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.7} />
      </mesh>
      
      {/* Cable connector at Raspberry Pi end */}
      <mesh position={end} castShadow>
        <boxGeometry args={[0.08, 0.05, 0.12]} />
        <meshStandardMaterial color="#4b5563" roughness={0.4} metalness={0.7} />
      </mesh>
    </>
  );
};
