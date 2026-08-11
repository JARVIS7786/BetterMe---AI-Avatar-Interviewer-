"""
LLM Service for AI Interviewer
Groq API integration with CRAG question generation and answer evaluation
CRITICAL: Only generates situational/application-based questions, NO definitions
"""

import os
import re
import json
from typing import List, Dict, Optional
from dotenv import load_dotenv
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential

load_dotenv()


class LLMService:
    """Groq API wrapper for interview question generation and evaluation"""

    def __init__(self):
        self.api_key = os.getenv('GROQ_API_KEY')
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")

        self.client = Groq(api_key=self.api_key)
        self.model_name = "llama3-70b-8192"
        self.is_loaded = True

        print(f"OK: LLM Service initialized: {self.model_name}")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _call_groq(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 2048) -> str:
        """
        Call Groq API with retry logic
        Retries 3 times with exponential backoff
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=0.9,
                stream=False
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"ERROR: Groq API error: {e}")
            raise

    def _is_definition_question(self, question: str) -> bool:
        """
        Check if question is a direct definition question (BLOCKED)
        Returns True if question should be blocked
        """
        question_lower = question.lower()

        # Blocked patterns
        blocked_patterns = [
            r'\bwhat is\b',
            r'\bwhat are\b',
            r'\bdefine\b',
            r'\bexplain the concept\b',
            r'\bexplain what\b',
            r'\bwhat does .+ mean\b',
            r'\bwhat\'s the definition\b',
            r'\bwhat\'s the difference between\b',
            r'\blist the .+ of\b',
            r'\bname .+ types of\b',
        ]

        for pattern in blocked_patterns:
            if re.search(pattern, question_lower):
                print(f"🚫 Blocked definition question: {question[:50]}...")
                return True

        return False

    def _validate_situational_question(self, question: str) -> bool:
        """
        Validate that question is situational/application-based
        Returns True if question is valid
        """
        # First check: block definition questions
        if self._is_definition_question(question):
            return False

        # Second check: ensure it's situational
        question_lower = question.lower()

        situational_indicators = [
            'you are', 'you\'re', 'imagine you', 'suppose you',
            'how would you', 'how could you', 'what would you',
            'design a', 'build a', 'implement a', 'create a',
            'your team', 'your project', 'your application',
            'scenario:', 'situation:', 'given that'
        ]

        has_situational = any(indicator in question_lower for indicator in situational_indicators)

        if not has_situational:
            print(f"WARNING:  Question lacks situational context: {question[:50]}...")
            return False

        return True

    def generate_situational_questions(
        self,
        context: str,
        interview_type: str,
        num_questions: int = 5,
        difficulty: str = "medium"
    ) -> List[Dict]:
        """
        Generate ONLY situational/application-based interview questions
        Uses CRAG-evaluated context to create personalized scenarios

        Args:
            context: Candidate context from CRAG (resume + past sessions)
            interview_type: "technical", "behavioral", or "mixed"
            num_questions: Number of questions to generate
            difficulty: "easy", "medium", or "hard"

        Returns:
            List of question dictionaries with id, question, type, difficulty
        """
        print(f"🎯 Generating {num_questions} {difficulty} {interview_type} questions...")

        # Build system prompt
        system_prompt = f"""You are an expert technical interviewer. Your job is to create SITUATIONAL, APPLICATION-BASED interview questions.

CRITICAL RULES:
1. NEVER ask definition questions like "What is X?" or "Define Y" or "Explain the concept of Z"
2. ALWAYS frame questions as real-world scenarios or problems
3. Start with "You are...", "Imagine you...", "How would you...", "Design a...", etc.
4. Questions should test practical application, not memorized definitions
5. Use the candidate's background to create relevant scenarios

INTERVIEW TYPE: {interview_type}
DIFFICULTY: {difficulty}

DIFFICULTY GUIDELINES:
- Easy: Simple scenarios with clear constraints, single-component problems
- Medium: Multi-component systems, trade-off decisions, moderate complexity
- Hard: Large-scale systems, complex trade-offs, architectural decisions, edge cases

CANDIDATE CONTEXT:
{context[:1500]}

Generate {num_questions} situational questions. Return ONLY a JSON array with this exact format:
[
  {{
    "question": "You are building a real-time chat application that needs to support 10,000 concurrent users. How would you design the backend architecture to handle message delivery with minimal latency?",
    "type": "{interview_type}",
    "difficulty": "{difficulty}",
    "expected_answer_hints": "Consider WebSockets, message queues, database design, caching strategies"
  }}
]

NO explanations, NO markdown, ONLY the JSON array."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate {num_questions} {difficulty} {interview_type} situational questions based on the candidate's background."}
        ]

        try:
            # Call Groq API
            response = self._call_groq(messages, temperature=0.8, max_tokens=2048)

            # Parse JSON response
            # Remove markdown code blocks if present
            response = response.strip()
            if response.startswith('```'):
                response = re.sub(r'^```json?\s*', '', response)
                response = re.sub(r'\s*```$', '', response)

            questions_data = json.loads(response)

            # Validate and filter questions
            validated_questions = []
            for idx, q in enumerate(questions_data):
                question_text = q.get('question', '')

                if self._validate_situational_question(question_text):
                    validated_questions.append({
                        'id': f"q_{idx + 1}",
                        'question': question_text,
                        'type': q.get('type', interview_type),
                        'difficulty': q.get('difficulty', difficulty),
                        'expected_answer_hints': q.get('expected_answer_hints', '')
                    })
                else:
                    print(f"ERROR: Rejected question: {question_text[:80]}...")

            # If we don't have enough valid questions, regenerate
            if len(validated_questions) < num_questions:
                print(f"WARNING:  Only {len(validated_questions)}/{num_questions} valid questions. Regenerating...")
                # Recursive call with stricter prompt
                return self._regenerate_with_stricter_prompt(context, interview_type, num_questions, difficulty)

            print(f"OK: Generated {len(validated_questions)} valid situational questions")
            return validated_questions[:num_questions]

        except json.JSONDecodeError as e:
            print(f"ERROR: JSON parse error: {e}")
            print(f"Response: {response[:200]}...")
            # Fallback: return generic situational questions
            return self._get_fallback_questions(interview_type, difficulty, num_questions)

        except Exception as e:
            print(f"ERROR: Question generation error: {e}")
            return self._get_fallback_questions(interview_type, difficulty, num_questions)

    def _regenerate_with_stricter_prompt(
        self,
        context: str,
        interview_type: str,
        num_questions: int,
        difficulty: str
    ) -> List[Dict]:
        """Regenerate with even stricter situational requirements"""
        system_prompt = f"""You are an expert interviewer. Generate ONLY scenario-based questions.

MANDATORY FORMAT - Every question MUST start with one of these:
- "You are building..."
- "You're working on..."
- "Imagine you need to..."
- "Your team is developing..."
- "Design a system that..."
- "How would you implement..."
- "You've been asked to create..."

ABSOLUTELY FORBIDDEN:
- "What is..."
- "Define..."
- "Explain..."
- "What are the differences..."
- "List the..."

CONTEXT: {context[:1000]}

Generate {num_questions} {difficulty} {interview_type} questions. Return JSON array only."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate {num_questions} scenario-based questions."}
        ]

        try:
            response = self._call_groq(messages, temperature=0.9, max_tokens=2048)
            response = response.strip()
            if response.startswith('```'):
                response = re.sub(r'^```json?\s*', '', response)
                response = re.sub(r'\s*```$', '', response)

            questions_data = json.loads(response)
            validated = []

            for idx, q in enumerate(questions_data):
                question_text = q.get('question', '')
                if self._validate_situational_question(question_text):
                    validated.append({
                        'id': f"q_{idx + 1}",
                        'question': question_text,
                        'type': interview_type,
                        'difficulty': difficulty,
                        'expected_answer_hints': q.get('expected_answer_hints', '')
                    })

            if len(validated) >= num_questions:
                return validated[:num_questions]
            else:
                # Last resort: use fallback
                return self._get_fallback_questions(interview_type, difficulty, num_questions)

        except:
            return self._get_fallback_questions(interview_type, difficulty, num_questions)

    def _get_fallback_questions(self, interview_type: str, difficulty: str, num_questions: int) -> List[Dict]:
        """Fallback situational questions if generation fails"""
        fallback_questions = {
            'technical': {
                'easy': [
                    "You're building a todo list application. How would you design the data model to support user authentication and task management?",
                    "Your team needs to add a search feature to an existing web application. How would you implement it?",
                    "You're tasked with improving the load time of a slow web page. What steps would you take to diagnose and fix the issue?",
                ],
                'medium': [
                    "You're designing a URL shortener service like bit.ly. How would you architect the system to handle millions of requests per day?",
                    "Your application needs to process uploaded images and generate thumbnails. How would you design this feature to handle high traffic?",
                    "You're building an e-commerce checkout system. How would you ensure data consistency when processing payments?",
                ],
                'hard': [
                    "You're designing a distributed caching system for a global application. How would you handle cache invalidation across multiple regions?",
                    "Your company needs a real-time analytics dashboard processing billions of events daily. How would you architect this system?",
                    "You're building a ride-sharing app's matching algorithm. How would you design it to efficiently match drivers with riders in real-time?",
                ]
            },
            'behavioral': {
                'easy': [
                    "Describe a situation where you had to learn a new technology quickly for a project. How did you approach it?",
                    "Tell me about a time when you received constructive criticism. How did you respond?",
                    "You're working with a team member who consistently misses deadlines. How would you handle this situation?",
                ],
                'medium': [
                    "Describe a project where you had to make a significant technical decision with limited information. How did you proceed?",
                    "Tell me about a time when you had to convince your team to adopt a different approach. What was your strategy?",
                    "You discover a critical bug in production right before a major release. Walk me through your decision-making process.",
                ],
                'hard': [
                    "Describe a situation where you had to balance technical debt against new feature development. How did you make the decision?",
                    "Tell me about a time when you had to lead a project that was failing. What actions did you take to turn it around?",
                    "You're faced with a conflict between business requirements and engineering best practices. How would you navigate this?",
                ]
            }
        }

        # Get questions for the type and difficulty
        question_pool = fallback_questions.get(interview_type, fallback_questions['technical']).get(difficulty, fallback_questions['technical']['medium'])

        # Return requested number of questions
        selected = question_pool[:num_questions]
        return [
            {
                'id': f"q_{idx + 1}",
                'question': q,
                'type': interview_type,
                'difficulty': difficulty,
                'expected_answer_hints': ''
            }
            for idx, q in enumerate(selected)
        ]

    def evaluate_answer_quality(self, question: str, answer: str, context: str = "") -> Dict:
        """
        Evaluate candidate's answer quality
        Returns score (0-100) and feedback for difficulty escalation

        Args:
            question: The interview question
            answer: Candidate's answer
            context: Additional context (optional)

        Returns:
            {
                'score': 0-100,
                'feedback': str,
                'next_difficulty': 'easy'|'medium'|'hard',
                'strengths': [str],
                'improvements': [str]
            }
        """
        if not answer or len(answer.strip()) < 10:
            return {
                'score': 0,
                'feedback': 'Answer too short or empty',
                'next_difficulty': 'easy',
                'strengths': [],
                'improvements': ['Provide more detailed answers']
            }

        system_prompt = """You are an expert technical interviewer evaluating a candidate's answer.

Evaluate based on:
1. Technical accuracy and depth
2. Practical application and real-world thinking
3. Communication clarity
4. Problem-solving approach
5. Consideration of trade-offs and edge cases

Return a JSON object with this exact format:
{
  "score": 75,
  "feedback": "Good understanding of core concepts...",
  "next_difficulty": "medium",
  "strengths": ["Clear explanation", "Considered edge cases"],
  "improvements": ["Could discuss scalability more"]
}

Score guidelines:
- 0-40: Poor understanding, major gaps
- 41-60: Basic understanding, needs improvement
- 61-80: Good understanding, solid answer
- 81-100: Excellent, comprehensive answer

Next difficulty:
- Score < 50: easy
- Score 50-75: medium
- Score > 75: hard"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {question}\n\nCandidate's Answer: {answer}\n\nContext: {context}\n\nEvaluate this answer."}
        ]

        try:
            response = self._call_groq(messages, temperature=0.3, max_tokens=1024)

            # Parse JSON
            response = response.strip()
            if response.startswith('```'):
                response = re.sub(r'^```json?\s*', '', response)
                response = re.sub(r'\s*```$', '', response)

            evaluation = json.loads(response)

            return {
                'score': evaluation.get('score', 50),
                'feedback': evaluation.get('feedback', ''),
                'next_difficulty': evaluation.get('next_difficulty', 'medium'),
                'strengths': evaluation.get('strengths', []),
                'improvements': evaluation.get('improvements', [])
            }

        except Exception as e:
            print(f"ERROR: Answer evaluation error: {e}")
            # Fallback: basic length-based scoring
            word_count = len(answer.split())
            score = min(word_count * 2, 70)  # Cap at 70 for fallback

            return {
                'score': score,
                'feedback': 'Evaluation unavailable',
                'next_difficulty': 'medium' if score > 50 else 'easy',
                'strengths': [],
                'improvements': []
            }

    def evaluate_context_relevance(self, context: str, query: str) -> float:
        """
        CRAG: Evaluate relevance of retrieved context
        Returns score 0.0-1.0

        Args:
            context: Retrieved context from RAG
            query: User query or interview requirements

        Returns:
            Relevance score (0.0 = irrelevant, 1.0 = highly relevant)
        """
        if not context or len(context.strip()) < 20:
            return 0.0

        system_prompt = """You are evaluating the relevance of retrieved context for generating interview questions.

Score the context relevance from 0.0 to 1.0:
- 1.0: Highly relevant, contains specific skills/experience directly applicable
- 0.7-0.9: Relevant, contains useful background information
- 0.4-0.6: Somewhat relevant, limited useful information
- 0.0-0.3: Not relevant, generic or insufficient information

Return ONLY a JSON object:
{
  "relevance_score": 0.85,
  "reasoning": "Context contains specific technical skills and project experience"
}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context: {context[:1000]}\n\nQuery: {query}\n\nEvaluate relevance."}
        ]

        try:
            response = self._call_groq(messages, temperature=0.2, max_tokens=256)

            response = response.strip()
            if response.startswith('```'):
                response = re.sub(r'^```json?\s*', '', response)
                response = re.sub(r'\s*```$', '', response)

            result = json.loads(response)
            score = result.get('relevance_score', 0.5)

            print(f"📊 Context relevance: {score:.2f} - {result.get('reasoning', '')[:50]}...")
            return float(score)

        except Exception as e:
            print(f"ERROR: Context evaluation error: {e}")
            # Fallback: basic length-based relevance
            return 0.5 if len(context) > 100 else 0.3


# Global instance
llm_service = LLMService()


# Example usage
if __name__ == "__main__":
    print("Testing LLM Service...")

    # Test question generation
    test_context = """
    Senior Software Engineer with 5 years of experience in Python and React.
    Built scalable microservices handling 1M+ requests/day.
    Experience with AWS, Docker, Kubernetes, PostgreSQL, Redis.
    Led team of 4 developers on e-commerce platform.
    """

    questions = llm_service.generate_situational_questions(
        context=test_context,
        interview_type="technical",
        num_questions=3,
        difficulty="medium"
    )

    print("\n" + "="*60)
    print("GENERATED QUESTIONS:")
    print("="*60)
    for q in questions:
        print(f"\n{q['id']}: {q['question']}")
        print(f"   Type: {q['type']} | Difficulty: {q['difficulty']}")

    # Test answer evaluation
    test_answer = """
    I would design the system using a microservices architecture with separate services
    for user management, product catalog, and order processing. I'd use Redis for caching
    frequently accessed data and implement a message queue for asynchronous processing.
    For the database, I'd use PostgreSQL with read replicas for scalability.
    """

    evaluation = llm_service.evaluate_answer_quality(
        question=questions[0]['question'],
        answer=test_answer
    )

    print("\n" + "="*60)
    print("ANSWER EVALUATION:")
    print("="*60)
    print(f"Score: {evaluation['score']}/100")
    print(f"Next Difficulty: {evaluation['next_difficulty']}")
    print(f"Feedback: {evaluation['feedback']}")
