import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  ArrowRight,
  Code,
  Users,
  Shuffle,
  Loader,
  Settings
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const InterviewPrep = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [interviewType, setInterviewType] = useState('mixed');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [generating, setGenerating] = useState(false);

  const interviewTypes = [
    {
      id: 'technical',
      name: 'Technical',
      icon: Code,
      description: 'Focus on technical skills, coding, and problem-solving',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'behavioral',
      name: 'Behavioral',
      icon: Users,
      description: 'STAR method questions about experiences and soft skills',
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'mixed',
      name: 'Mixed',
      icon: Shuffle,
      description: 'Combination of technical and behavioral questions',
      color: 'from-purple-500 to-pink-500'
    }
  ];

  const difficulties = [
    { id: 'easy', label: 'Easy', description: 'Fundamental concepts' },
    { id: 'medium', label: 'Medium', description: 'Intermediate level' },
    { id: 'hard', label: 'Hard', description: 'Advanced expertise' }
  ];

  const handleStartInterview = async () => {
    if(!user || !user.id) {
      toast.error('Please log in to continue');
      navigate('/login');
      return;
    }

    const selectedAvatar = sessionStorage.getItem('selectedAvatar');
    
    if (!selectedAvatar) {
      toast.error('Please select an avatar first');
      navigate('/avatar-selection');
      return;
    }
  
    setGenerating(true);
  
    try {
      // Log the request payload for debugging
      const payload = {
        user_id: user.id,
        interview_type: interviewType,
        num_questions: numQuestions,
        difficulty: difficulty
      };
      
      console.log('Sending request:', payload);
  
      const response = await axios.post(`${API_URL}/api/generate-questions`, payload);
  
      if (response.data.success) {
        sessionStorage.setItem('interviewQuestions', JSON.stringify(response.data.questions));
        sessionStorage.setItem('interviewType', interviewType);
        sessionStorage.setItem('sessionId', response.data.session_id);
        
        toast.success('Questions generated! Starting interview...');
        
        setTimeout(() => {
          navigate('/interview');
        }, 1000);
      } else {
        toast.error('Failed to generate questions');
        setGenerating(false);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      
      // Handle missing resume error specifically
      if (error.response?.status === 500 && 
        error.response?.data?.detail?.includes('No resume found')) {
      toast.error('Please upload your resume first!', {
        duration: 4000,
        icon: '📄',
      });
      // Navigate to resume upload page
      setTimeout(() => {
        navigate('/upload-resume'); // or wherever your resume upload page is
      }, 2000);
    } else {
      const errorMessage = error.response?.data?.detail 
        || error.response?.data?.message 
        || 'Failed to generate questions. Please try again.';
      
      toast.error(errorMessage);
    }

    setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Configure Your Interview
          </h1>
          <p className="text-xl text-purple-200">
            Customize your practice session to match your goals
          </p>
        </motion.div>

        {/* Interview Type Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-4">
            Interview Type
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {interviewTypes.map((type) => (
              <motion.div
                key={type.id}
                onClick={() => setInterviewType(type.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  cursor-pointer rounded-2xl p-6 border-2 transition-all
                  ${interviewType === type.id
                    ? 'border-white bg-white/20 shadow-xl'
                    : 'border-white/30 bg-white/5 hover:bg-white/10'
                  }
                  backdrop-blur-lg
                `}
              >
                <div className={`
                  w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br ${type.color}
                  flex items-center justify-center
                `}>
                  <type.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white text-center mb-2">
                  {type.name}
                </h3>
                <p className="text-sm text-purple-200 text-center">
                  {type.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Number of Questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-4">
            Number of Questions
          </h2>
          <div className="flex items-center gap-6">
            <input
              type="range"
              min="3"
              max="10"
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
              className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {numQuestions}
              </span>
            </div>
          </div>
          <p className="text-sm text-purple-200 mt-3">
            Recommended: 5-7 questions for a 15-20 minute session
          </p>
        </motion.div>

        {/* Difficulty Level */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-4">
            Difficulty Level
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {difficulties.map((level) => (
              <motion.button
                key={level.id}
                onClick={() => setDifficulty(level.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  py-4 px-6 rounded-xl font-semibold transition-all
                  ${difficulty === level.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                    : 'bg-white/5 text-purple-200 hover:bg-white/10'
                  }
                `}
              >
                <div className="text-lg mb-1">{level.label}</div>
                <div className="text-xs opacity-80">{level.description}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <motion.button
            onClick={handleStartInterview}
            disabled={generating}
            whileHover={{ scale: generating ? 1 : 1.05 }}
            whileTap={{ scale: generating ? 1 : 0.95 }}
            className={`
              inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl
              transition-all shadow-2xl
              ${generating
                ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-purple-500/50'
              }
            `}
          >
            {generating ? (
              <>
                <Loader className="w-6 h-6 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                Start Interview
                <ArrowRight className="w-6 h-6" />
              </>
            )}
          </motion.button>

          <p className="text-purple-300 mt-4">
            Your AI interviewer is ready to meet you!
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default InterviewPrep;
