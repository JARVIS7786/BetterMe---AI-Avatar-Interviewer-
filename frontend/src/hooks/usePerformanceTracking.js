// usePerformanceTracking.js
// React hook for tracking interview performance

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const usePerformanceTracking = (sessionId, userId) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Initialize session
  useEffect(() => {
    setSessionStartTime(Date.now());
    setQuestionStartTime(Date.now());
  }, []);

  // Track when moving to next question
  const recordAnswer = useCallback((questionId, questionText, answerText) => {
    const now = Date.now();
    const timeTaken = questionStartTime ? (now - questionStartTime) / 1000 : 0;

    const answer = {
      question_id: questionId,
      question_text: questionText,
      answer_text: answerText,
      time_taken: timeTaken,
      timestamp: now
    };

    setAnswers(prev => [...prev, answer]);
    setQuestionStartTime(now); // Reset for next question
    setCurrentQuestionIndex(prev => prev + 1);

    return answer;
  }, [questionStartTime]);

  // Calculate session duration
  const getSessionDuration = useCallback(() => {
    if (!sessionStartTime) return 0;
    return (Date.now() - sessionStartTime) / 1000;
  }, [sessionStartTime]);

  // Submit session for performance calculation
  const submitSession = useCallback(async (questions, interviewType, avatarName) => {
    try {
      const sessionDuration = getSessionDuration();

      const payload = {
        user_id: userId,
        session_id: sessionId,
        interview_type: interviewType,
        questions: questions.map(q => q.question),
        answers: answers,
        session_duration: sessionDuration,
        avatar_name: avatarName
      };

      const response = await axios.post(
        `${API_URL}/api/performance/submit-session`,
        payload
      );

      setSessionData(response.data);
      return response.data;
    } catch (error) {
      console.error('Error submitting session:', error);
      throw error;
    }
  }, [userId, sessionId, answers, getSessionDuration]);

  // Get user statistics
  const getUserStats = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/performance/user-stats/${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }, [userId]);

  return {
    currentQuestionIndex,
    recordAnswer,
    submitSession,
    getUserStats,
    sessionData,
    answers,
    sessionDuration: getSessionDuration()
  };
};

// Hook for dashboard statistics
export const useDashboardStats = (userId) => {
  const [stats, setStats] = useState({
    total_sessions: 0,
    avg_performance: 0,
    best_score: 0,
    total_questions: 0,
    improvement_trend: 'N/A'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_URL}/api/performance/user-stats/${userId}`
        );
        setStats(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchStats();
    }
  }, [userId]);

  return { stats, loading, error };
};

export default usePerformanceTracking;
