import React, {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getAvatarById } from '../config/avatars';

/**
 * Avatar3D - renders the REAL selected 3D avatar (GLB via useGLTF).
 *
 * Audio playback uses one persistent Web Audio context per Avatar3D mount.
 * The analyser is reused between questions instead of creating/closing an
 * AudioContext for every generated TTS clip. This avoids browser resource
 * churn during multi-question interviews.
 */

const MORPH_DRIVERS = [
  { name: 'mouthOpen', gain: 1.0 },
  { name: 'viseme_aa', gain: 0.8 },
  { name: 'viseme_O', gain: 0.55 },
];

const MODEL_HEIGHT = 2.1;
const FLOOR_Y = -1.15;

function GLBAvatar({ modelPath, idleAnimation, amplitudeRef }) {
  const { scene, animations } = useGLTF(modelPath);
  const groupRef = useRef(null);
  const morphDriversRef = useRef([]);
  const smoothAmpRef = useRef(0);
  const timeRef = useRef(0);

  const { actions, mixer } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (!idleAnimation || !animations.length) return undefined;

    const clip = animations.find((a) => a.name === idleAnimation) || animations[0];
    const action = actions?.[clip.name];

    if (!action) return undefined;

    console.log(`Avatar3D: playing '${clip.name}' animation clip`);
    action.reset().fadeIn(0.3).play();

    return () => {
      action.fadeOut(0.2);
      mixer?.stopAllAction();
    };
  }, [idleAnimation, animations, actions, mixer]);

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
      drivers.forEach(({ obj, index }) => {
        if (obj.morphTargetInfluences) obj.morphTargetInfluences[index] = 0;
      });
    };
  }, [scene, modelPath]);

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

    const amp = readAmplitude(amplitudeRef.current);
    smoothAmpRef.current = THREE.MathUtils.lerp(smoothAmpRef.current, amp, 0.3);
    const level = smoothAmpRef.current;

    groupRef.current.position.y = fit.position[1] + Math.sin(t * 0.8) * 0.02;
    groupRef.current.rotation.y = Math.sin(t * 0.35) * 0.08;

    if (morphDriversRef.current.length > 0) {
      const mouth = THREE.MathUtils.clamp(level * 1.9, 0, 0.95);
      morphDriversRef.current.forEach(({ obj, index, gain }) => {
        const target = mouth * gain;
        const current = obj.morphTargetInfluences[index] || 0;
        obj.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, target, 0.45);
      });
      const s = fit.scale * (1 + level * 0.03);
      groupRef.current.scale.setScalar(s);
    } else {
      const s = fit.scale * (1 + level * 0.12);
      groupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef} position={fit.position} scale={fit.scale}>
      <primitive object={scene} />
    </group>
  );
}

function readAmplitude(slot) {
  if (!slot || !slot.audio || slot.audio.paused || slot.audio.ended) return 0;
  try {
    slot.analyser.getByteFrequencyData(slot.data);
  } catch (error) {
    // The audio context may briefly suspend during a browser/device change.
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < slot.data.length; i++) sum += slot.data[i];
  return sum / slot.data.length / 255;
}

/**
 * Keeps one AudioContext + analyser alive for the whole Avatar3D lifetime.
 * Each question gets a fresh HTMLAudioElement, but the expensive browser
 * AudioContext is reused. The old MediaElementSource is disconnected before
 * the next source is attached.
 */
function usePlaybackAudio(audioData, amplitudeRef, onPlaybackChange) {
  const contextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  // Create exactly one AudioContext/analyser for this Avatar3D mount.
  useEffect(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Audio playback: Web Audio API is unavailable');
      return undefined;
    }

    const ctx = new AudioContextClass();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);

    contextRef.current = ctx;
    analyserRef.current = analyser;

    return () => {
      amplitudeRef.current = null;

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (_) {}
        sourceRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }

      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }

      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }

      contextRef.current = null;
      analyserRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replace only the media element/source when a new question's audio arrives.
  useEffect(() => {
    const ctx = contextRef.current;
    const analyser = analyserRef.current;

    if (!ctx || !analyser) return undefined;

    // Stop and fully disconnect the previous clip without closing the context.
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (_) {}
      sourceRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }

    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    amplitudeRef.current = null;

    if (!audioData) {
      onPlaybackChange?.(false);
      return undefined;
    }

    const audio = new Audio();
    const url = URL.createObjectURL(audioData);
    let disposed = false;

    audioRef.current = audio;
    urlRef.current = url;
    audio.src = url;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    sourceRef.current = source;

    amplitudeRef.current = {
      analyser,
      audio,
      data: new Uint8Array(analyser.frequencyBinCount),
    };

    const notifyEnded = () => {
      if (!disposed) {
        amplitudeRef.current = null;
        onPlaybackChange?.(false);
      }
    };
    audio.addEventListener('ended', notifyEnded);

    const startPlayback = async () => {
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        await audio.play();
        if (!disposed) onPlaybackChange?.(true);
      } catch (err) {
        console.warn('Audio playback blocked or failed:', err);
        if (!disposed) onPlaybackChange?.(false, err);
      }
    };

    startPlayback();

    return () => {
      disposed = true;
      audio.removeEventListener('ended', notifyEnded);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      try {
        source.disconnect();
      } catch (_) {}

      if (sourceRef.current === source) sourceRef.current = null;
      if (audioRef.current === audio) audioRef.current = null;

      if (urlRef.current === url) {
        URL.revokeObjectURL(url);
        urlRef.current = null;
      }

      amplitudeRef.current = null;
      onPlaybackChange?.(false);
    };
    // onPlaybackChange is stable (useCallback in the parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioData]);
}

function ModelLoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="white" wireframe />
    </mesh>
  );
}

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
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#a78bfa" />
    </>
  );
}

function WebGLCanvas({ children, camera, fallback = false }) {
  const contextLostRef = useRef(false);

  return (
    <Canvas
      camera={camera}
      dpr={1}
      frameloop="always"
      gl={{
        antialias: false,
        alpha: true,
        preserveDrawingBuffer: false,
        powerPreference: 'default',
      }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;

        const handleContextLost = (event) => {
          event.preventDefault();
          contextLostRef.current = true;
          console.warn('Avatar3D: WebGL context lost; browser will attempt to restore it.');
        };

        const handleContextRestored = () => {
          contextLostRef.current = false;
          console.info('Avatar3D: WebGL context restored.');
          gl.setPixelRatio(1);
          gl.setSize(canvas.clientWidth, canvas.clientHeight, false);
          gl.render(gl.scene, gl.camera);
        };

        canvas.addEventListener('webglcontextlost', handleContextLost, false);
        canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

        // R3F owns the renderer lifecycle; remove listeners when this canvas
        // is disposed rather than creating another renderer ourselves.
        const originalDispose = gl.dispose.bind(gl);
        gl.dispose = () => {
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          canvas.removeEventListener('webglcontextrestored', handleContextRestored);
          originalDispose();
        };
      }}
    >
      {children}
    </Canvas>
  );
}

function Avatar3D({ audioData, avatarType = 'cara', onPlaybackChange, onModelError }) {
  const amplitudeRef = useRef(null);
  const [modelFailed, setModelFailed] = useState(false);

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
          <WebGLCanvas camera={{ position: [0, 0.4, 3], fov: 50 }}>
            <SceneLights />
            <FallbackSphere amplitudeRef={amplitudeRef} />
          </WebGLCanvas>
        }
      >
        <WebGLCanvas camera={{ position: [0, 0.55, 2.3], fov: 50 }}>
          <SceneLights />
          {modelPath ? (
            <Suspense fallback={<ModelLoadingFallback />}>
              <GLBAvatar
                modelPath={modelPath}
                idleAnimation={avatar?.idleAnimation || null}
                amplitudeRef={amplitudeRef}
              />
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
        </WebGLCanvas>
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
