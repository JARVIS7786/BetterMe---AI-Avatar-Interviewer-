import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from 'axios';
import Avatar3D from '../components/Avatar3D';
import usePerformanceTracking from '../hooks/usePerformanceTracking';
import { useAuth } from '../context/AuthContext';
import {
  Mic,
  MicOff,
  SkipForward,
  CheckCircle,
  Loader,
  Volume2,
  // VolumeX,
  Home
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const InterviewRoom = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State - MUST be declared BEFORE using in hooks
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [audioMuted, setAudioMuted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [avatarType, setAvatarType] = useState('cara');
  const [showTranscript, setShowTranscript] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [interviewType, setInterviewType] = useState('mixed');
  const [sessionId, setSessionId] = useState('');

  // Performance tracking - NOW sessionId and user are defined
  const {
    recordAnswer,
    submitSession
    // sessionData,
    // answers
  } = usePerformanceTracking(sessionId, user?.id);
  
  // New states for lip-sync
  const [audioData, setAudioData] = useState(null);
  const [visemeTimeline, setVisemeTimeline] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Load interview data
  useEffect(() => {
    const storedQuestions = sessionStorage.getItem('interviewQuestions');
    const storedAvatar = sessionStorage.getItem('selectedAvatar');
    const storedType = sessionStorage.getItem('interviewType');
    const storedSessionId = sessionStorage.getItem('sessionId');
    
    if (!storedQuestions || !storedAvatar) {
      toast.error('No interview session found');
      navigate('/welcome');
      return;
    }
    
    setQuestions(JSON.parse(storedQuestions));
    setAvatarType(storedAvatar);
    setInterviewType(storedType || 'mixed');
    setSessionId(storedSessionId || `session_${Date.now()}`);
    setLoading(false);
  }, [navigate]);

  // Helper function to convert base64 to blob
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Play question audio with lip-sync
  const playQuestionAudio = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    
    if (!currentQuestion) return;

    try {
      setSpeaking(true);
      const textToSpeak = currentQuestion.question.slice(0, 500); // Cap at 500 chars

      console.log('Fetching TTS with lip-sync data...');

      // Try to use lip-sync endpoint first
      try {
        const response = await axios.post(
          `${API_URL}/api/text-to-speech-lipsync`,
          {
            text: textToSpeak,
            speaker: avatarType
          }
        );

        if (response.data.success) {
          // Convert base64 to blob
          const audioBlob = base64ToBlob(response.data.audio_base64, 'audio/wav');
          
          // Set audio data and viseme timeline for Avatar3D
          setAudioData(audioBlob);
          setVisemeTimeline(response.data.viseme_data);
          
          console.log('Loaded audio with', response.data.viseme_data.length, 'visemes');
          console.log('Duration:', response.data.duration, 'seconds');
          
          return;
        }
      } catch (lipSyncError) {
        console.warn('Lip-sync endpoint failed, falling back to regular TTS:', lipSyncError);
        
        // Fallback to regular TTS without lip-sync
        const response = await axios.post(
          `${API_URL}/api/text-to-speech`,
          {
            text: textToSpeak,
            speaker: avatarType
          },
          {
            responseType: 'blob'
          }
        );

        // Set audio data without viseme timeline (will use frequency analysis)
        setAudioData(response.data);
        setVisemeTimeline(null);
        
        console.log('Using fallback frequency-based lip-sync');
      }

    } catch (error) {
      console.error('Error generating speech:', error);
      toast.error('Failed to generate speech');
      setSpeaking(false);
      setAudioData(null);
      setVisemeTimeline(null);
    }
  };

  // Play question audio when question changes
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      // Clear previous audio
      setAudioData(null);
      setVisemeTimeline(null);
      
      playQuestionAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, questions, avatarType]);

  // Monitor when audio finishes playing
  useEffect(() => {
    if (!audioData) {
      setSpeaking(false);
    }
  }, [setSpeaking,audioData]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        // Here you could send the audio to backend for transcription/analysis
        console.log('Recording stopped, blob size:', audioBlob.size);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Recording stopped');
    }
  };

  const handleNextQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex];
    
    // Record the answer with performance tracking
    recordAnswer(
      currentQuestion.id || `q_${currentQuestionIndex}`,
      currentQuestion.question,
      userAnswer
    );

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserAnswer('');
      setShowTranscript(false);
      
      if (recording) {
        stopRecording();
      }
    } else {
      handleEndInterview();
    }
  };

  const handleEndInterview = async () => {
    try {
      // Submit final answer
      const currentQuestion = questions[currentQuestionIndex];
      recordAnswer(
        currentQuestion.id || `q_${currentQuestionIndex}`,
        currentQuestion.question,
        userAnswer
      );

      // Stop recording if active
      if (recording) {
        stopRecording();
      }

      // Submit session for performance calculation
      toast.loading('Calculating your performance...');
      
      const result = await submitSession(
        questions,
        interviewType,
        avatarType
      );

      toast.dismiss();
      toast.success('Interview completed! Great job!');
      
      // Clean up audio
      setAudioData(null);
      setVisemeTimeline(null);

      // Navigate to performance results
      setTimeout(() => {
        navigate('/performance-results', { 
          state: { 
            performance: result.performance,
            sessionId: result.session_id
          } 
        });
      }, 1500);
    } catch (error) {
      toast.error('Error calculating performance');
      console.error(error);
      
      // Clean up and navigate to dashboard
      setAudioData(null);
      setVisemeTimeline(null);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    }
  };

  const handleReplayQuestion = () => {
    playQuestionAudio();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header with progress */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Home className="w-5 h-5 text-white" />
              </button>
              <span className="text-white font-semibold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Replay button */}
              <button
                onClick={handleReplayQuestion}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Replay question"
              >
                <Volume2 className="w-5 h-5 text-white" />
              </button>
              
              {/* Mute indicator (optional, for UI only) */}
              {audioMuted && (
                <div className="px-3 py-1 bg-red-500/20 rounded-lg">
                  <span className="text-red-300 text-sm">Muted</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Avatar Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-lg rounded-3xl border border-white/20 p-6"
          >
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">
                {avatarType === 'cara' ? 'Cara' : 'Kevin'}
              </h2>
              <div className="inline-block px-4 py-1 bg-purple-500/30 rounded-full">
                <span className="text-purple-100 text-sm flex items-center gap-2">
                  {audioData ? (
                    <>
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Speaking...
                    </>
                  ) : (
                    'Listening'
                  )}
                </span>
              </div>
              
              {/* Lip-sync mode indicator */}
              {visemeTimeline && (
                <div className="mt-2 text-xs text-purple-300">
                  Timeline Lip-Sync ({visemeTimeline.length} visemes)
                </div>
              )}
              {audioData && !visemeTimeline && (
                <div className="mt-2 text-xs text-purple-300">
                  Frequency-based Lip-Sync
                </div>
              )}
            </div>

            <div className="aspect-square bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl overflow-hidden">
              <Avatar3D 
                avatarType={avatarType} 
                audioData={audioData}
                visemeTimeline={visemeTimeline}
              />
            </div>
          </motion.div>

          {/* Question & Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Current Question */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {currentQuestionIndex + 1}
                  </span>
                </div>
                <div>
                  <span className="text-purple-300 text-sm font-medium">
                    {currentQuestion.type?.toUpperCase() || 'QUESTION'} • {currentQuestion.difficulty?.toUpperCase() || 'MEDIUM'}
                  </span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-2xl text-white mb-6 leading-relaxed">
                    {currentQuestion.question}
                  </p>

                  {currentQuestion.expected_answer_hints && (
                    <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
                      <p className="text-sm text-blue-200">
                        <strong>Hint:</strong> {currentQuestion.expected_answer_hints}
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Recording Controls */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6">
              <div className="flex items-center justify-center gap-4">
                <motion.button
                  onClick={recording ? stopRecording : startRecording}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    w-20 h-20 rounded-full flex items-center justify-center
                    transition-all shadow-lg
                    ${recording
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-purple-500/50'
                    }
                  `}
                >
                  {recording ? (
                    <MicOff className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-white" />
                  )}
                </motion.button>

                <motion.button
                  onClick={handleNextQuestion}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-all flex items-center gap-2"
                >
                  {currentQuestionIndex === questions.length - 1 ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Finish
                    </>
                  ) : (
                    <>
                      <SkipForward className="w-5 h-5" />
                      Next
                    </>
                  )}
                </motion.button>
              </div>

              <p className="text-center text-purple-200 mt-4 text-sm">
                {recording
                  ? 'Recording your answer... Click again to stop'
                  : 'Click the microphone to start recording your answer'
                }
              </p>
            </div>

            {/* Answer Notes */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Your Answer Notes
              </h3>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer or key points here..."
                className="w-full h-32 bg-white/5 border border-white/20 rounded-xl p-4 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <p className="text-xs text-purple-300 mt-2">
                💡 Tip: Type your answer here for better performance tracking
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;