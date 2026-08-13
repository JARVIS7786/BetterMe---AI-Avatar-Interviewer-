import React, {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getAvatarById } from '../config/avatars';

/**
 * Avatar3D - renders the REAL selected 3D avatar (GLB via useGLTF).
 *
 * Gemini TTS provides no viseme data, so "lip sync" here is honestly
 * frequency/amplitude-based: a Web Audio analyser drives the model's
 * real mouth/viseme morph targets (cara/kevin have them). Models without
 * morph targets (e.g. baymax) get an audio-reactive scale pulse instead.
 *
 * Audio lifecycle: exactly one <audio> element per audioData change,
 * fully cleaned up (paused, URL revoked, AudioContext closed), and the
 * parent is notified of playing/ended via onPlaybackChange.
 */

// Morph targets we drive (if present) and their relative gains.
// cara1.glb / kevin2.glb expose mouthOpen + Oculus viseme_* targets.
const MORPH_DRIVERS = [
  { name: 'mouthOpen', gain: 1.0 },
  { name: 'viseme_aa', gain: 0.8 },
  { name: 'viseme_O', gain: 0.55 },
];

const MODEL_HEIGHT = 2.1; // normalize every model to ~2.1 world units
const FLOOR_Y = -1.15;

/**
 * Loads and animates a GLB avatar:
 *  - auto-fits scale/position via bounding box (no per-model magic numbers)
 *  - idle bob + subtle sway
 *  - amplitude-driven mouth morphs when audio plays
 *  - scale pulse fallback when the model has no morph targets
 */
function GLBAvatar({ modelPath, amplitudeRef }) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef(null);
  const morphDriversRef = useRef([]);
  const smoothAmpRef = useRef(0);
  const timeRef = useRef(0);

  // Discover drivable morph targets once per model.
  useEffect(() => {
    const drivers = [];
    scene.traverse((obj) => {
      if (obj.morphTargetDictionary) {
        MORPH_DRIVERS.forEach(({ name, gain }) => {
          const index = obj.morphTargetDictionary[name];
          if (index !== undefined) {
            drivers.push({ obj, index, gain });
          }
        });
      }
    });
    morphDriversRef.current = drivers;
    console.log(
      `Avatar3D: ${modelPath} loaded with ${drivers.length} drivable morph target slots`
    );

    return () => {
      // Reset influences so a cached scene never gets stuck mid-expression.
      drivers.forEach(({ obj, index }) => {
        if (obj.morphTargetInfluences) obj.morphTargetInfluences[index] = 0;
      });
    };
  }, [scene, modelPath]);

  // Auto-fit: uniform scale so the model is MODEL_HEIGHT tall, standing on FLOOR_Y.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const rawHeight = size.y || 1;
    const scale = MODEL_HEIGHT / rawHeight;
    return {
      scale,
      position: [-center.x * scale, FLOOR_Y - box.min.y * scale, -center.z * scale],
    };
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;

    // Current audio amplitude (0 when silent/paused/no audio).
    const amp = readAmplitude(amplitudeRef.current);
    smoothAmpRef.current = THREE.MathUtils.lerp(smoothAmpRef.current, amp, 0.3);
    const level = smoothAmpRef.current;

    // Idle motion: gentle bob + subtle sway (not a spinning puppet).
    groupRef.current.position.y =
      fit.position[1] + Math.sin(t * 0.8) * 0.02;
    groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.08;

    if (morphDriversRef.current.length > 0) {
      // Audio-reactive mouth movement on the real mesh.
      const mouth = THREE.MathUtils.clamp(level * 1.9, 0, 0.95);
      morphDriversRef.current.forEach(({ obj, index, gain }) => {
        const target = mouth * gain;
        const current = obj.morphTargetInfluences[index] || 0;
        obj.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, target, 0.45);
      });
      // Tiny breathing scale, mostly flat.
      const s = fit.scale * (1 + level * 0.03);
      groupRef.current.scale.setScalar(s);
    } else {
      // No morph targets (e.g. baymax): visibly "speaking" via pulse.
      const s = fit.scale * (1 + level * 0.12);
      groupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group
      ref={groupRef}
      position={fit.position}
      scale={fit.scale}
    >
      <primitive object={scene} />
    </group>
  );
}

/** Reads 0..1 average frequency amplitude from the live analyser slot. */
function readAmplitude(slot) {
  if (!slot || !slot.audio || slot.audio.paused || slot.audio.ended) return 0;
  slot.analyser.getByteFrequencyData(slot.data);
  let sum = 0;
  for (let i = 0; i < slot.data.length; i++) sum += slot.data[i];
  return sum / slot.data.length / 255;
}

/**
 * Manages the single <audio> element + Web Audio analyser for audioData.
 * Full cleanup on change/unmount; reports playing state to the parent.
 */
function usePlaybackAudio(audioData, amplitudeRef, onPlaybackChange) {
  useEffect(() => {
    if (!audioData) {
      return undefined;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const audio = new Audio();
    const url = URL.createObjectURL(audioData);
    let disposed = false;

    const notifyEnded = () => onPlaybackChange?.(false);
    audio.addEventListener('ended', notifyEnded);

    audio.src = url;
    audio.crossOrigin = 'anonymous';

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    amplitudeRef.current = {
      analyser,
      audio,
      data: new Uint8Array(analyser.frequencyBinCount),
    };

    // Autoplay may be blocked; we surface that to the parent instead of
    // swallowing it, but never fire a second TTS request here.
    ctx.resume().catch(() => {});
    audio
      .play()
      .then(() => {
        if (!disposed) onPlaybackChange?.(true);
      })
      .catch((err) => {
        console.warn('Audio playback blocked or failed:', err);
        if (!disposed) onPlaybackChange?.(false, err);
      });

    return () => {
      disposed = true;
      audio.removeEventListener('ended', notifyEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      amplitudeRef.current = null;
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
      onPlaybackChange?.(false);
    };
    // onPlaybackChange is stable (useCallback in the parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioData]);
}

// ---- Fallbacks -----------------------------------------------------------

function ModelLoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="white" wireframe />
    </mesh>
  );
}

/**
 * Explicit fallback avatar. Only rendered when a model cannot load;
 * a warning is logged and the UI badge tells the user this is a fallback.
 */
function FallbackSphere({ amplitudeRef }) {
  const meshRef = useRef(null);
  const timeRef = useRef(0);
  const smoothAmpRef = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const amp = readAmplitude(amplitudeRef.current);
    smoothAmpRef.current = THREE.MathUtils.lerp(smoothAmpRef.current, amp, 0.25);
    meshRef.current.position.y = Math.sin(timeRef.current * 0.5) * 0.1;
    meshRef.current.rotation.y += delta * 0.2;
    const s = 1 + smoothAmpRef.current * 0.3;
    meshRef.current.scale.set(s, s, s);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        color="#a78bfa"
        emissive="#c084fc"
        emissiveIntensity={0.3}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

/** Catches useGLTF load failures (missing/corrupt models) instead of crashing. */
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Avatar3D: model failed to load:', error);
    this.props.onModelError?.(error);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---- Main component ------------------------------------------------------

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#a78bfa" />
    </>
  );
}

function Avatar3D({ audioData, avatarType = 'cara', onPlaybackChange, onModelError }) {
  const amplitudeRef = useRef(null);
  const [modelFailed, setModelFailed] = React.useState(false);

  usePlaybackAudio(audioData, amplitudeRef, onPlaybackChange);

  const avatar = getAvatarById(avatarType);
  const modelPath = avatar?.model || null;

  if (avatarType !== 'cara' && !avatar) {
    console.warn(`Avatar3D: unknown avatar id '${avatarType}' - fallback sphere shown`);
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ModelErrorBoundary
        onModelError={(err) => {
          setModelFailed(true);
          onModelError?.(err);
        }}
        fallback={
          <Canvas camera={{ position: [0, 0.4, 3], fov: 50 }} style={{ background: 'transparent' }}>
            <SceneLights />
            <FallbackSphere amplitudeRef={amplitudeRef} />
          </Canvas>
        }
      >
        <Canvas camera={{ position: [0, 0.55, 2.3], fov: 50 }} style={{ background: 'transparent' }}>
          <SceneLights />
          {modelPath ? (
            <Suspense fallback={<ModelLoadingFallback />}>
              <GLBAvatar modelPath={modelPath} amplitudeRef={amplitudeRef} />
            </Suspense>
          ) : (
            <FallbackSphere amplitudeRef={amplitudeRef} />
          )}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            target={[0, 0.55, 0]}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Canvas>
      </ModelErrorBoundary>

      {modelFailed && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#fbbf24',
            fontSize: 12,
          }}
        >
          3D model unavailable - fallback avatar shown
        </div>
      )}
    </div>
  );
}

export default Avatar3D;
