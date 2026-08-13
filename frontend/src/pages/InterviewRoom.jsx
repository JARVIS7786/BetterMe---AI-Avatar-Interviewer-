import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from 'axios';
import Avatar3D from '../components/Avatar3D';
import usePerformanceTracking from '../hooks/usePerformanceTracking';
import { useAuth } from '../context/AuthContext';
import { getAvatarById, isValidAvatarId } from '../config/avatars';
import {
  Mic,
  MicOff,
  SkipForward,
  CheckCircle,
  Loader,
  Volume2,
  Home
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const TTS_TIMEOUT_MS = 90000;
const TRANSCRIBE_TIMEOUT_MS = 90000;
const MIN_AUDIO_BYTES = 1024; // below this a recording is effectively empty

const base64ToBlob = (base64, mimeType) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

const pickRecorderMimeType = () => {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
};

const extensionForMime = (mimeType) => {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'wav';
};

const InterviewRoom = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---- Core interview state --------------------------------------------
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [interviewType, setInterviewType] = useState('mixed');
  const [sessionId, setSessionId] = useState('');
  const [avatarType, setAvatarType] = useState('cara');
  const [loading, setLoading] = useState(true);

  // ---- Audio / TTS state -------------------------------------------------
  const [audioData, setAudioData] = useState(null);
  const [visemeTimeline, setVisemeTimeline] = useState(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // ---- Recording / transcription state ----------------------------------
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // ---- Submission state ---------------------------------------------------
  const [submitting, setSubmitting] = useState(false);

  // ---- Refs (guards that must not trigger re-renders) --------------------
  const ttsSeqRef = useRef(0);            // bump on every new load; stale responses check it
  const inFlightTtsRef = useRef(new Map()); // text+speaker -> Promise (StrictMode/double-effect dedupe)
  const questionIndexRef = useRef(0);      // for dropping transcripts landed on the wrong question
  const hasSubmittedRef = useRef(false);   // exactly-once session submission guard
  const autoplayWarnedRef = useRef(-1);    // per-question "tap replay" hint
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Performance tracking hook (recordAnswer / submitSession)
  const { recordAnswer, submitSession } = usePerformanceTracking(sessionId, user?.id);

  // ---- Load interview session (single source: sessionStorage) ------------
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

    if (!isValidAvatarId(storedAvatar)) {
      console.error(`Unknown avatar id in sessionStorage: '${storedAvatar}'`);
      toast.error('Please select your interviewer again');
      navigate('/avatar-selection');
      return;
    }

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(storedQuestions);
    } catch {
      toast.error('Corrupted interview data - please start again');
      navigate('/welcome');
      return;
    }

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      toast.error('No interview questions found');
      navigate('/welcome');
      return;
    }

    setQuestions(parsedQuestions);
    setAvatarType(storedAvatar);
    setInterviewType(storedType || 'mixed');
    setSessionId(storedSessionId || `session_${Date.now()}`);
    setLoading(false);
  }, [navigate]);

  // Keep questionIndexRef in sync (used to reject stale transcripts).
  useEffect(() => {
    questionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  // ---- TTS: exactly one request per question, no stale application -------
  /**
   * De-duplicated TTS fetch. If an identical request (same speaker + text)
   * is already in flight (StrictMode double-effect, fast clicking), the
   * in-flight promise is reused instead of hitting the Gemini API again.
   */
  const requestQuestionAudio = useCallback((text, speaker) => {
    const key = `${speaker}::${text}`;
    const existing = inFlightTtsRef.current.get(key);
    if (existing) {
      console.log('TTS: identical request already in flight - reusing it (no extra Gemini call)');
      return existing;
    }

    console.log(`TTS: requesting audio (speaker=${speaker}, chars=${text.length})`);
    const promise = axios
      .post(
        `${API_URL}/api/text-to-speech-lipsync`,
        { text, speaker },
        { timeout: TTS_TIMEOUT_MS }
      )
      .then((response) => {
        const data = response.data;
        if (!data || data.success !== true || !data.audio_base64) {
          throw new Error('Malformed TTS response from server');
        }
        return {
          blob: base64ToBlob(data.audio_base64, 'audio/wav'),
          // Gemini returns no visemes; this stays null and the avatar
          // uses frequency-based animation. Kept for contract clarity.
          visemeData: data.viseme_data || null,
          duration: data.duration || null,
        };
      })
      .finally(() => {
        inFlightTtsRef.current.delete(key);
      });

    inFlightTtsRef.current.set(key, promise);
    return promise;
  }, []);

  /**
   * Loads audio for a question and applies it only if it is still current.
   * Returns the request id used (for logging/debug).
   */
  const loadQuestionAudio = useCallback(
    (question) => {
      if (!question) return;

      // Invalidate any previous in-flight load + stop current playback.
      const requestId = ++ttsSeqRef.current;
      setAudioData(null);
      setVisemeTimeline(null);
      setTtsLoading(true);

      const textToSpeak = question.question.slice(0, 500); // cap TTS payload

      requestQuestionAudio(textToSpeak, avatarType)
        .then((result) => {
          if (requestId !== ttsSeqRef.current) {
            console.warn('TTS: stale response discarded (question already changed)');
            return;
          }
          setAudioData(result.blob);
          setVisemeTimeline(result.visemeData);
          setTtsLoading(false);
          console.log(`TTS: audio ready (${(result.blob.size / 1024).toFixed(1)} KB, ~${(result.duration || 0).toFixed(1)}s)`);
        })
        .catch((error) => {
          if (requestId !== ttsSeqRef.current) return;
          console.error('TTS: failed to generate speech:', error);
          setTtsLoading(false);
          toast.error('Failed to generate speech - use Replay to try again');
        });
    },
    [avatarType, requestQuestionAudio]
  );

  // Auto-play EXACTLY ONCE per question change.
  // (StrictMode's double effect is neutralized by inFlightTtsRef dedupe +
  //  the ttsSeqRef staleness guard.)
  useEffect(() => {
    if (questions.length === 0) return;
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;
    loadQuestionAudio(currentQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, questions, avatarType]);

  // Avatar3D reports actual playback state (play started/ended/failed).
  const handlePlaybackChange = useCallback(
    (playing, error) => {
      setSpeaking(playing);
      if (
        error &&
        (error.name === 'NotAllowedError' || error.name === 'AbortError') &&
        autoplayWarnedRef.current !== currentQuestionIndex
      ) {
        autoplayWarnedRef.current = currentQuestionIndex;
        toast('Tap the speaker button to hear the question', { icon: '🔊' });
      }
    },
    [currentQuestionIndex]
  );

  // Replay: ONE intentional new TTS request (reuses the in-flight one
  // if the question audio is still being generated).
  const handleReplayQuestion = useCallback(() => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || ttsLoading) return;
    loadQuestionAudio(currentQuestion);
  }, [questions, currentQuestionIndex, ttsLoading, loadQuestionAudio]);

  // ---- Recording -> /api/transcribe (Groq Whisper) -> answer ------------
  const transcribeBlob = useCallback(
    async (audioBlob, mimeType, questionIndex) => {
      if (audioBlob.size < MIN_AUDIO_BYTES) {
        toast.error('Recording too short - please try again');
        return;
      }

      const formData = new FormData();
      formData.append(
        'file',
        audioBlob,
        `answer.${extensionForMime(mimeType)}`
      );

      setTranscribing(true);
      try {
        console.log(`STT: uploading ${audioBlob.size} bytes for transcription`);
        const response = await axios.post(`${API_URL}/api/transcribe`, formData, {
          timeout: TRANSCRIBE_TIMEOUT_MS,
        });

        const { success, transcript, message } = response.data || {};

        if (!success || !transcript) {
          toast.error(message || 'Could not understand the audio - please try again');
          return;
        }

        if (questionIndexRef.current !== questionIndex) {
          // The user already moved on; applying it now would corrupt the
          // next question's answer. Log, don't silently mis-file it.
          console.warn('STT: transcript arrived after moving to next question - discarded');
          return;
        }

        // Preserve any typed notes: append instead of overwriting.
        setUserAnswer((prev) => {
          const trimmed = (prev || '').trim();
          return trimmed ? `${trimmed}\n${transcript}` : transcript;
        });
        toast.success('Transcript added to your answer');
      } catch (error) {
        console.error('STT: transcription failed:', error);
        if (error.code === 'ECONNABORTED') {
          toast.error('Transcription timed out - check your connection and retry');
        } else {
          toast.error(error.response?.data?.detail || 'Transcription failed');
        }
      } finally {
        setTranscribing(false);
      }
    },
    []
  );

  const startRecording = useCallback(async () => {
    if (recording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      const questionIndexAtStart = questionIndexRef.current;
      const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMime });
        audioChunksRef.current = [];
        console.log(`Recording stopped: ${audioBlob.size} bytes (${effectiveMime})`);
        transcribeBlob(audioBlob, effectiveMime, questionIndexAtStart);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Microphone access failed:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Microphone permission denied - enable it in your browser settings');
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found on this device');
      } else {
        toast.error('Could not access microphone');
      }
    }
  }, [recording, transcribeBlob]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // onstop handler performs the transcription upload
    }
    setRecording(false);
  }, []);

  // ---- Answers: exactly ONE record per question --------------------------
  /**
   * "Next" / "Finish" button. This is the ONLY place an answer is recorded.
   * On the final question it records the answer and then submits - the
   * submission path never records a second one.
   */
  const handleNextQuestion = useCallback(() => {
    if (submitting || hasSubmittedRef.current) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    recordAnswer(
      currentQuestion.id || `q_${currentQuestionIndex}`,
      currentQuestion.question,
      userAnswer
    );

    if (recording) {
      stopRecording();
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setUserAnswer('');
    } else {
      // Final question: answer is already recorded above; submit now.
      finishInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    submitting,
    questions,
    currentQuestionIndex,
    userAnswer,
    recording,
    recordAnswer,
    stopRecording,
  ]);

  // ---- Exactly-once final submission -------------------------------------
  const finishInterview = useCallback(async () => {
    if (hasSubmittedRef.current) {
      console.warn('Submission blocked: interview already submitted');
      return;
    }
    hasSubmittedRef.current = true;
    setSubmitting(true);

    const toastId = toast.loading('Calculating your performance...');

    try {
      // Stop question audio immediately and invalidate any in-flight TTS
      // response so it can never land on the results screen.
      ttsSeqRef.current += 1;
      setAudioData(null);
      setVisemeTimeline(null);

      const result = await submitSession(questions, interviewType, avatarType);

      toast.dismiss(toastId);
      toast.success('Interview completed! Great job!');

      // Navigate ONLY after the valid result has been received.
      navigate('/performance-results', {
        state: {
          performance: result.performance,
          sessionId: result.session_id,
        },
      });
    } catch (error) {
      console.error('Error submitting session:', error);
      toast.dismiss(toastId);
      toast.error('Error calculating performance - please try again');
      // Allow the user to retry a genuinely failed submission.
      hasSubmittedRef.current = false;
      setSubmitting(false);
    }
  }, [submitSession, questions, interviewType, avatarType, navigate]);

  // ---- Render -------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const avatarName = getAvatarById(avatarType)?.name || avatarType;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

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
              {/* Replay button - one intentional TTS request per click */}
              <button
                onClick={handleReplayQuestion}
                disabled={ttsLoading || submitting}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Replay question"
              >
                <Volume2 className="w-5 h-5 text-white" />
              </button>
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
                {avatarName}
              </h2>
              <div className="inline-block px-4 py-1 bg-purple-500/30 rounded-full">
                <span className="text-purple-100 text-sm flex items-center gap-2">
                  {speaking ? (
                    <>
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Speaking...
                    </>
                  ) : ttsLoading ? (
                    <>
                      <Loader className="w-3 h-3 animate-spin" />
                      Preparing voice...
                    </>
                  ) : (
                    'Listening'
                  )}
                </span>
              </div>

              {/* Honest lip-sync mode indicator */}
              {audioData && !visemeTimeline && (
                <div className="mt-2 text-xs text-purple-300">
                  Frequency-based animation (audio-reactive)
                </div>
              )}
              {audioData && visemeTimeline && (
                <div className="mt-2 text-xs text-purple-300">
                  Timeline Lip-Sync ({visemeTimeline.length} visemes)
                </div>
              )}
            </div>

            <div className="aspect-square bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl overflow-hidden">
              <Avatar3D
                avatarType={avatarType}
                audioData={audioData}
                visemeTimeline={visemeTimeline}
                onPlaybackChange={handlePlaybackChange}
                onModelError={(err) =>
                  console.warn('Avatar model failed; fallback shown:', err?.message || err)
                }
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
                  disabled={submitting}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    w-20 h-20 rounded-full flex items-center justify-center
                    transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
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
                  disabled={submitting}
                  whileHover={{ scale: submitting ? 1 : 1.05 }}
                  whileTap={{ scale: submitting ? 1 : 0.95 }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : isLastQuestion ? (
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
                {transcribing
                  ? 'Transcribing your answer...'
                  : recording
                    ? 'Recording your answer... Click again to stop'
                    : 'Click the microphone to record your answer (voice becomes text)'
                }
              </p>

              {transcribing && (
                <div className="flex items-center justify-center gap-2 mt-2 text-purple-300 text-xs">
                  <Loader className="w-3 h-3 animate-spin" />
                  Sending to Whisper / Groq...
                </div>
              )}
            </div>

            {/* Answer Notes */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Your Answer
              </h3>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Speak into the mic or type your answer here..."
                className="w-full h-32 bg-white/5 border border-white/20 rounded-xl p-4 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <p className="text-xs text-purple-300 mt-2">
                💡 Voice recordings are transcribed and appended here - typed notes are kept.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default InterviewRoom;
