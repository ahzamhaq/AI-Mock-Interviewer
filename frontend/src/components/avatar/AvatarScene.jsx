// Minimal AI assistant — single faceted orb that reacts to speaking / listening
// via subtle scale, emissive intensity, and orbital ring activity.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLOR_IDLE      = '#1F6FEB';
const COLOR_SPEAKING  = '#58A6FF';
const COLOR_LISTENING = '#F85149';
const COLOR_DARK      = '#0D1117';

// ── Central core orb ─────────────────────────────────────────────────────────

const Core = ({ isSpeaking, isListening, amplitude }) => {
  const meshRef = useRef();
  const innerRef = useRef();

  // Slight low-poly faceting for that "technical" sphere look
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!meshRef.current) return;

    // Slow idle rotation
    meshRef.current.rotation.y = t * 0.15;
    meshRef.current.rotation.x = Math.sin(t * 0.4) * 0.05;

    // Breathing scale — subtle (no cartoon bounce)
    const idleBreathe = 1 + Math.sin(t * 1.6) * 0.015;
    const speakingPulse = isSpeaking ? amplitude * 0.12 : 0;
    const listenPulse = isListening ? Math.sin(t * 6) * 0.02 : 0;
    const target = idleBreathe + speakingPulse + listenPulse;
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, target, 0.25));

    // Inner glow scale (slightly larger when speaking)
    if (innerRef.current) {
      const innerTarget = isSpeaking ? 0.95 + amplitude * 0.15 : isListening ? 0.85 : 0.78;
      innerRef.current.scale.setScalar(THREE.MathUtils.lerp(innerRef.current.scale.x, innerTarget, 0.15));
    }
  });

  const activeColor = isListening ? COLOR_LISTENING : isSpeaking ? COLOR_SPEAKING : COLOR_IDLE;
  const emissiveIntensity = isSpeaking ? 0.6 + amplitude * 0.8 : isListening ? 0.55 : 0.35;

  return (
    <group>
      {/* Outer faceted shell */}
      <mesh ref={meshRef} geometry={geo}>
        <meshStandardMaterial
          color={COLOR_DARK}
          emissive={activeColor}
          emissiveIntensity={emissiveIntensity * 0.4}
          metalness={0.8}
          roughness={0.35}
          flatShading
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshBasicMaterial
          color={activeColor}
          transparent
          opacity={0.18}
        />
      </mesh>
    </group>
  );
};

// ── Orbital ring (status indicator) ──────────────────────────────────────────

const OrbitalRing = ({ isSpeaking, isListening, amplitude }) => {
  const ringRef = useRef();
  const ring2Ref = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.3;
      ringRef.current.rotation.x = Math.PI / 2.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.5;
      ring2Ref.current.rotation.x = Math.PI / 1.8;
    }
  });

  const ringColor = isListening ? COLOR_LISTENING : COLOR_SPEAKING;
  const intensity = isSpeaking ? 1.2 + amplitude * 0.8 : isListening ? 1.0 : 0.4;

  return (
    <>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.55, 0.008, 8, 80]} />
        <meshBasicMaterial color={ringColor} transparent opacity={intensity * 0.5} />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1.7, 0.005, 8, 80]} />
        <meshBasicMaterial color={ringColor} transparent opacity={intensity * 0.3} />
      </mesh>
    </>
  );
};

// ── Particle constellation (background) ──────────────────────────────────────

const Particles = ({ count = 60 }) => {
  const pointsRef = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Spherical distribution at radius ~2.5
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.2 + Math.random() * 0.8;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.04;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#58A6FF" size={0.015} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
};

// ── Scene root ───────────────────────────────────────────────────────────────

const AvatarScene = ({ isSpeaking, isListening, amplitude = 0 }) => (
  <>
    <ambientLight intensity={0.3} />
    <directionalLight position={[4, 3, 5]} intensity={0.6} color="#ffffff" />
    <pointLight position={[-3, 2, 2]} intensity={0.5} color="#58A6FF" />
    <pointLight position={[2, -1, 3]} intensity={0.3} color="#1F6FEB" />
    <Particles />
    <Core isSpeaking={isSpeaking} isListening={isListening} amplitude={amplitude} />
    <OrbitalRing isSpeaking={isSpeaking} isListening={isListening} amplitude={amplitude} />
  </>
);

export default AvatarScene;
