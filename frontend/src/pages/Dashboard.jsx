import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useDashboardStats } from '../hooks/usePerformanceTracking';
import {
  TrendingUp,
  FileText,
  BarChart,
  LogOut,
  Play,
  Calendar,
  Award,
  Target,
  Loader
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { stats, loading, error } = useDashboardStats(user?.id);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
      navigate('/login');
    }
  };

  // Format stats for display
  const displayStats = [
    {
      icon: FileText,
      label: 'Total Sessions',
      value: loading ? '...' : stats.total_sessions || '0',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: TrendingUp,
      label: 'Avg Performance',
      value: loading ? '...' : stats.avg_performance 
        ? `${stats.avg_performance}/100`
        : 'N/A',
      color: 'from-green-500 to-emerald-500',
      subtext: stats.avg_grade && stats.avg_grade !== 'N/A' 
        ? `Grade: ${stats.avg_grade}` 
        : null
    },
    {
      icon: Target,
      label: 'Questions Answered',
      value: loading ? '...' : stats.total_questions || '0',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Award,
      label: 'Best Score',
      value: loading ? '...' : stats.best_score 
        ? `${stats.best_score}/100`
        : 'N/A',
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">
              BetterME Dashboard
            </h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-2">
            Welcome back, {user?.user_metadata?.full_name || 'User'}!
          </h2>
          <p className="text-xl text-purple-200">
            Ready to practice your interview skills?
          </p>
          
          {/* Improvement Trend */}
          {stats.improvement_trend && stats.improvement_trend !== 'N/A' && !loading && (
            <div className="mt-3 inline-block">
              <span className="px-4 py-2 bg-purple-500/30 rounded-full text-purple-100 text-sm">
                {stats.improvement_trend}
              </span>
            </div>
          )}
        </motion.div>

        {/* Quick Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <motion.button
            onClick={() => navigate('/welcome')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl p-8 flex items-center justify-between shadow-2xl hover:shadow-purple-500/50 transition-all"
          >
            <div className="text-left">
              <h3 className="text-3xl font-bold text-white mb-2">
                Start New Interview Session
              </h3>
              <p className="text-purple-100 text-lg">
                Practice with AI-powered interview questions
              </p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-white" />
            </div>
          </motion.button>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader className="w-8 h-8 text-purple-400 animate-spin" />
            <span className="ml-3 text-purple-200">Loading your stats...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4 mb-12">
            <p className="text-red-200">
              Error loading stats: {error}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        {!loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {displayStats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-purple-200">
                  {stat.label}
                </div>
                {stat.subtext && (
                  <div className="text-sm text-purple-300 mt-2">
                    {stat.subtext}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Recent Sessions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Recent Sessions
            </h3>
            {stats.total_sessions > 0 && (
              <button 
                className="text-purple-300 hover:text-white transition-colors"
                onClick={() => toast.info('Session history coming soon!')}
              >
                View All
              </button>
            )}
          </div>

          {/* Show recent sessions if available */}
          {stats.recent_sessions && stats.recent_sessions.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_sessions.map((session, index) => (
                <motion.div
                  key={session.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold mb-1">
                        {session.interview_type?.charAt(0).toUpperCase() + session.interview_type?.slice(1) || 'Interview'} Session
                      </h4>
                      <p className="text-purple-300 text-sm">
                        {new Date(session.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {session.overall_score || session.performance_score}/100
                      </div>
                      <div className="text-purple-300 text-sm">
                        Grade: {session.grade || 'N/A'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            // Empty state
            <div className="text-center py-12">
              <BarChart className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
              <p className="text-purple-200 text-lg mb-4">
                No interview sessions yet
              </p>
              <p className="text-purple-300 mb-6">
                Start your first practice session to see your progress here
              </p>
              <motion.button
                onClick={() => navigate('/welcome')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold"
              >
                Start First Session
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;