import React, { Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, User, CheckCircle } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  PerspectiveCamera,
  Environment,
} from '@react-three/drei';

const AvatarModel = ({
  modelPath,
  scale = 1.8,
  position = [0, -1.5, 0],
}) => {
  const { scene } = useGLTF(modelPath);

  return (
    <primitive
      object={scene}
      scale={scale}
      position={position}
      rotation={[0, 0, 0]}
    />
  );
};

const ModelLoader = () => (
  <mesh>
    <boxGeometry args={[0.5, 0.5, 0.5]} />
    <meshStandardMaterial color="white" wireframe />
  </mesh>
);

const AvatarSelection = () => {
  const navigate = useNavigate();
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  const avatars = [
    {
      id: 'cara',
      name: 'Cara',
      gender: 'Female',
      description:
        'Professional and empathetic interviewer with a warm demeanor',
      personality: 'Friendly, encouraging, detail-oriented',
      color: 'from-pink-500 to-purple-500',
      model: '/models/cara1.glb',
      voice: 'cara',
      scale: 1.8,
      position: [0, -1.5, 0],
    },
    {
      id: 'kevin',
      name: 'Kevin',
      gender: 'Male',
      description:
        'Experienced interviewer focused on technical precision',
      personality: 'Direct, analytical, constructive',
      color: 'from-blue-500 to-cyan-500',
      model: '/models/kevin2.glb',
      voice: 'kevin',
      scale: 1.8,
      position: [0, -1.5, 0],
    },
    {
      id: 'baymax',
      name: 'Baymax',
      gender: 'AI',
      description:
        'Friendly AI interviewer designed for a calm and supportive experience',
      personality: 'Calm, supportive, patient',
      color: 'from-slate-200 to-blue-200',
      model: '/models/baymax.glb',
      voice: 'cara',
      scale: 1.8,
      position: [0, -1.5, 0],
    },
    {
      id: 'blue_demon',
      name: 'Blue Demon',
      gender: 'AI',
      description:
        'Bold fantasy avatar for a more energetic interview experience',
      personality: 'Confident, energetic, challenging',
      color: 'from-blue-700 to-indigo-900',
      model: '/models/BlueDemon.gltf',
      voice: 'kevin',
      scale: 1.35,
      position: [0, -1.4, 0],
    },
    {
      id: 'bunny',
      name: 'Bunny',
      gender: 'AI',
      description:
        'Friendly fantasy avatar with a relaxed and approachable style',
      personality: 'Friendly, relaxed, encouraging',
      color: 'from-pink-300 to-purple-300',
      model: '/models/Bunny.gltf',
      voice: 'cara',
      scale: 1.35,
      position: [0, -1.4, 0],
    },
    {
      id: 'mushroom_king',
      name: 'Mushroom King',
      gender: 'AI',
      description:
        'Creative fantasy avatar for a fun and unconventional interview',
      personality: 'Creative, playful, curious',
      color: 'from-red-500 to-yellow-500',
      model: '/models/MushroomKing.gltf',
      voice: 'cara',
      scale: 1.35,
      position: [0, -1.4, 0],
    },
    {
      id: 'yeti',
      name: 'Yeti',
      gender: 'AI',
      description:
        'Powerful fantasy avatar for a challenging interview experience',
      personality: 'Strong, direct, analytical',
      color: 'from-slate-400 to-slate-700',
      model: '/models/Yeti.gltf',
      voice: 'kevin',
      scale: 1.35,
      position: [0, -1.4, 0],
    },
  ];

  const handleSelectAvatar = (avatar) => {
    setSelectedAvatar(avatar.id);

    sessionStorage.setItem('selectedAvatar', avatar.id);
    sessionStorage.setItem('selectedAvatarModel', avatar.model);
    sessionStorage.setItem('selectedAvatarVoice', avatar.voice);

    toast.success(`${avatar.name} selected!`);
  };

  const handleNext = () => {
    if (!selectedAvatar) {
      toast.error('Please select an avatar');
      return;
    }

    navigate('/interview-prep');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-6">
      <div className="max-w-7xl mx-auto">

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {avatars.map((avatar, index) => (
            <motion.div
              key={avatar.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => handleSelectAvatar(avatar)}
              className={`
                relative cursor-pointer rounded-3xl p-6 border-2 transition-all
                ${selectedAvatar === avatar.id
                  ? 'border-white bg-white/20 shadow-2xl scale-[1.02]'
                  : 'border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50'
                }
                backdrop-blur-lg
              `}
            >
              {/* Selected badge */}
              {selectedAvatar === avatar.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-3 -right-3 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10"
                >
                  <CheckCircle className="w-7 h-7 text-white" />
                </motion.div>
              )}

              {/* 3D Preview */}
              <div
                className={`
                  w-full h-72 mx-auto mb-6 rounded-3xl
                  bg-gradient-to-br ${avatar.color}
                  overflow-hidden shadow-2xl
                `}
              >
                <Canvas shadows dpr={[1, 1.5]}>
                  <PerspectiveCamera
                    makeDefault
                    position={[2, 2, 1.8]}
                    fov={50}
                  />

                  <ambientLight intensity={1.2} />

                  <directionalLight
                    position={[3, 5, 3]}
                    intensity={2}
                  />

                  <directionalLight
                    position={[-3, 2, 2]}
                    intensity={1}
                  />

                  <Environment preset="studio" />

                  <Suspense fallback={<ModelLoader />}>
                    <AvatarModel
                      modelPath={avatar.model}
                      scale={avatar.scale}
                      position={avatar.position}
                    />
                  </Suspense>

                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    target={[0, 0.4, 0]}
                    autoRotate
                    autoRotateSpeed={1.5}
                    minPolarAngle={Math.PI / 3}
                    maxPolarAngle={Math.PI / 2.2}
                    minAzimuthAngle={-Math.PI / 4}
                    maxAzimuthAngle={Math.PI / 4}
                  />
                </Canvas>
              </div>

              {/* Avatar information */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {avatar.name}
                </h2>

                <div className="inline-block px-4 py-1 bg-white/20 rounded-full mb-4">
                  <span className="text-purple-200 text-sm font-medium">
                    {avatar.gender} Voice
                  </span>
                </div>

                <p className="text-purple-100 text-base mb-4">
                  {avatar.description}
                </p>

                <div className="bg-white/10 rounded-2xl p-4">
                  <p className="text-sm text-purple-200 mb-1">
                    <strong>Personality:</strong>
                  </p>

                  <p className="text-purple-100">
                    {avatar.personality}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8"
        >
          <div className="flex items-start gap-4">
            <User className="w-6 h-6 text-purple-300 mt-1" />

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Why Choose Your Interviewer?
              </h3>

              <p className="text-purple-200">
                Different interviewers have different styles. Choose the
                avatar that makes you feel most comfortable practicing with.
                You can switch between avatars in future sessions.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Continue */}
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
              inline-flex items-center gap-3 px-8 py-4 rounded-2xl
              font-semibold text-lg transition-all shadow-lg
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