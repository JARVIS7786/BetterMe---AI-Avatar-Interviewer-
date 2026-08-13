
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from dotenv import load_dotenv
import json
import io

from rag_engine import rag_engine
from llm_service import llm_service
from tts_service import tts_service
from redis_client import redis_client
from performance_calculator import PerformanceCalculator
from datetime import datetime
import uuid

# Load environment variables
load_dotenv()
os.environ["TOKENIZERS_PARALLELISM"] = "false"
app = FastAPI(title="BetterME API", version="2.0.0")

# CORS configuration - Updated for both React dev servers
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services (imported as singletons)
performance_calculator = PerformanceCalculator()

# Ensure directories exist
os.makedirs("uploads", exist_ok=True)
# Note: audio_output directory no longer needed since we don't save files

# Pydantic models
class ResumeAnalysisResponse(BaseModel):
    success: bool
    message: str
    extracted_text: Optional[str] = None
    key_skills: Optional[List[str]] = None
    experience_years: Optional[int] = None
    summary: Optional[str] = None

class QuestionGenerationRequest(BaseModel):
    user_id: str
    interview_type: str  # "technical", "behavioral", "mixed"
    num_questions: int = 5
    difficulty: str = "medium"  # "easy", "medium", "hard"

class QuestionGenerationResponse(BaseModel):
    success: bool
    questions: List[dict]
    session_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    # Canonical avatar ids (see frontend/src/config/avatars.js):
    # cara, kevin, baymax, blue_demon, bunny, mushroom_king, yeti
    speaker: str = "cara"

class HealthResponse(BaseModel):
    status: str
    services: dict

# NEW: Performance tracking models
class Answer(BaseModel):
    question_id: str
    question_text: str
    answer_text: str
    time_taken: float  # seconds

class SessionSubmission(BaseModel):
    user_id: str
    session_id: str
    interview_type: str
    questions: List[str]
    answers: List[Answer]
    session_duration: float
    avatar_name: Optional[str] = None

class PerformanceResponse(BaseModel):
    success: bool
    session_id: str
    performance: dict
    message: str

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint with Redis status"""
    redis_status = "connected" if redis_client.ping() else "disconnected"

    return {
        "status": "healthy",
        "services": {
            "rag_engine": rag_engine.is_initialized,
            "llm_service": llm_service.is_loaded,
            "tts_service": tts_service.is_loaded,
            "redis": redis_status,
            "performance_calculator": True
        }
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "BetterME AI Interviewer API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/api/check-resume/{user_id}")
async def check_resume(user_id: str):
    """Check if user has uploaded a resume"""
    try:
        context = rag_engine.get_user_context(user_id)
        vector_count = rag_engine.collection.count()
        
        # Get user's vectors
        user_results = rag_engine.collection.get(where={"user_id": user_id})
        
        return {
            "has_resume": bool(context),
            "context_length": len(context) if context else 0,
            "total_vectors": vector_count,
            "user_vectors": len(user_results.get('ids', [])) if user_results else 0
        }
    except Exception as e:
        return {
            "has_resume": False,
            "error": str(e)
        }


@app.post("/api/upload-resume", response_model=ResumeAnalysisResponse)
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """
    Upload and analyze resume
    Supports PDF and DOCX formats
    """
    try:
        # Validate file type
        if not file.filename.endswith(('.pdf', '.docx')):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF and DOCX are supported."
            )
        
        # Save uploaded file
        file_path = f"uploads/{user_id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract text and analyze
        extracted_text = rag_engine.extract_text_from_resume(file_path)
        
        if not extracted_text:
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from resume."
            )
        
        # Process with RAG engine
        analysis = rag_engine.analyze_resume(extracted_text, user_id)

        # Invalidate cached context for this user
        redis_client.invalidate_context(user_id)
        print(f"Deleted:  Invalidated cached context for user {user_id}")

        return {
            "success": True,
            "message": "Resume analyzed successfully",
            "extracted_text": extracted_text[:500] + "...",  # Preview
            "key_skills": analysis.get("skills", []),
            "experience_years": analysis.get("experience_years", 0),
            "summary": analysis.get("summary", "")
        }

    except Exception as e:
        error_msg = str(e) if str(e) else repr(e)
        print(f"ERROR: Resume upload failed: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/api/generate-questions", response_model=QuestionGenerationResponse)
async def generate_questions(request: QuestionGenerationRequest):
    """
    Generate SITUATIONAL interview questions using CRAG + Redis caching
    CRITICAL: Only generates application-based questions, NO definitions
    """
    try:
        print(f"🎯 Generating questions for user: {request.user_id}")
        print(f"   Type: {request.interview_type}, Questions: {request.num_questions}, Difficulty: {request.difficulty}")

        # Step 1: Check Redis cache
        cache_key = f"scenario:{request.interview_type}:{request.difficulty}"
        cached_questions = redis_client.get_cached_scenario(request.interview_type, request.difficulty)

        if cached_questions and len(cached_questions) >= request.num_questions:
            print(f"Cache hit: Using cached questions")
            session_id = str(uuid.uuid4())
            return {
                "success": True,
                "questions": cached_questions[:request.num_questions],
                "session_id": session_id
            }

        # Step 2: Retrieve context with CRAG
        crag_result = rag_engine.get_user_context_with_crag(
            user_id=request.user_id,
            query=f"{request.interview_type} interview questions"
        )

        if not crag_result['context']:
            raise HTTPException(
                status_code=404,
                detail="No resume found for user. Please upload resume first."
            )

        print(f"📊 CRAG relevance score: {crag_result['relevance_score']:.2f}")
        print(f"   Context: {len(crag_result['context'])} chars")
        print(f"   Skills: {', '.join(crag_result['skills'][:5])}")
        print(f"   Experience: {crag_result['experience_years']} years")

        # Step 3: Generate situational questions using LLM
        questions = llm_service.generate_situational_questions(
            context=crag_result['context'],
            interview_type=request.interview_type,
            num_questions=request.num_questions,
            difficulty=request.difficulty
        )

        if not questions:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate valid questions. Please try again."
            )

        print(f"OK: Generated {len(questions)} situational questions")

        # Step 4: Cache the questions
        redis_client.cache_scenario(
            interview_type=request.interview_type,
            difficulty=request.difficulty,
            questions=questions,
            ttl=3600  # 1 hour
        )

        # Step 5: Create session ID
        session_id = str(uuid.uuid4())

        # Step 6: Store session state in Redis
        redis_client.save_session_state(
            session_id=session_id,
            state={
                'user_id': request.user_id,
                'interview_type': request.interview_type,
                'difficulty': request.difficulty,
                'questions': questions,
                'created_at': datetime.now().isoformat()
            },
            ttl=86400  # 24 hours
        )

        return {
            "success": True,
            "questions": questions,
            "session_id": session_id
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("ERROR: ERROR in generate_questions:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text-to-speech")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using OpenAI TTS
    Returns audio as streaming response (no files saved)
    Supports: 'cara' (female/Nova) and 'kevin' (male/Echo)
    """
    try:
        print(f"TTS: TTS request: speaker={request.speaker}, text_length={len(request.text)}")

        # Generate audio as bytes
        audio_bytes = tts_service.generate_speech_to_bytes(
            text=request.text,
            speaker=request.speaker
        )

        if not audio_bytes:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate audio"
            )

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav",
                "Cache-Control": "no-cache"
            }
        )

    except Exception as e:
        print(f"ERROR: TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/text-to-speech-lipsync")
async def text_to_speech_with_lipsync(request: TTSRequest):
    """
    Convert text to speech with lip-sync data
    Returns audio bytes and viseme timeline for avatar animation
    """
    try:
        print(f"TTS: TTS+Lipsync request: speaker={request.speaker}, text_length={len(request.text)}")

        # Generate audio with lip-sync data
        result = tts_service.generate_speech_with_lipsync(
            text=request.text,
            speaker=request.speaker
        )

        if not result:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate audio with lip-sync"
            )

        # Convert audio bytes to base64 for JSON response
        import base64
        audio_base64 = base64.b64encode(result['audio_bytes']).decode('utf-8')

        # Contract (must match frontend InterviewRoom.jsx):
        # { success, audio_base64, viseme_data, duration }
        # viseme_data is null because Gemini TTS provides no visemes;
        # the frontend then uses frequency-based animation.
        return {
            "success": True,
            "audio_base64": audio_base64,
            "viseme_data": result['viseme_data'],
            "duration": result['duration']
        }

    except Exception as e:
        print(f"ERROR: TTS+Lipsync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe a recorded answer using Groq Whisper.
    Expects multipart/form-data with a single `file` field.
    Returns: { "success": true, "transcript": "..." }
    """
    try:
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        print(f"STT: transcribe request: filename={file.filename}, bytes={len(audio_bytes)}")

        transcript = tts_service.transcribe_audio(
            audio_file=audio_bytes,
            filename=file.filename or "answer.webm"
        )

        if not transcript or not transcript.strip():
            # Groq/Whisper failure or silence - report honestly, no fake success.
            return {
                "success": False,
                "transcript": "",
                "message": "No speech detected or transcription failed"
            }

        return {
            "success": True,
            "transcript": transcript.strip()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR: Transcribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/batch-tts")
async def batch_text_to_speech(texts: List[str], speaker: str = "cara"):
    """
    Generate TTS for multiple questions at once
    Returns a list of audio files as base64 encoded strings
    No files saved on server
    """
    try:
        import base64
        audio_data = []
        
        for idx, text in enumerate(texts):
            audio_bytes = tts_service.generate_speech_to_bytes(
                text=text,
                speaker=speaker
            )
            
            if audio_bytes:
                # Convert to base64 for JSON response
                audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
                audio_data.append({
                    "index": idx,
                    "text": text[:50] + "..." if len(text) > 50 else text,
                    "audio_base64": audio_b64
                })
        
        return {
            "success": True,
            "count": len(audio_data),
            "audio_data": audio_data
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/speakers")
async def get_speakers():
    """
    Get list of available TTS speakers/voices
    """
    return {
        "success": True,
        "speakers": tts_service.get_available_speakers()
    }

@app.delete("/api/user-data/{user_id}")
async def delete_user_data(user_id: str):
    """Delete user's resume data from vector store"""
    try:
        success = rag_engine.delete_user_data(user_id)
        
        return {
            "success": success,
            "message": "User data deleted successfully" if success else "Failed to delete data"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_system_stats():
    """Get system statistics"""
    return {
        "total_users": rag_engine.get_user_count(),
        "llm_model": llm_service.model_name,
        "tts_model": tts_service.model_name,
        "vector_store_size": rag_engine.get_vector_count()
    }

# ============================================================
# PERFORMANCE TRACKING ENDPOINTS
# ============================================================

@app.post("/api/performance/submit-session", response_model=PerformanceResponse)
async def submit_session(session: SessionSubmission):
    """
    Submit completed interview session and get performance metrics
    """
    try:
        print(f"📊 Submitting session for user: {session.user_id}")
        print(f"   Session ID: {session.session_id}")
        print(f"   Questions: {len(session.questions)}, Answers: {len(session.answers)}")
        
        # Prepare data for calculator
        session_data = {
            'questions': session.questions,
            'answers': [answer.answer_text for answer in session.answers],
            'timestamps': [answer.time_taken for answer in session.answers],
            'session_duration': session.session_duration,
            'interview_type': session.interview_type
        }
        
        # Calculate performance
        performance = performance_calculator.calculate_session_performance(session_data)
        
        print(f"OK: Performance: {performance['overall_score']}/100 ({performance['grade']})")
        
        # TODO: Save to Supabase (optional)
        # session_record = {
        #     'id': session.session_id,
        #     'user_id': session.user_id,
        #     'overall_score': performance['overall_score'],
        #     'grade': performance['grade'],
        #     ...
        # }
        # supabase.table('interview_sessions').insert(session_record).execute()
        
        return {
            'success': True,
            'session_id': session.session_id,
            'performance': performance,
            'message': 'Session submitted successfully'
        }
        
    except Exception as e:
        import traceback
        print("ERROR: ERROR in submit_session:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/performance/user-stats/{user_id}")
async def get_user_stats(user_id: str):
    """
    Get aggregate performance statistics for a user
    """
    try:
        print(f"📈 Fetching stats for user: {user_id}")
        
        # TODO: Fetch sessions from Supabase
        # sessions = supabase.table('interview_sessions')
        #                   .select('*')
        #                   .eq('user_id', user_id)
        #                   .execute()
        
        # For now, return empty stats
        sessions = []
        
        if not sessions:
            return {
                'total_sessions': 0,
                'avg_performance': 0,
                'best_score': 0,
                'worst_score': 0,
                'total_questions': 0,
                'improvement_trend': 'N/A',
                'avg_grade': 'N/A',
                'recent_sessions': []
            }
        
        # Calculate aggregate
        aggregate = performance_calculator.calculate_aggregate_performance(sessions)
        
        # Get recent sessions
        recent = sorted(sessions, key=lambda x: x.get('created_at', ''), reverse=True)[:5]
        
        return {
            **aggregate,
            'recent_sessions': recent
        }
        
    except Exception as e:
        import traceback
        print("ERROR: ERROR in get_user_stats:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/performance/session-detail/{session_id}")
async def get_session_detail(session_id: str):
    """
    Get detailed performance for a specific session
    """
    try:
        # TODO: Fetch from Supabase
        return {
            'success': True,
            'session_id': session_id,
            'message': 'Session details (implement Supabase query)'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
