import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  Upload,
  FileText,
  CheckCircle,
  Loader,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ResumePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const uploadedFile = acceptedFiles[0];
      
      // Validate file type
      if (!uploadedFile.name.match(/\.(pdf|docx)$/i)) {
        toast.error('Please upload a PDF or DOCX file');
        return;
      }

      // Validate file size (max 5MB)
      if (uploadedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      setFile(uploadedFile);
      setAnalyzed(false);
      toast.success('Resume uploaded! Click Analyze to continue.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Please upload a resume first');
      return;
    }

    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);

      const response = await axios.post(
        `${API_URL}/api/upload-resume`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setAnalyzed(true);
        setAnalysisResult(response.data);
        toast.success('Resume analyzed successfully!');
      } else {
        toast.error('Failed to analyze resume');
      }
    } catch (error) {
      console.error('Error analyzing resume:', error);
      toast.error(error.response?.data?.detail || 'Failed to analyze resume');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleNext = () => {
    if (!analyzed) {
      toast.error('Please analyze your resume first');
      return;
    }
    navigate('/avatar-selection');
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
          <h1 className="text-5xl font-bold text-white mb-4">
            Upload Your Resume
          </h1>
          <p className="text-xl text-purple-200">
            Let's analyze your experience to create personalized interview questions
          </p>
        </motion.div>

        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer
              transition-all duration-300 bg-white/5 backdrop-blur-lg
              ${isDragActive 
                ? 'border-purple-400 bg-purple-500/20' 
                : 'border-white/30 hover:border-purple-400 hover:bg-white/10'
              }
              ${file ? 'border-green-400' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center">
              {file ? (
                <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
              ) : (
                <Upload className="w-16 h-16 text-purple-300 mb-4" />
              )}
              
              {file ? (
                <>
                  <p className="text-2xl font-semibold text-white mb-2">
                    {file.name}
                  </p>
                  <p className="text-purple-200 mb-4">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <p className="text-sm text-purple-300">
                    Click or drag to replace
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-white mb-2">
                    {isDragActive
                      ? 'Drop your resume here'
                      : 'Drag & drop your resume'
                    }
                  </p>
                  <p className="text-purple-200 mb-4">
                    or click to browse
                  </p>
                  <p className="text-sm text-purple-300">
                    Supports PDF and DOCX (max 5MB)
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Analysis Result */}
        {analyzed && analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-400" />
              Analysis Complete
            </h2>

            <div className="space-y-6">
              {/* Skills */}
              {analysisResult.key_skills && analysisResult.key_skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-3">
                    Identified Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.key_skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-500/30 text-purple-100 rounded-lg text-sm border border-purple-400/50"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {analysisResult.experience_years > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-2">
                    Experience Level
                  </h3>
                  <p className="text-white text-xl">
                    {analysisResult.experience_years} years of professional experience
                  </p>
                </div>
              )}

              {/* Summary */}
              {analysisResult.summary && (
                <div>
                  <h3 className="text-lg font-semibold text-purple-200 mb-2">
                    Resume Summary
                  </h3>
                  <p className="text-purple-100">
                    {analysisResult.summary}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 justify-center"
        >
          <motion.button
            onClick={handleAnalyze}
            disabled={!file || analyzing || analyzed}
            whileHover={{ scale: file && !analyzing && !analyzed ? 1.05 : 1 }}
            whileTap={{ scale: file && !analyzing && !analyzed ? 0.95 : 1 }}
            className={`
              flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg
              transition-all shadow-lg
              ${file && !analyzed
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-purple-500/50'
                : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
              }
            `}
          >
            {analyzing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : analyzed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Analyzed
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Analyze Resume
              </>
            )}
          </motion.button>

          <motion.button
            onClick={handleNext}
            disabled={!analyzed}
            whileHover={{ scale: analyzed ? 1.05 : 1 }}
            whileTap={{ scale: analyzed ? 0.95 : 1 }}
            className={`
              flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg
              transition-all shadow-lg
              ${analyzed
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-green-500/50'
                : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
              }
            `}
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Help Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 bg-blue-500/10 border border-blue-400/30 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-300 mt-0.5" />
            <div>
              <p className="text-blue-200 text-sm">
                <strong>Tip:</strong> Your resume helps us create relevant interview questions.
                The more detailed your resume, the better the questions!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ResumePage;
