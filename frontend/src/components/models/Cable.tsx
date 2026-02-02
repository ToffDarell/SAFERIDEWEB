import * as THREE from 'three';
import { useMemo } from 'react';

interface CableProps {
  start: [number, number, number];
  end: [number, number, number];
}

export const Cable = ({ start, end }: CableProps) => {
  const curve = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const midPoint = new THREE.Vector3(
      (start[0] + end[0]) / 2,
      Math.max(start[1], end[1]) + 0.05,
      (start[2] + end[2]) / 2
    );
    
    return new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
  }, [start, end]);

  const points = curve.getPoints(50);
  const geometry = useMemo(() => {
    const tubeGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      50,
      0.01,
      8,
      false
    );
    return tubeGeometry;
  }, [points]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#C41E3A" metalness={0.2} roughness={0.8} />
    </mesh>
  );
};
