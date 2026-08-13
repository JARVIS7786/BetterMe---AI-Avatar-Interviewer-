import React, { Component, useEffect, useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, User, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, PerspectiveCamera, Environment } from '@react-three/drei';
import { AVATARS } from '../config/avatars';

// 3D Model Component
const AvatarModel = ({ modelPath }) => {
  const { scene } = useGLTF(modelPath);

  return (
    <primitive
      object={scene}
      scale={1.8}
      position={[0, -1.5, 0]}
      rotation={[0, 0, 0]}
    />
  );
};

// Loading fallback - must be Three.js compatible (no HTML inside Canvas)
const ModelLoader = () => (
  <mesh>
    <boxGeometry args={[0.5, 0.5, 0.5]} />
    <meshStandardMaterial color="white" wireframe />
  </mesh>
);

// Catches GLTF load/render failures (e.g. .gltf referencing a missing
// external .bin/texture) so one bad model never breaks the whole grid.
class PreviewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`Avatar preview failed for ${this.props.avatarId}:`, error);
    this.props.onError?.(this.props.avatarId);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="w-full h-full flex items-center justify-center text-white/70 text-sm px-6 text-center">
          3D preview unavailable
        </div>
      );
    }
    return this.props.children;
  }
}

const AvatarSelection = () => {
  const navigate = useNavigate();
  const [selectedAvatar, setSelectedAvatar] = useState(
    // Restore a previously made choice so the flow is consistent
    // when navigating back from InterviewPrep.
    () => sessionStorage.getItem('selectedAvatar')
  );
  // id -> 'checking' | 'available' | 'unavailable'
  const [availability, setAvailability] = useState({});

  // Probe every model file once on mount: no invented/invalid paths and no
  // silent fallbacks - unavailable models are explicitly disabled in the UI.
  useEffect(() => {
    let cancelled = false;

    AVATARS.forEach((avatar) => {
      fetch(avatar.model, { method: 'HEAD' })
        .then((response) => {
          if (cancelled) return;
          setAvailability((prev) => ({
            ...prev,
            [avatar.id]: response.ok ? 'available' : 'unavailable',
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setAvailability((prev) => ({ ...prev, [avatar.id]: 'unavailable' }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const markUnavailable = (avatarId) => {
    setAvailability((prev) => ({ ...prev, [avatarId]: 'unavailable' }));
    setSelectedAvatar((prev) => (prev === avatarId ? null : prev));
  };

  const handleSelectAvatar = (avatar) => {
    if (availability[avatar.id] === 'unavailable') {
      toast.error(`${avatar.name}'s 3D model is not available yet`);
      return;
    }
    setSelectedAvatar(avatar.id);
    toast.success(`${avatar.name} selected!`);
  };

  const handleNext = () => {
    if (!selectedAvatar) {
      toast.error('Please select an avatar');
      return;
    }

    if (availability[selectedAvatar] === 'unavailable') {
      toast.error('That avatar model is unavailable - please choose another');
      return;
    }

    // Canonical snake_case ids, matching backend TTS voice mapping.
    sessionStorage.setItem('selectedAvatar', selectedAvatar);
    navigate('/interview-prep');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your AI Interviewer
          </h1>
          <p className="text-xl text-purple-200">
            Select the avatar you're most comfortable practicing with
          </p>
        </motion.div>

        {/* Avatar Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {AVATARS.map((avatar, index) => {
            const status = availability[avatar.id] || 'checking';
            const isUnavailable = status === 'unavailable';
            const isSelected = selectedAvatar === avatar.id;

            return (
              <motion.div
                key={avatar.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => handleSelectAvatar(avatar)}
                className={`
                  relative cursor-pointer rounded-3xl p-6 border-2 transition-all
                  ${isSelected
                    ? 'border-white bg-white/20 shadow-2xl scale-105'
                    : 'border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50'
                  }
                  ${isUnavailable ? 'opacity-50 cursor-not-allowed' : ''}
                  backdrop-blur-lg
                `}
              >
                {/* Selection Badge */}
                {isSelected && !isUnavailable && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-3 -right-3 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10"
                  >
                    <CheckCircle className="w-7 h-7 text-white" />
                  </motion.div>
                )}

                {/* Unavailable Badge - explicit, never a silent fallback */}
                {isUnavailable && (
                  <div className="absolute top-3 right-3 px-3 py-1 bg-amber-500/80 rounded-full flex items-center gap-1 z-10">
                    <AlertTriangle className="w-3 h-3 text-white" />
                    <span className="text-white text-xs font-medium">Model unavailable</span>
                  </div>
                )}
                {status === 'checking' && (
                  <div className="absolute top-3 right-3 px-3 py-1 bg-white/20 rounded-full flex items-center gap-1 z-10">
                    <Loader className="w-3 h-3 text-white animate-spin" />
                  </div>
                )}

                {/* 3D Avatar Preview */}
                <div className={`
                  w-56 h-56 mx-auto mb-6 rounded-3xl bg-gradient-to-br ${avatar.color}
                  overflow-hidden shadow-2xl
                `}>
                  {isUnavailable ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/80 gap-2 px-6 text-center">
                      <AlertTriangle className="w-8 h-8" />
                      <p className="text-sm">
                        Model file missing or not self-contained
                      </p>
                    </div>
                  ) : (
                    <PreviewErrorBoundary avatarId={avatar.id} onError={markUnavailable}>
                      <Canvas shadows>
                        <PerspectiveCamera makeDefault position={[2, 2, 1.8]} fov={50} />
                        <ambientLight intensity={0.1} />
                        <Environment preset="studio" />
                        <Suspense fallback={<ModelLoader />}>
                          <AvatarModel modelPath={avatar.model} />
                        </Suspense>
                        <OrbitControls
                          enableZoom={false}
                          enablePan={false}
                          target={[0, 0.5, 0]}
                          autoRotate
                          autoRotateSpeed={1.5}
                          minPolarAngle={Math.PI / 3}
                          maxPolarAngle={Math.PI / 2.2}
                          minAzimuthAngle={-Math.PI / 4}
                          maxAzimuthAngle={Math.PI / 4}
                        />
                      </Canvas>
                    </PreviewErrorBoundary>
                  )}
                </div>

                {/* Avatar Info */}
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {avatar.name}
                  </h2>

                  <div className="inline-block px-4 py-1 bg-white/20 rounded-full mb-4">
                    <span className="text-purple-200 text-sm font-medium">
                      {avatar.voiceLabel}
                    </span>
                  </div>

                  <p className="text-purple-100 mb-4">
                    {avatar.description}
                  </p>

                  <div className="bg-white/10 rounded-2xl p-3">
                    <p className="text-sm text-purple-200 mb-1">
                      <strong>Personality:</strong>
                    </p>
                    <p className="text-sm text-purple-100">
                      {avatar.personality}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8"
        >
          <div className="flex items-start gap-4">
            <User className="w-6 h-6 text-purple-300 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Why Choose Your Interviewer?
              </h3>
              <p className="text-purple-200">
                Different interviewers have different styles. Choose the one that makes you feel
                most comfortable and matches your practice goals. You can always switch between
                avatars in future sessions.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Next Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <motion.button
            onClick={handleNext}
            disabled={!selectedAvatar}
            whileHover={{ scale: selectedAvatar ? 1.05 : 1 }}
            whileTap={{ scale: selectedAvatar ? 0.95 : 1 }}
            className={`
              inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg
              transition-all shadow-lg
              ${selectedAvatar
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-purple-500/50'
                : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
              }
            `}
          >
            Continue to Interview Setup
            <ArrowRight className="w-6 h-6" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default AvatarSelection;
