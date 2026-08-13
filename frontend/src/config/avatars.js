// Central avatar registry - SINGLE source of truth for avatar ids,
// model paths and voice grouping.
//
// Canonical ids are snake_case and are used consistently in:
//   - sessionStorage ('selectedAvatar')  <- the ONLY avatar key stored
//   - backend tts_service.VOICES keys
//   - /api/text-to-speech-lipsync `speaker` field
//
// Model verification (inspected, not assumed):
//   - All 7 files exist under frontend/public/models/ and are fully
//     self-contained (no external .bin/texture references).
//   - cara1.glb / kevin2.glb: skinned, with mouthOpen + Oculus viseme_*
//     morph targets (driven by audio amplitude in Avatar3D).
//   - baymax.glb: static mesh, no morphs/animations (scale-pulse fallback).
//   - BlueDemon/Bunny/MushroomKing/Yeti (.gltf): skinned, with animation
//     clips including 'Idle' (played in the InterviewRoom via useAnimations).

export const AVATARS = [
  {
    id: 'cara',
    name: 'Cara',
    gender: 'Female',
    voiceLabel: 'Female voice (Kore)',
    description: 'Professional and empathetic interviewer with a warm demeanor',
    personality: 'Friendly, encouraging, detail-oriented',
    color: 'from-pink-500 to-purple-500',
    model: '/models/cara1.glb',
    format: 'glb',
    hasMorphTargets: true,
    bundled: true,
    previewScale: 1.8,
    previewPosition: [0, -1.5, 0],
  },
  {
    id: 'kevin',
    name: 'Kevin',
    gender: 'Male',
    voiceLabel: 'Male voice (Puck)',
    description: 'Experienced interviewer focused on technical precision',
    personality: 'Direct, analytical, constructive',
    color: 'from-blue-500 to-cyan-500',
    model: '/models/kevin2.glb',
    format: 'glb',
    hasMorphTargets: true,
    bundled: true,
    previewScale: 1.8,
    previewPosition: [0, -1.5, 0],
  },
  {
    id: 'baymax',
    name: 'Baymax',
    gender: 'AI',
    voiceLabel: 'Robotic voice (Iapetus)',
    description: 'Friendly AI interviewer designed for a calm and supportive experience',
    personality: 'Calm, supportive, patient',
    color: 'from-slate-200 to-blue-200',
    model: '/models/baymax.glb',
    format: 'glb',
    hasMorphTargets: false,
    bundled: true,
    previewScale: 1.8,
    previewPosition: [0, -1.5, 0],
  },
  {
    id: 'blue_demon',
    name: 'Blue Demon',
    gender: 'AI',
    voiceLabel: 'Male voice (Fenrir)',
    description: 'Bold fantasy avatar for a more energetic interview experience',
    personality: 'Confident, energetic, challenging',
    color: 'from-blue-700 to-indigo-900',
    model: '/models/BlueDemon.gltf',
    format: 'gltf',
    hasMorphTargets: false,
    idleAnimation: 'Idle',
    bundled: true,
    previewScale: 1.35,
    previewPosition: [0, -1.4, 0],
  },
  {
    id: 'bunny',
    name: 'Bunny',
    gender: 'AI',
    voiceLabel: 'Female voice (Aoede)',
    description: 'Friendly fantasy avatar with a relaxed and approachable style',
    personality: 'Friendly, relaxed, encouraging',
    color: 'from-pink-300 to-purple-300',
    model: '/models/Bunny.gltf',
    format: 'gltf',
    hasMorphTargets: false,
    idleAnimation: 'Idle',
    bundled: true,
    previewScale: 1.35,
    previewPosition: [0, -1.4, 0],
  },
  {
    id: 'mushroom_king',
    name: 'Mushroom King',
    gender: 'AI',
    voiceLabel: 'Female voice (Leda)',
    description: 'Creative fantasy avatar for a fun and unconventional interview',
    personality: 'Creative, playful, curious',
    color: 'from-red-500 to-yellow-500',
    model: '/models/MushroomKing.gltf',
    format: 'gltf',
    hasMorphTargets: false,
    idleAnimation: 'Idle',
    bundled: true,
    previewScale: 1.35,
    previewPosition: [0, -1.4, 0],
  },
  {
    id: 'yeti',
    name: 'Yeti',
    gender: 'AI',
    voiceLabel: 'Male voice (Charon)',
    description: 'Powerful fantasy avatar for a challenging interview experience',
    personality: 'Strong, direct, analytical',
    color: 'from-slate-400 to-slate-700',
    model: '/models/Yeti.gltf',
    format: 'gltf',
    hasMorphTargets: false,
    idleAnimation: 'Idle',
    bundled: true,
    previewScale: 1.35,
    previewPosition: [0, -1.4, 0],
  },
];

// Deterministic default - used ONLY for validation/explicit fallback paths.
export const DEFAULT_AVATAR_ID = 'cara';

export const getAvatarById = (id) =>
  AVATARS.find((avatar) => avatar.id === id) || null;

export const isValidAvatarId = (id) => Boolean(getAvatarById(id));
