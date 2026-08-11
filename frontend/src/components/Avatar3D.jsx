import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Baymax-style Audio-Reactive Sphere Avatar
 * No human visemes - uses audio frequency analysis for pulsing animation
 */

function BaymaxSphere({ audioData, avatarType }) {
  const meshRef = useRef();
  const [scale, setScale] = useState(1.0);
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const timeRef = useRef(0);

  // Initialize audio analysis when audioData changes
  useEffect(() => {
    if (!audioData) {
      // Clean up previous audio
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      setScale(1.0);
      return;
    }

    // Create audio context and analyser
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    // Create audio element from blob
    const audio = new Audio();
    const url = URL.createObjectURL(audioData);
    audio.src = url;
    audio.crossOrigin = 'anonymous';

    // Connect audio to analyser
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    // Play audio
    audio.play().catch(err => {
      console.error('Audio playback error:', err);
    });

    // Store references
    setAudioContext(ctx);
    setAnalyser(analyserNode);
    setAudioElement(audio);

    // Cleanup function
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (ctx && ctx.state !== 'closed') {
        ctx.close();
      }
      URL.revokeObjectURL(url);
    };
  }, [audioData]);

  // Animation loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta;

    // Idle animation: gentle floating
    const floatY = Math.sin(timeRef.current * 0.5) * 0.1;
    meshRef.current.position.y = floatY;

    // Idle rotation
    meshRef.current.rotation.y += delta * 0.2;

    // Audio-reactive scaling
    if (analyser && audioElement && !audioElement.paused) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average amplitude
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      // Map amplitude to scale (1.0 to 1.3)
      const targetScale = 1.0 + (average / 255) * 0.3;

      // Smooth transition using lerp
      const currentScale = meshRef.current.scale.x;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.15);

      meshRef.current.scale.set(newScale, newScale, newScale);
      setScale(newScale);
    } else {
      // Return to normal size when not speaking
      const currentScale = meshRef.current.scale.x;
      const newScale = THREE.MathUtils.lerp(currentScale, 1.0, 0.1);
      meshRef.current.scale.set(newScale, newScale, newScale);
      setScale(newScale);
    }
  });

  // Determine color based on avatar type
  const getAvatarColor = () => {
    if (avatarType === 'cara') {
      // Female avatar: soft purple/pink gradient
      return '#a78bfa'; // Purple-400
    } else if (avatarType === 'kevin') {
      // Male avatar: blue gradient
      return '#60a5fa'; // Blue-400
    }
    return '#e0e7ff'; // Default: light purple
  };

  const getEmissiveColor = () => {
    if (avatarType === 'cara') {
      return '#c084fc'; // Purple-300
    } else if (avatarType === 'kevin') {
      return '#3b82f6'; // Blue-500
    }
    return '#c7d2fe'; // Default: light purple
  };

  return (
    <mesh ref={meshRef}>
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial
          color={getAvatarColor()}
          emissive={getEmissiveColor()}
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.1}
        />
      </Sphere>
    </mesh>
  );
}

function Avatar3D({ audioData, avatarType = 'cara', visemeTimeline = null }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <pointLight position={[-5, -5, -5]} intensity={0.3} color="#a78bfa" />

        {/* Baymax Sphere */}
        <BaymaxSphere audioData={audioData} avatarType={avatarType} />

        {/* Camera controls (optional - allows user to rotate view) */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  );
}

export default Avatar3D;
