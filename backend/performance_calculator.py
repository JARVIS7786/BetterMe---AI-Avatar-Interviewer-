"""
Performance Calculation Service for BetterME
Tracks and calculates user performance metrics for interview sessions
"""

from typing import Dict, List, Optional
from datetime import datetime
import statistics

class PerformanceCalculator:
    """
    Calculates various performance metrics for interview sessions
    """
    
    def __init__(self):
        self.metrics = {
            'response_time': [],
            'answer_quality': [],
            'confidence_score': [],
            'completion_rate': 0,
        }
    
    def calculate_session_performance(self, session_data: Dict) -> Dict:
        """
        Calculate overall performance for a single session
        
        Args:
            session_data: {
                'questions': [list of questions],
                'answers': [list of user answers],
                'timestamps': [list of response times],
                'session_duration': total time in seconds,
                'interview_type': 'technical'/'behavioral'/'mixed'
            }
        
        Returns:
            {
                'overall_score': 0-100,
                'response_time_avg': average time per question,
                'completion_rate': percentage of questions answered,
                'confidence_score': 0-100,
                'areas_of_improvement': [list of suggestions],
                'strengths': [list of strong points]
            }
        """
        
        total_questions = len(session_data.get('questions', []))
        answered_questions = len(session_data.get('answers', []))
        
        # 1. Completion Rate
        completion_rate = (answered_questions / total_questions * 100) if total_questions > 0 else 0
        
        # 2. Average Response Time
        timestamps = session_data.get('timestamps', [])
        avg_response_time = statistics.mean(timestamps) if timestamps else 0
        
        # 3. Answer Quality Score (based on answer length and keywords)
        quality_scores = []
        for answer in session_data.get('answers', []):
            quality_scores.append(self._calculate_answer_quality(answer))
        
        avg_quality = statistics.mean(quality_scores) if quality_scores else 0
        
        # 4. Response Time Score (faster is better, but not too fast)
        response_time_score = self._calculate_response_time_score(avg_response_time)
        
        # 5. Confidence Score (based on answer length, clarity, no filler words)
        confidence_score = self._calculate_confidence_score(session_data.get('answers', []))
        
        # 6. Overall Score (weighted average)
        overall_score = (
            completion_rate * 0.2 +           # 20% weight
            avg_quality * 0.4 +                # 40% weight
            response_time_score * 0.2 +        # 20% weight
            confidence_score * 0.2             # 20% weight
        )
        
        # 7. Identify areas of improvement and strengths
        areas_of_improvement = self._identify_improvements(
            completion_rate, avg_quality, response_time_score, confidence_score
        )
        
        strengths = self._identify_strengths(
            completion_rate, avg_quality, response_time_score, confidence_score
        )
        
        return {
            'overall_score': round(overall_score, 2),
            'completion_rate': round(completion_rate, 2),
            'response_time_avg': round(avg_response_time, 2),
            'answer_quality_score': round(avg_quality, 2),
            'response_time_score': round(response_time_score, 2),
            'confidence_score': round(confidence_score, 2),
            'questions_answered': answered_questions,
            'total_questions': total_questions,
            'session_duration': session_data.get('session_duration', 0),
            'areas_of_improvement': areas_of_improvement,
            'strengths': strengths,
            'grade': self._get_grade(overall_score)
        }
    
    def _calculate_answer_quality(self, answer: str) -> float:
        """
        Calculate quality score for a single answer
        Based on: length, structure, keywords
        """
        if not answer:
            return 0
        
        score = 0
        words = answer.split()
        word_count = len(words)
        
        # Length scoring (optimal: 50-200 words)
        if 50 <= word_count <= 200:
            score += 40
        elif 30 <= word_count < 50 or 200 < word_count <= 300:
            score += 30
        elif word_count >= 10:
            score += 20
        
        # Structure scoring (paragraphs, punctuation)
        if '.' in answer and answer.count('.') >= 2:
            score += 20
        
        # Professional keywords (shows thoughtfulness)
        professional_keywords = [
            'experience', 'project', 'team', 'achieved', 'developed',
            'implemented', 'managed', 'led', 'collaborated', 'result',
            'solution', 'challenge', 'learned', 'improved'
        ]
        
        keyword_count = sum(1 for keyword in professional_keywords if keyword.lower() in answer.lower())
        score += min(keyword_count * 5, 40)  # Max 40 points
        
        return min(score, 100)
    
    def _calculate_response_time_score(self, avg_time: float) -> float:
        """
        Calculate score based on response time
        Sweet spot: 45-120 seconds per question
        """
        if avg_time == 0:
            return 0
        
        # Optimal range: 45-120 seconds
        if 45 <= avg_time <= 120:
            return 100
        elif 30 <= avg_time < 45:
            return 80  # A bit rushed
        elif 120 < avg_time <= 180:
            return 85  # Taking time to think (good)
        elif 180 < avg_time <= 300:
            return 70  # Too slow
        elif avg_time < 30:
            return 60  # Too rushed
        else:
            return 50  # Way too slow
    
    def _calculate_confidence_score(self, answers: List[str]) -> float:
        """
        Calculate confidence based on answer characteristics
        """
        if not answers:
            return 0
        
        scores = []
        
        # Filler words to avoid
        filler_words = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally']
        
        for answer in answers:
            score = 100
            answer_lower = answer.lower()
            
            # Deduct for filler words
            filler_count = sum(answer_lower.count(filler) for filler in filler_words)
            score -= min(filler_count * 5, 30)
            
            # Bonus for concrete examples
            if any(word in answer_lower for word in ['for example', 'for instance', 'specifically']):
                score += 10
            
            # Bonus for quantifiable results
            if any(char.isdigit() for char in answer):
                score += 10
            
            scores.append(max(score, 0))
        
        return statistics.mean(scores) if scores else 0
    
    def _identify_improvements(self, completion, quality, response_time, confidence) -> List[str]:
        """
        Identify areas where user can improve
        """
        improvements = []
        
        if completion < 80:
            improvements.append("Try to answer all questions to maximize learning")
        
        if quality < 60:
            improvements.append("Provide more detailed answers with specific examples")
        
        if response_time < 60:
            improvements.append("Take more time to think through your answers")
        
        if confidence < 70:
            improvements.append("Reduce filler words and speak more confidently")
        
        if not improvements:
            improvements.append("Keep up the great work! Focus on consistency")
        
        return improvements
    
    def _identify_strengths(self, completion, quality, response_time, confidence) -> List[str]:
        """
        Identify user's strengths
        """
        strengths = []
        
        if completion >= 90:
            strengths.append("Excellent completion rate")
        
        if quality >= 80:
            strengths.append("High-quality, detailed answers")
        
        if 45 <= response_time <= 120:
            strengths.append("Well-paced responses")
        
        if confidence >= 80:
            strengths.append("Confident and clear communication")
        
        if not strengths:
            strengths.append("You're making progress!")
        
        return strengths
    
    def _get_grade(self, overall_score: float) -> str:
        """
        Convert numeric score to letter grade
        """
        if overall_score >= 90:
            return 'A+'
        elif overall_score >= 85:
            return 'A'
        elif overall_score >= 80:
            return 'A-'
        elif overall_score >= 75:
            return 'B+'
        elif overall_score >= 70:
            return 'B'
        elif overall_score >= 65:
            return 'B-'
        elif overall_score >= 60:
            return 'C+'
        elif overall_score >= 55:
            return 'C'
        elif overall_score >= 50:
            return 'C-'
        else:
            return 'D'
    
    def calculate_aggregate_performance(self, all_sessions: List[Dict]) -> Dict:
        """
        Calculate aggregate performance across all sessions
        
        Returns overall statistics and trends
        """
        if not all_sessions:
            return {
                'total_sessions': 0,
                'avg_performance': 0,
                'best_score': 0,
                'total_questions': 0,
                'improvement_trend': 'N/A'
            }
        
        total_sessions = len(all_sessions)
        all_scores = [session.get('overall_score', 0) for session in all_sessions]
        all_questions = sum(session.get('questions_answered', 0) for session in all_sessions)
        
        avg_performance = statistics.mean(all_scores) if all_scores else 0
        best_score = max(all_scores) if all_scores else 0
        
        # Calculate improvement trend (comparing recent vs earlier sessions)
        improvement_trend = 'N/A'
        if total_sessions >= 3:
            recent_avg = statistics.mean(all_scores[-3:])
            earlier_avg = statistics.mean(all_scores[:3])
            
            if recent_avg > earlier_avg + 5:
                improvement_trend = 'Improving 📈'
            elif recent_avg < earlier_avg - 5:
                improvement_trend = 'Declining 📉'
            else:
                improvement_trend = 'Stable ➡️'
        
        return {
            'total_sessions': total_sessions,
            'avg_performance': round(avg_performance, 2),
            'best_score': round(best_score, 2),
            'worst_score': round(min(all_scores), 2) if all_scores else 0,
            'total_questions': all_questions,
            'improvement_trend': improvement_trend,
            'avg_grade': self._get_grade(avg_performance)
        }


# Example usage
if __name__ == "__main__":
    calculator = PerformanceCalculator()
    
    # Example session data
    session_example = {
        'questions': ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
        'answers': [
            'In my previous role as a software developer, I worked on implementing a microservices architecture. This involved designing scalable APIs and ensuring seamless communication between services.',
            'I collaborated with a cross-functional team of 6 members. We held daily standups and used Agile methodologies to deliver features iteratively.',
            'The biggest challenge was migrating legacy code. I developed a phased approach, testing each module thoroughly before deployment.',
            'As a result, we reduced system downtime by 40% and improved response times by 25%.',
            'I learned the importance of documentation and clear communication in large-scale projects.'
        ],
        'timestamps': [75, 60, 90, 55, 70],  # seconds per question
        'session_duration': 450,  # total seconds
        'interview_type': 'technical'
    }
    
    # Calculate performance
    performance = calculator.calculate_session_performance(session_example)
    
    print("Session Performance Report:")
    print("=" * 50)
    print(f"Overall Score: {performance['overall_score']}/100 ({performance['grade']})")
    print(f"Completion Rate: {performance['completion_rate']}%")
    print(f"Average Response Time: {performance['response_time_avg']} seconds")
    print(f"Answer Quality: {performance['answer_quality_score']}/100")
    print(f"Confidence Score: {performance['confidence_score']}/100")
    print(f"\nStrengths:")
    for strength in performance['strengths']:
        print(f"  ✓ {strength}")
    print(f"\nAreas for Improvement:")
    for improvement in performance['areas_of_improvement']:
        print(f"  → {improvement}")
