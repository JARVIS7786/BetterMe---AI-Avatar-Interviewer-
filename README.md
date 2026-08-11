# 🎯 BetterME - AI Interview Practice Platform (Enterprise Edition)

An enterprise-grade AI-powered interview preparation platform with **CRAG/Self-RAG**, **Redis caching**, **Groq LLM**, **OpenAI TTS**, and a **Baymax-style 3D avatar**.

## ✨ Features

- 🔐 **Secure Authentication** - Login/Signup with Supabase (unchanged)
- 📄 **CRAG Resume Analysis** - Context evaluation with relevance scoring
- 🎭 **Baymax Avatar** - Audio-reactive 3D sphere (no lip-sync needed)
- 🤖 **Situational Questions ONLY** - NO definitions, only real-world scenarios
- 🗣️ **OpenAI TTS** - Natural female voice (Nova) by default
- 🎤 **Groq Whisper** - Ultra-fast speech-to-text
- ⚡ **Redis Caching** - Sub-second response times
- 📊 **Performance Analytics** - Real-time answer evaluation
- 🧠 **Learning Loop** - Adaptive difficulty based on past performance
- 🎯 **Interview Types** - Technical, Behavioral, or Mixed

## 🏗️ Tech Stack

### Frontend
- React 18 with Hooks
- React Router v6 for navigation
- **React Three Fiber** for Baymax 3D avatar
- Framer Motion for smooth animations
- Supabase Client for authentication

### Backend (Enterprise-Grade)
- **FastAPI** (Python 3.11+)
- **Groq API** - llama3-70b-8192 for ultra-fast LLM
- **OpenAI TTS** - Natural voice synthesis
- **Groq Whisper** - Speech-to-text
- **Redis** - Caching layer for performance
- **ChromaDB** - Vector storage for resume embeddings
- **Supabase** - Authentication and session persistence
- **CRAG/Self-RAG** - Context evaluation and adaptive retrieval

## 📋 Prerequisites

### System Requirements
- **Windows 10/11** (64-bit) or **macOS** or **Linux**
- **Docker Desktop** (required for backend)
- **Node.js 20+** and npm
- **8GB RAM** minimum (16GB recommended)
- **10GB free disk space**

### API Keys (Required)
- **Groq API Key** - Get from https://console.groq.com/keys (free tier available)
- **OpenAI API Key** - Get from https://platform.openai.com/api-keys (for TTS)
- **Supabase Project** - Create at https://supabase.com (free tier available)

## 🚀 Quick Start Installation

### 1. Environment Setup

```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env

# Edit .env with your API keys:
# - GROQ_API_KEY
# - OPENAI_API_KEY
# - SUPABASE_URL
# - SUPABASE_KEY
```

### 2. Supabase Database Setup

1. Go to https://app.supabase.com
2. Open **SQL Editor**
3. Copy and run the SQL from `supabase_migration.sql`
4. Verify tables created: `interview_sessions`, `candidate_responses`, `question_history`

### 3. Start Backend (Docker)

```bash
# Start Redis + FastAPI backend
docker compose up -d

# Check logs
docker compose logs -f backend

# Verify health
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "rag_engine": true,
    "llm_service": true,
    "tts_service": true,
    "redis": "connected",
    "performance_calculator": true
  }
}
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: **http://localhost:5173**

## 🧪 Verify Installation

```bash
# Test backend health
curl http://localhost:8000/health

# Test Redis
docker compose exec redis redis-cli PING
# Expected: PONG

# Test TTS (generates audio file)
curl -X POST http://localhost:8000/api/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, I am your AI interviewer","speaker":"nova"}' \
  --output test.wav
```

## 📖 Usage Flow

1. **Login/Signup** - Supabase authentication (unchanged)
2. **Upload Resume** - PDF/DOCX analyzed with CRAG
3. **Select Avatar** - Cara (female/Nova voice) or Kevin (male/Echo voice)
4. **Choose Interview Type** - Technical, Behavioral, or Mixed
5. **Interview Session** - Baymax sphere pulses with audio
6. **Answer Questions** - Record or type your answers
7. **Review Performance** - Comprehensive analytics and feedback

## 🎯 Key Features Explained

### CRAG/Self-RAG Resume Analysis
- **Context Evaluation**: Relevance scoring (0.0-1.0)
- **Adaptive Retrieval**: Enriches context if relevance < 0.7
- **Learning Loop**: Tracks past sessions for difficulty adjustment
- **ChromaDB**: Vector embeddings for semantic search
- **Supabase**: Session history and performance tracking

### Situational Question Generation
- **CRITICAL**: Only generates application-based questions
- **Blocked Patterns**: "What is...", "Define...", "Explain the concept..."
- **Validation**: Regex + LLM double-check
- **Groq LLM**: llama3-70b-8192 for ultra-fast generation
- **Redis Caching**: 1-hour TTL for repeated scenarios

### Baymax 3D Avatar
- **Audio-Reactive**: Scales 1.0 to 1.3 based on frequency analysis
- **Web Audio API**: Real-time frequency data
- **Smooth Lerp**: Natural pulsing transitions
- **Idle Animation**: Gentle floating and rotation
- **No Lip-Sync**: Simpler than human visemes

### Performance Analytics
- **Answer Quality**: 0-100 score based on depth and clarity
- **Response Time**: Optimal range 45-120 seconds
- **Confidence Score**: Filler word detection
- **Completion Rate**: Questions answered vs total
- **Trend Analysis**: Improving, stable, or declining

## 🐛 Troubleshooting

### Backend Issues

**Redis connection failed:**
```bash
docker compose restart redis
docker compose logs redis
```

**GROQ_API_KEY not found:**
```bash
# Verify .env file
cat .env | grep GROQ_API_KEY
docker compose restart backend
```

**Questions are definition-based (should NEVER happen):**
```bash
# Check logs for blocked questions
docker compose logs backend | grep "Blocked definition question"
```

### Frontend Issues

**CORS errors:**
```bash
# Verify CORS_ORIGINS in .env includes your frontend URL
# Restart backend
docker compose restart backend
```

**Avatar doesn't appear:**
```bash
cd frontend
npm install @react-three/fiber @react-three/drei three
```

**No audio playback:**
```bash
# Test TTS endpoint
curl -X POST http://localhost:8000/api/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{"text":"test","speaker":"nova"}' \
  --output test.wav
```

### Docker Issues

**Port 8000 already in use (Windows):**
```bash
netstat -ano | findstr :8000
taskkill /PID <process_id> /F
```

**Port 8000 already in use (Mac/Linux):**
```bash
lsof -ti:8000 | xargs kill -9
```

## 📁 Project Structure

```
betterme-ai-interviewer-main/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Avatar3D.jsx         # Baymax audio-reactive sphere
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Supabase auth (unchanged)
│   │   │   ├── InterviewRoom.jsx    # Main interview interface
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Supabase auth (unchanged)
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── main.py                      # FastAPI app with CRAG + Redis
│   ├── llm_service.py               # Groq API + question validation
│   ├── rag_engine.py                # CRAG/Self-RAG implementation
│   ├── tts_service.py               # OpenAI TTS + Groq Whisper
│   ├── redis_client.py              # Redis caching layer
│   ├── performance_calculator.py    # Answer evaluation
│   ├── Dockerfile                   # Backend container
│   ├── requirements.txt             # Python dependencies
│   └── .env.example
├── docker-compose.yml               # Redis + Backend orchestration
├── supabase_migration.sql           # Database schema
├── INSTALLATION_WINDOWS.md          # Detailed setup guide
└── README.md
```

## 📈 Performance Metrics

- **Question Generation**: < 3 seconds (with CRAG)
- **Cached Questions**: < 100ms (Redis hit)
- **TTS Generation**: 1-2 seconds per question
- **Redis Cache Hit Rate**: > 60% after warmup
- **Groq LLM Speed**: ~100 tokens/second
- **Context Evaluation**: < 500ms

## 📚 Documentation

- **Full Installation Guide**: `INSTALLATION_WINDOWS.md`
- **Supabase Migration**: `supabase_migration.sql`
- **Environment Setup**: `.env.example` and `frontend/.env.example`
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Plan Document**: `.claude/plans/yes-i-am-ready-tranquil-mitten.md`

## 🎉 Success Criteria

✅ Docker Compose starts successfully  
✅ Health endpoint shows all services connected  
✅ Questions are 100% situational (no definitions)  
✅ CRAG evaluates context and adjusts difficulty  
✅ Redis caching reduces API calls  
✅ OpenAI TTS generates female voice audio  
✅ Baymax sphere animates with audio  
✅ Supabase auth flow remains untouched  
✅ Full interview session completes end-to-end  
✅ Performance results are calculated and stored  

## 🤝 Contributing

This is an enterprise-grade system. Key principles:

1. **NO PLACEHOLDERS**: All code must be production-ready
2. **NO DEFINITION QUESTIONS**: Only situational/application-based
3. **CRAG FIRST**: Always evaluate context relevance
4. **CACHE EVERYTHING**: Use Redis for performance
5. **TEST THOROUGHLY**: Verify end-to-end before committing

## 📝 License

MIT License - feel free to use for your interview preparation!

## 🆘 Support

For issues or questions:
- Check the troubleshooting section above
- Review `INSTALLATION_WINDOWS.md` for detailed setup
- Check Docker logs: `docker compose logs -f backend`
- Check browser console for frontend errors
- Verify API health: `curl http://localhost:8000/health`

---

**Built with ❤️ using Groq, OpenAI, Supabase, and React Three Fiber**

**Happy Interview Practicing! 🚀**
