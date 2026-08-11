import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  Brain, 
  FileText, 
  Users, 
  TrendingUp, 
  ArrowRight,
  Sparkles 
} from 'lucide-react';

const Welcome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: FileText,
      title: 'Resume Analysis',
      description: 'AI analyzes your resume to create personalized interview questions'
    },
    {
      icon: Users,
      title: '3D Avatars',
      description: 'Practice with realistic AI interviewers: Cara and Kevin'
    },
    {
      icon: Brain,
      title: 'Smart Questions',
      description: 'Get relevant questions based on your experience and skills'
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      description: 'Monitor your improvement with detailed analytics'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl mb-6 shadow-2xl">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
            Welcome to BetterME
          </h1>
          
          <p className="text-2xl text-purple-200 mb-2">
            Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
          </p>
          
          <p className="text-xl text-purple-300 max-w-2xl mx-auto">
            Your AI-powered interview practice platform. Let's ace that next interview together.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-purple-200">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* How it Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 md:p-12 border border-white/20 mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-8 text-center">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Upload Resume',
                description: 'Share your resume so we can understand your background'
              },
              {
                step: '2',
                title: 'Choose Avatar',
                description: 'Select your AI interviewer and interview type'
              },
              {
                step: '3',
                title: 'Practice & Improve',
                description: 'Answer questions and get instant feedback'
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-purple-200">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <motion.button
            onClick={() => navigate('/resume')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xl font-semibold rounded-2xl shadow-2xl hover:shadow-purple-500/50 transition-all"
          >
            Get Started
            <ArrowRight className="w-6 h-6" />
          </motion.button>
          
          <p className="text-purple-300 mt-4">
            Ready to take your interview skills to the next level?
          </p>
        </motion.div>
      </div>

      <style> {`
        @keyframes blob {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default Welcome;
