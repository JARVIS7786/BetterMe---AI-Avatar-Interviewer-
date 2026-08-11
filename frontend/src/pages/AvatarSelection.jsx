import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, User, CheckCircle } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, PerspectiveCamera, Environment } from '@react-three/drei';

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

const AvatarSelection = () => {
  const navigate = useNavigate();
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  const avatars = [
    {
      id: 'cara',
      name: 'Cara',
      gender: 'Female',
      description: 'Professional and empathetic interviewer with a warm demeanor',
      personality: 'Friendly, encouraging, detail-oriented',
      color: 'from-pink-500 to-purple-500',
      model: '/models/cara1.glb'
    },
    {
      id: 'kevin',
      name: 'Kevin',
      gender: 'Male',
      description: 'Experienced interviewer focused on technical precision',
      personality: 'Direct, analytical, constructive',
      color: 'from-blue-500 to-cyan-500',
      model: '/models/kevin2.glb'
    }
  ];

  const handleSelectAvatar = (avatarId) => {
    setSelectedAvatar(avatarId);
    toast.success(`${avatarId === 'cara' ? 'Cara' : 'Kevin'} selected!`);
  };

  const handleNext = () => {
    if (!selectedAvatar) {
      toast.error('Please select an avatar');
      return;
    }
    
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
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {avatars.map((avatar, index) => (
            <motion.div
              key={avatar.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => handleSelectAvatar(avatar.id)}
              className={`
                relative cursor-pointer rounded-3xl p-8 border-2 transition-all
                ${selectedAvatar === avatar.id
                  ? 'border-white bg-white/20 shadow-2xl scale-105'
                  : 'border-white/30 bg-white/5 hover:bg-white/10 hover:border-white/50'
                }
                backdrop-blur-lg
              `}
            >
              {/* Selection Badge */}
              {selectedAvatar === avatar.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-3 -right-3 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <CheckCircle className="w-7 h-7 text-white" />
                </motion.div>
              )}

              {/* 3D Avatar Preview */}
              <div className={`
                w-64 h-64 mx-auto mb-6 rounded-3xl bg-gradient-to-br ${avatar.color}
                overflow-hidden shadow-2xl
              `}>
                <Canvas shadows>
                  {/* Camera positioned to see the face */}
                  <PerspectiveCamera 
                    makeDefault 
                    position={[2, 2, 1.8]} 
                    fov={50}
                  />
                  
                  {/* Multiple light sources for better face illumination */}
                  <ambientLight intensity={0.1} />
                  
                  {/* Key light (front-top) */}
                  {/* <directionalLight 
                    position={[0, 0, 3]} 
                    intensity={0.5}
                    castShadow
                  /> */}
                  
                  {/* Fill light (front-left) */}
                  {/* <directionalLight 
                    position={[-2, 1, 2]} 
                    intensity={0.5}
                  />
                  
                  {/* Rim light (back) */}
                  {/* <directionalLight 
                    position={[0, 1, -2]} 
                    intensity={0.5}
                  /> */} 
                  
                  {/* Soft overhead light
                  <pointLight 
                    position={[0, 3, 0]} 
                    intensity={0.5}
                  /> */}
                  
                  {/* Environment for realistic reflections */}
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
              </div>

              {/* Avatar Info */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {avatar.name}
                </h2>
                
                <div className="inline-block px-4 py-1 bg-white/20 rounded-full mb-4">
                  <span className="text-purple-200 text-sm font-medium">
                    {avatar.gender} Voice
                  </span>
                </div>

                <p className="text-purple-100 text-lg mb-4">
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