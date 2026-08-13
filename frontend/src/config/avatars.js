// Central avatar registry - SINGLE source of truth for avatar ids,
// model paths and voice grouping.
//
// Canonical ids are snake_case and are used consistently in:
//   - sessionStorage ('selectedAvatar')
//   - backend tts_service.VOICES keys
//   - /api/text-to-speech-lipsync `speaker` field
//
// NOTE on availability:
//   cara1.glb, kevin2.glb, baymax.glb ship in this repo (self-contained GLBs,
//   verified to have no external buffer/texture dependencies).
//   The .gltf models (BlueDemon, Bunny, MushroomKing, Yeti) may reference
//   external .bin/texture files; the UI probes availability at runtime and
//   disables any avatar whose model is missing or fails to load instead of
//   silently falling back.

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
    bundled: true,
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
    bundled: true,
  },
  {
    id: 'baymax',
    name: 'Baymax',
    gender: 'Robot',
    voiceLabel: 'Robotic voice (Iapetus)',
    description: 'Calm, gentle and supportive healthcare-style companion',
    personality: 'Patient, soft-spoken, reassuring',
    color: 'from-slate-400 to-slate-600',
    model: '/models/baymax.glb',
    bundled: true,
  },
  {
    id: 'blue_demon',
    name: 'Blue Demon',
    gender: 'Male',
    voiceLabel: 'Male voice (Fenrir)',
    description: 'Intense, high-energy interviewer for pressure practice',
    personality: 'Bold, challenging, uncompromising',
    color: 'from-indigo-500 to-blue-700',
    model: '/models/BlueDemon.gltf',
    bundled: false,
  },
  {
    id: 'bunny',
    name: 'Bunny',
    gender: 'Female',
    voiceLabel: 'Female voice (Aoede)',
    description: 'Playful, light-hearted practice partner to ease nerves',
    personality: 'Cheerful, quick, supportive',
    color: 'from-rose-400 to-pink-600',
    model: '/models/Bunny.gltf',
    bundled: false,
  },
  {
    id: 'mushroom_king',
    name: 'Mushroom King',
    gender: 'Male',
    voiceLabel: 'Female voice (Leda)',
    description: 'A whimsical ruler with thoughtful, story-driven questions',
    personality: 'Curious, whimsical, wise',
    color: 'from-amber-500 to-red-600',
    model: '/models/MushroomKing.gltf',
    bundled: false,
  },
  {
    id: 'yeti',
    name: 'Yeti',
    gender: 'Male',
    voiceLabel: 'Male voice (Charon)',
    description: 'Stoic, deep-voiced interviewer for calm, steady practice',
    personality: 'Steady, deep, measured',
    color: 'from-cyan-400 to-slate-500',
    model: '/models/Yeti.gltf',
    bundled: false,
  },
];

// Deterministic default - used ONLY for validation/explicit fallback paths.
export const DEFAULT_AVATAR_ID = 'cara';

export const getAvatarById = (id) =>
  AVATARS.find((avatar) => avatar.id === id) || null;

export const isValidAvatarId = (id) => Boolean(getAvatarById(id));
