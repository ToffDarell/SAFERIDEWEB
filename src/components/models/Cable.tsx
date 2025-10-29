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
      Math.min(start[1], end[1]) - 0.5,
      (start[2] + end[2]) / 2
    );
    
    return new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
  }, [start, end]);

  const points = curve.getPoints(50);
  const geometry = useMemo(() => {
    const tubeGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      50,
      0.02,
      8,
      false
    );
    return tubeGeometry;
  }, [points]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#1A1A1A" metalness={0.3} roughness={0.7} />
    </mesh>
  );
};
