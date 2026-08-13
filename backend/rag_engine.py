"""
RAG Engine with CRAG/Self-RAG for AI Interviewer
Handles resume processing, context retrieval, and learning loop
"""

import os
import re
from typing import List, Dict, Optional
from datetime import datetime
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from dotenv import load_dotenv
import PyPDF2
import docx
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

load_dotenv()

class NoOpEmbeddingFunction(EmbeddingFunction):
    def __call__(self, input: Documents) -> Embeddings:
        return [[0.0] * 384 for _ in input]
class RAGEngine:
    """CRAG/Self-RAG implementation with ChromaDB and Supabase"""

    def __init__(self):
        # Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(
            path="./chroma_db",
            settings=Settings(anonymized_telemetry=False)
        )

        # Get or create collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="candidate_resumes",
            metadata={"description": "Candidate resume embeddings"},
            embedding_function=NoOpEmbeddingFunction()
        )

        # Initialize embedding model
      
        self.embedding_model = None
        # print("Embedding model loaded")

        # Initialize Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')

        if supabase_url and supabase_key:
            self.supabase: Client = create_client(supabase_url, supabase_key)
            print("Supabase connected")
        else:
            self.supabase = None
            print("WARNING: Supabase credentials not found - session history disabled")

        self.is_initialized = True
        print("RAG Engine initialized")
    

    # ============================================================
    # RESUME PROCESSING
    # ============================================================

    def extract_text_from_resume(self, file_path: str) -> str:
        """
        Extract text from PDF or DOCX resume

        Args:
            file_path: Path to resume file

        Returns:
            Extracted text content
        """
        try:
            if file_path.endswith('.pdf'):
                return self._extract_from_pdf(file_path)
            elif file_path.endswith('.docx'):
                return self._extract_from_docx(file_path)
            else:
                raise ValueError(f"Unsupported file format: {file_path}")
        except Exception as e:
            print(f"❌ Text extraction error: {e}")
            return ""

    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF"""
        text = ""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
        except Exception as e:
            print(f"❌ PDF extraction error: {e}")
        return text.strip()

    def _extract_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX"""
        text = ""
        try:
            doc = docx.Document(file_path)
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
        except Exception as e:
            print(f"❌ DOCX extraction error: {e}")
        return text.strip()

    def analyze_resume(self, resume_text: str, user_id: str) -> Dict:
        """
        Analyze resume and extract key information

        Args:
            resume_text: Extracted resume text
            user_id: User identifier

        Returns:
            Dictionary with skills, experience_years, summary
        """
        # Extract skills (basic keyword matching)
        skills = self._extract_skills(resume_text)

        # Estimate years of experience
        experience_years = self._estimate_experience(resume_text)

        # Generate summary
        summary = self._generate_summary(resume_text)

        # Store in ChromaDB
        self._store_resume_embeddings(resume_text, user_id, skills, experience_years)

        return {
            "skills": skills,
            "experience_years": experience_years,
            "summary": summary
        }

    def _extract_skills(self, text: str) -> List[str]:
        """Extract technical skills from resume text"""
        # Common technical skills keywords
        skill_keywords = [
            'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
            'node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'sql',
            'postgresql', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes',
            'aws', 'azure', 'gcp', 'git', 'ci/cd', 'agile', 'scrum', 'rest api',
            'graphql', 'microservices', 'machine learning', 'data science', 'ai',
            'tensorflow', 'pytorch', 'pandas', 'numpy', 'html', 'css', 'sass',
            'webpack', 'babel', 'jest', 'pytest', 'junit', 'selenium', 'cypress'
        ]

        text_lower = text.lower()
        found_skills = []

        for skill in skill_keywords:
            if skill in text_lower:
                found_skills.append(skill.title())

        return list(set(found_skills))[:15]  # Return top 15 unique skills

    def _estimate_experience(self, text: str) -> int:
        """Estimate years of experience from resume"""
        # Look for patterns like "5 years", "5+ years", "2019-2023"
        year_patterns = [
            r'(\d+)\+?\s*years?',
            r'(\d{4})\s*-\s*(\d{4})',
            r'(\d{4})\s*-\s*present',
        ]

        years = []
        current_year = datetime.now().year

        for pattern in year_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    if len(match) == 2:
                        # Date range
                        start = int(match[0])
                        end = int(match[1]) if match[1].isdigit() else current_year
                        years.append(end - start)
                    else:
                        years.append(int(match[0]))
                else:
                    years.append(int(match))

        return max(years) if years else 0

    def _generate_summary(self, text: str) -> str:
        """Generate brief summary of resume"""
        # Take first 200 characters as summary
        summary = text[:200].strip()
        if len(text) > 200:
            summary += "..."
        return summary
    
    def _get_embedding_model(self):
        if self.embedding_model is None:
            print("Loading embedding model...")
            self.embedding_model = SentenceTransformer(
                "all-MiniLM-L6-v2",
                device="cpu"
            )
            
        return self.embedding_model

    def _store_resume_embeddings(self, text: str, user_id: str, skills: List[str], experience_years: int):
        """
        Store resume embeddings in ChromaDB
        Chunks text into smaller segments for better retrieval
        """
        # Chunk text into paragraphs
        chunks = [chunk.strip() for chunk in text.split('\n\n') if chunk.strip()]

        if not chunks:
            chunks = [text]

        # Generate embeddings
        embeddings = self._get_embedding_model().encode(chunks).tolist()

        # Prepare metadata
        ids = [f"{user_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "user_id": user_id,
                "chunk_index": i,
                "skills": ",".join(skills),
                "experience_years": experience_years,
                "timestamp": datetime.now().isoformat()
            }
            for i in range(len(chunks))
        ]

        # Store in ChromaDB
        try:
            # Delete existing user data first
            self.delete_user_data(user_id)

            # Add new embeddings
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metadatas
            )
            print(f"OK: Stored {len(chunks)} resume chunks for user {user_id}")
        except Exception as e:
            print(f"ERROR: ChromaDB storage error: {e}")
            raise  # Re-raise the exception so it propagates up

    # ============================================================
    # CRAG CONTEXT RETRIEVAL
    # ============================================================

    def get_user_context(self, user_id: str) -> str:
        """
        Basic context retrieval (backward compatible)
        Returns concatenated resume text
        """
        try:
            results = self.collection.get(
                where={"user_id": user_id},
                include=["documents"]
            )

            if results and results['documents']:
                return "\n\n".join(results['documents'])
            return ""
        except Exception as e:
            print(f"❌ Context retrieval error: {e}")
            return ""

    def get_user_context_with_crag(self, user_id: str, query: str = "") -> Dict:
        """
        CRAG: Corrective Retrieval Augmented Generation
        Evaluates context relevance and retrieves additional context if needed

        Args:
            user_id: User identifier
            query: Optional query for context evaluation

        Returns:
            {
                'context': str,
                'relevance_score': float,
                'past_sessions': List[Dict],
                'skills': List[str],
                'experience_years': int
            }
        """
        print(f"🔍 CRAG: Retrieving context for user {user_id}...")

        # Step 1: Retrieve resume context from ChromaDB
        resume_context = ""
        skills = []
        experience_years = 0

        try:
            results = self.collection.get(
                where={"user_id": user_id},
                include=["documents", "metadatas"]
            )

            if results and results['documents']:
                resume_context = "\n\n".join(results['documents'])

                # Extract metadata from first chunk
                if results['metadatas']:
                    first_meta = results['metadatas'][0]
                    skills = first_meta.get('skills', '').split(',') if first_meta.get('skills') else []
                    experience_years = first_meta.get('experience_years', 0)

                print(f"✅ Retrieved resume: {len(resume_context)} chars")
        except Exception as e:
            print(f"❌ Resume retrieval error: {e}")

        # Step 2: Retrieve past interview sessions from Supabase
        past_sessions = []
        if self.supabase:
            try:
                response = self.supabase.table('interview_sessions') \
                    .select('*') \
                    .eq('user_id', user_id) \
                    .order('created_at', desc=True) \
                    .limit(5) \
                    .execute()

                if response.data:
                    past_sessions = response.data
                    print(f"✅ Retrieved {len(past_sessions)} past sessions")
            except Exception as e:
                print(f"⚠️  Past sessions retrieval error: {e}")

        # Step 3: Build comprehensive context
        context_parts = []

        if resume_context:
            context_parts.append(f"RESUME:\n{resume_context}")

        if past_sessions:
            session_summary = self._summarize_past_sessions(past_sessions)
            context_parts.append(f"\nPAST INTERVIEW PERFORMANCE:\n{session_summary}")

        full_context = "\n\n".join(context_parts)

        # Step 4: Evaluate context relevance (Self-RAG)
        relevance_score = self._evaluate_context_quality(full_context, query)

        # Step 5: If relevance is low, try to enrich context
        if relevance_score < 0.7 and self.supabase:
            print(f"⚠️  Low relevance ({relevance_score:.2f}), enriching context...")
            full_context = self._enrich_context(user_id, full_context)
            relevance_score = self._evaluate_context_quality(full_context, query)

        return {
            'context': full_context,
            'relevance_score': relevance_score,
            'past_sessions': past_sessions,
            'skills': skills,
            'experience_years': experience_years
        }

    def _summarize_past_sessions(self, sessions: List[Dict]) -> str:
        """Summarize past interview sessions"""
        if not sessions:
            return "No past interview history."

        summary_parts = []
        for session in sessions[:3]:  # Last 3 sessions
            score = session.get('overall_score', 0)
            grade = session.get('grade', 'N/A')
            interview_type = session.get('interview_type', 'unknown')
            created_at = session.get('created_at', '')

            summary_parts.append(
                f"- {interview_type.title()} interview: {score}/100 ({grade}) on {created_at[:10]}"
            )

        return "\n".join(summary_parts)

    def _evaluate_context_quality(self, context: str, query: str) -> float:
        """
        Self-RAG: Evaluate quality of retrieved context
        Returns relevance score 0.0-1.0
        """
        if not context or len(context.strip()) < 50:
            return 0.0

        # Basic heuristics for context quality
        score = 0.0

        # Length check
        if len(context) > 200:
            score += 0.3
        if len(context) > 500:
            score += 0.2

        # Content checks
        if 'experience' in context.lower() or 'project' in context.lower():
            score += 0.2

        if any(skill in context.lower() for skill in ['python', 'java', 'javascript', 'react', 'sql']):
            score += 0.2

        if 'past interview' in context.lower():
            score += 0.1

        return min(score, 1.0)

    def _enrich_context(self, user_id: str, current_context: str) -> str:
        """
        Enrich context by retrieving additional candidate responses
        """
        if not self.supabase:
            return current_context

        try:
            # Get recent candidate responses
            response = self.supabase.table('candidate_responses') \
                .select('question_text, answer_text, answer_quality_score') \
                .order('created_at', desc=True) \
                .limit(10) \
                .execute()

            if response.data:
                enrichment = "\n\nRECENT ANSWERS:\n"
                for item in response.data[:5]:
                    enrichment += f"Q: {item['question_text'][:100]}...\n"
                    enrichment += f"A: {item['answer_text'][:150]}... (Score: {item.get('answer_quality_score', 0)})\n\n"

                return current_context + enrichment
        except Exception as e:
            print(f"⚠️  Context enrichment error: {e}")

        return current_context

    # ============================================================
    # LEARNING LOOP
    # ============================================================

    def store_candidate_response(
        self,
        session_id: str,
        question_id: str,
        question_text: str,
        answer_text: str,
        answer_quality_score: float,
        time_taken: float
    ) -> bool:
        """
        Store candidate response for learning loop
        Used to adjust future question difficulty
        """
        if not self.supabase:
            print("⚠️  Supabase not configured - response not stored")
            return False

        try:
            data = {
                'session_id': session_id,
                'question_id': question_id,
                'question_text': question_text,
                'answer_text': answer_text,
                'answer_quality_score': answer_quality_score,
                'time_taken': time_taken,
                'created_at': datetime.now().isoformat()
            }

            self.supabase.table('candidate_responses').insert(data).execute()
            print(f"✅ Stored response for question {question_id}")
            return True
        except Exception as e:
            print(f"❌ Response storage error: {e}")
            return False

    def get_candidate_performance_trend(self, user_id: str) -> Dict:
        """
        Analyze candidate's performance trend
        Used for adaptive difficulty adjustment
        """
        if not self.supabase:
            return {'trend': 'unknown', 'avg_score': 0, 'session_count': 0}

        try:
            response = self.supabase.table('interview_sessions') \
                .select('overall_score, created_at') \
                .eq('user_id', user_id) \
                .order('created_at', desc=True) \
                .limit(10) \
                .execute()

            if not response.data:
                return {'trend': 'new', 'avg_score': 0, 'session_count': 0}

            scores = [s['overall_score'] for s in response.data]
            avg_score = sum(scores) / len(scores)

            # Determine trend
            if len(scores) >= 3:
                recent_avg = sum(scores[:3]) / 3
                older_avg = sum(scores[3:]) / len(scores[3:]) if len(scores) > 3 else recent_avg

                if recent_avg > older_avg + 10:
                    trend = 'improving'
                elif recent_avg < older_avg - 10:
                    trend = 'declining'
                else:
                    trend = 'stable'
            else:
                trend = 'insufficient_data'

            return {
                'trend': trend,
                'avg_score': avg_score,
                'session_count': len(scores),
                'recent_scores': scores[:5]
            }
        except Exception as e:
            print(f"❌ Performance trend error: {e}")
            return {'trend': 'error', 'avg_score': 0, 'session_count': 0}

    # ============================================================
    # UTILITY METHODS
    # ============================================================

    def delete_user_data(self, user_id: str) -> bool:
        """Delete user's resume data from vector store"""
        try:
            # Get all IDs for this user
            results = self.collection.get(
                where={"user_id": user_id},
                include=[]
            )

            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
                print(f"✅ Deleted {len(results['ids'])} chunks for user {user_id}")
                return True
            return False
        except Exception as e:
            print(f"❌ Delete error: {e}")
            return False

    def get_user_count(self) -> int:
        """Get total number of users with resumes"""
        try:
            results = self.collection.get(include=["metadatas"])
            if results and results['metadatas']:
                user_ids = set(meta.get('user_id') for meta in results['metadatas'])
                return len(user_ids)
            return 0
        except:
            return 0

    def get_vector_count(self) -> int:
        """Get total number of vectors in store"""
        try:
            return self.collection.count()
        except:
            return 0


# Global instance
rag_engine = RAGEngine()


# Example usage
if __name__ == "__main__":
    print("Testing RAG Engine...")

    # Test resume analysis
    test_resume = """
    John Doe
    Senior Software Engineer

    Experience:
    - 5 years of Python development
    - Built microservices with FastAPI and Django
    - Experience with AWS, Docker, Kubernetes
    - Led team of 4 developers

    Skills: Python, JavaScript, React, PostgreSQL, Redis, Docker, AWS

    Projects:
    - E-commerce platform handling 1M+ requests/day
    - Real-time analytics dashboard
    - Payment processing system
    """

    analysis = rag_engine.analyze_resume(test_resume, "test_user_123")
    print(f"\nAnalysis: {analysis}")

    # Test context retrieval
    context = rag_engine.get_user_context("test_user_123")
    print(f"\nContext length: {len(context)} chars")

    # Test CRAG
    crag_result = rag_engine.get_user_context_with_crag("test_user_123", "technical interview")
    print(f"\nCRAG Relevance: {crag_result['relevance_score']:.2f}")
    print(f"Skills: {crag_result['skills']}")
    print(f"Experience: {crag_result['experience_years']} years")
