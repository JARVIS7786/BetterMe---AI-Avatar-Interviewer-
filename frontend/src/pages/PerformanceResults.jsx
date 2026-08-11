import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Target,
  Award,
  CheckCircle,
  AlertCircle,
  Home,
  RotateCcw
} from 'lucide-react';

const PerformanceResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // const { performance, sessionId } = location.state || {};

  const { performance } = location.state || {};

  if (!performance) {
    navigate('/dashboard');
    return null;
  }

  const {
    overall_score,
    grade,
    completion_rate,
    response_time_avg,
    answer_quality_score,
    confidence_score,
    questions_answered,
    total_questions,
    strengths,
    areas_of_improvement
  } = performance;

  // Determine grade color
  const getGradeColor = (grade) => {
    if (grade.startsWith('A')) return 'from-green-500 to-emerald-500';
    if (grade.startsWith('B')) return 'from-blue-500 to-cyan-500';
    if (grade.startsWith('C')) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
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
          <div className={`inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br ${getGradeColor(grade)} rounded-full mb-6 shadow-2xl`}>
            <span className="text-6xl font-bold text-white">{grade}</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-4">
            Interview Complete!
          </h1>
          
          <p className="text-2xl text-purple-200">
            Overall Score: {overall_score}/100
          </p>
        </motion.div>

        {/* Performance Metrics Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Completion Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-500/30 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <p className="text-purple-300 text-sm">Completion Rate</p>
                <p className="text-3xl font-bold text-white">{completion_rate}%</p>
              </div>
            </div>
            <p className="text-sm text-purple-200">
              {questions_answered} out of {total_questions} questions answered
            </p>
          </motion.div>

          {/* Response Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-500/30 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-300" />
              </div>
              <div>
                <p className="text-purple-300 text-sm">Avg Response Time</p>
                <p className="text-3xl font-bold text-white">{response_time_avg}s</p>
              </div>
            </div>
            <p className="text-sm text-purple-200">
              Optimal range: 45-120 seconds
            </p>
          </motion.div>

          {/* Answer Quality */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <p className="text-purple-300 text-sm">Answer Quality</p>
                <p className="text-3xl font-bold text-white">{answer_quality_score}/100</p>
              </div>
            </div>
            <p className="text-sm text-purple-200">
              Based on detail, structure, and keywords
            </p>
          </motion.div>

          {/* Confidence Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-pink-500/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-pink-300" />
              </div>
              <div>
                <p className="text-purple-300 text-sm">Confidence</p>
                <p className="text-3xl font-bold text-white">{confidence_score}/100</p>
              </div>
            </div>
            <p className="text-sm text-purple-200">
              Clarity and professionalism
            </p>
          </motion.div>
        </div>

        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-green-500/10 backdrop-blur-lg rounded-2xl p-6 border border-green-400/30 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <h3 className="text-xl font-bold text-white">Your Strengths</h3>
            </div>
            <ul className="space-y-2">
              {strengths.map((strength, index) => (
                <li key={index} className="text-green-100 flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Areas for Improvement */}
        {areas_of_improvement && areas_of_improvement.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-blue-500/10 backdrop-blur-lg rounded-2xl p-6 border border-blue-400/30 mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-blue-400" />
              <h3 className="text-xl font-bold text-white">Areas to Improve</h3>
            </div>
            <ul className="space-y-2">
              {areas_of_improvement.map((area, index) => (
                <li key={index} className="text-blue-100 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">→</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.button
            onClick={() => navigate('/welcome')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-semibold shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            Practice Again
          </motion.button>

          <motion.button
            onClick={() => navigate('/dashboard')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold border border-white/30 transition-all"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </motion.button>
        </motion.div>

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-purple-300 text-lg">
            {overall_score >= 85 
              ? "🎉 Excellent work! You're interview-ready!"
              : overall_score >= 70
              ? "👍 Great job! Keep practicing to improve further."
              : "💪 Good effort! Practice makes perfect - keep going!"}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default PerformanceResults;
