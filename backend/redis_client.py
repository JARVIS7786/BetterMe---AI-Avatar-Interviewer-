"""
Redis Client for AI Interviewer
Handles caching for scenarios, sessions, and candidate context
"""

import redis
import json
import os
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()


class RedisClient:
    """Redis caching layer for the AI interviewer system"""

    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', None)
        self.host = os.getenv('REDIS_HOST', 'localhost')
        self.port = int(os.getenv('REDIS_PORT', 6379))
        self.password = os.getenv('REDIS_PASSWORD', None)
        self.client: Optional[redis.Redis] = None
        self.is_connected = False

        try:
            self.connect()
        except Exception as e:
            print(f"WARNING:  Redis connection failed: {e}")
            print("   Continuing without cache...")

    def connect(self):
        """Establish connection to Redis (supports both local and Upstash)"""
        try:
            # If REDIS_URL is provided (Upstash format), use it
            if self.redis_url:
                self.client = redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    ssl_cert_reqs=None  # Required for Upstash TLS
                )
                print(f"OK: Redis connected via URL (Upstash)")
            else:
                # Traditional host/port connection (local Redis)
                self.client = redis.Redis(
                    host=self.host,
                    port=self.port,
                    password=self.password,
                    db=0,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                print(f"OK: Redis connected: {self.host}:{self.port}")

            # Test connection
            self.client.ping()
            self.is_connected = True
        except Exception as e:
            self.is_connected = False
            self.client = None
            raise e

    def ping(self) -> bool:
        """Check if Redis is connected"""
        if not self.client:
            return False
        try:
            return self.client.ping()
        except:
            self.is_connected = False
            return False

    # ============================================================
    # SCENARIO CACHING
    # ============================================================

    def cache_scenario(self, interview_type: str, difficulty: str, questions: list, ttl: int = 3600):
        """
        Cache generated interview questions
        Key: scenario:{interview_type}:{difficulty}
        TTL: 1 hour (3600 seconds)
        """
        if not self.is_connected or not self.client:
            return False

        try:
            key = f"scenario:{interview_type}:{difficulty}"
            value = json.dumps(questions)
            self.client.setex(key, ttl, value)
            print(f"Loading: Cached scenario: {key}")
            return True
        except Exception as e:
            print(f"ERROR: Cache write failed: {e}")
            return False

    def get_cached_scenario(self, interview_type: str, difficulty: str) -> Optional[list]:
        """
        Retrieve cached interview questions
        Returns None if not found or expired
        """
        if not self.is_connected or not self.client:
            return None

        try:
            key = f"scenario:{interview_type}:{difficulty}"
            cached = self.client.get(key)

            if cached:
                print(f"Cache hit: Cache hit: {key}")
                return json.loads(cached)
            else:
                print(f"Cache miss: Cache miss: {key}")
                return None
        except Exception as e:
            print(f"ERROR: Cache read failed: {e}")
            return None

    # ============================================================
    # SESSION STATE
    # ============================================================

    def save_session_state(self, session_id: str, state: dict, ttl: int = 86400):
        """
        Save interview session state
        Key: session:{session_id}
        TTL: 24 hours (86400 seconds)
        """
        if not self.is_connected or not self.client:
            return False

        try:
            key = f"session:{session_id}"
            value = json.dumps(state)
            self.client.setex(key, ttl, value)
            return True
        except Exception as e:
            print(f"ERROR: Session save failed: {e}")
            return False

    def get_session_state(self, session_id: str) -> Optional[dict]:
        """Retrieve interview session state"""
        if not self.is_connected or not self.client:
            return None

        try:
            key = f"session:{session_id}"
            cached = self.client.get(key)
            return json.loads(cached) if cached else None
        except Exception as e:
            print(f"ERROR: Session read failed: {e}")
            return None

    def delete_session_state(self, session_id: str) -> bool:
        """Delete session state (after completion)"""
        if not self.is_connected or not self.client:
            return False

        try:
            key = f"session:{session_id}"
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"ERROR: Session delete failed: {e}")
            return False

    # ============================================================
    # CANDIDATE CONTEXT CACHING
    # ============================================================

    def cache_candidate_context(self, user_id: str, context: dict, ttl: int = 3600):
        """
        Cache candidate context (resume + past sessions summary)
        Key: context:{user_id}
        TTL: 1 hour (3600 seconds)
        Reduces ChromaDB queries
        """
        if not self.is_connected or not self.client:
            return False

        try:
            key = f"context:{user_id}"
            value = json.dumps(context)
            self.client.setex(key, ttl, value)
            print(f"Loading: Cached context for user: {user_id}")
            return True
        except Exception as e:
            print(f"ERROR: Context cache failed: {e}")
            return False

    def get_cached_context(self, user_id: str) -> Optional[dict]:
        """Retrieve cached candidate context"""
        if not self.is_connected or not self.client:
            return None

        try:
            key = f"context:{user_id}"
            cached = self.client.get(key)

            if cached:
                print(f"Cache hit: Context cache hit: {user_id}")
                return json.loads(cached)
            else:
                print(f"Cache miss: Context cache miss: {user_id}")
                return None
        except Exception as e:
            print(f"ERROR: Context read failed: {e}")
            return None

    def invalidate_context(self, user_id: str) -> bool:
        """Invalidate cached context (after resume update)"""
        if not self.is_connected or not self.client:
            return False

        try:
            key = f"context:{user_id}"
            self.client.delete(key)
            print(f"Deleted:  Invalidated context: {user_id}")
            return True
        except Exception as e:
            print(f"ERROR: Context invalidation failed: {e}")
            return False

    # ============================================================
    # GENERIC OPERATIONS
    # ============================================================

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Generic set operation"""
        if not self.is_connected or not self.client:
            return False

        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)

            if ttl:
                self.client.setex(key, ttl, value)
            else:
                self.client.set(key, value)
            return True
        except Exception as e:
            print(f"ERROR: Redis SET failed: {e}")
            return False

    def get(self, key: str) -> Optional[Any]:
        """Generic get operation"""
        if not self.is_connected or not self.client:
            return None

        try:
            value = self.client.get(key)
            if value:
                try:
                    return json.loads(value)
                except:
                    return value
            return None
        except Exception as e:
            print(f"ERROR: Redis GET failed: {e}")
            return None

    def delete(self, key: str) -> bool:
        """Generic delete operation"""
        if not self.is_connected or not self.client:
            return False

        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"ERROR: Redis DELETE failed: {e}")
            return False

    def flush_all(self) -> bool:
        """Flush all keys (use carefully!)"""
        if not self.is_connected or not self.client:
            return False

        try:
            self.client.flushall()
            print("Deleted:  Redis flushed all keys")
            return True
        except Exception as e:
            print(f"ERROR: Redis FLUSHALL failed: {e}")
            return False

    def get_stats(self) -> dict:
        """Get Redis statistics"""
        if not self.is_connected or not self.client:
            return {"connected": False}

        try:
            info = self.client.info()
            return {
                "connected": True,
                "used_memory_human": info.get('used_memory_human', 'N/A'),
                "total_keys": self.client.dbsize(),
                "uptime_days": info.get('uptime_in_days', 0)
            }
        except Exception as e:
            print(f"ERROR: Redis stats failed: {e}")
            return {"connected": False, "error": str(e)}


# Global instance
redis_client = RedisClient()


# Example usage
if __name__ == "__main__":
    print("Testing Redis Client...")

    # Test connection
    if redis_client.ping():
        print("OK: Redis is alive!")

    # Test scenario caching
    test_questions = [
        {"id": "q1", "question": "Design a scalable payment system", "difficulty": "medium"},
        {"id": "q2", "question": "How would you handle race conditions?", "difficulty": "hard"}
    ]

    redis_client.cache_scenario("technical", "medium", test_questions)
    retrieved = redis_client.get_cached_scenario("technical", "medium")
    print(f"Retrieved: {retrieved}")

    # Test stats
    stats = redis_client.get_stats()
    print(f"Stats: {stats}")
