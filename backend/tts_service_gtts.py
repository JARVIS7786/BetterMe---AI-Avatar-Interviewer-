"""
TTS Service for AI Interviewer (Simplified - No Dependency Conflicts)
Using gTTS (Google Text-to-Speech) + Groq Whisper STT
"""

import os
import io
from typing import Optional, List, Dict
from dotenv import load_dotenv
from groq import Groq
from gtts import gTTS
from pydub import AudioSegment

load_dotenv()


class TTSService:
    """Text-to-Speech and Speech-to-Text service using gTTS (FREE)"""

    def __init__(self):
        # Initialize Groq client for Whisper STT (FREE)
        groq_api_key = os.getenv('GROQ_API_KEY')
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")

        self.groq_client = Groq(api_key=groq_api_key)

        # TTS Configuration
        self.default_voice = 'female'
        self.model_name = "Google TTS (gTTS - Female)"
        self.is_loaded = True

        # Available voices
        self.available_voices = {
            'cara': {'gender': 'female', 'description': 'Clear female voice (Google TTS)'},
            'kevin': {'gender': 'male', 'description': 'Male voice (Google TTS)'}
        }

        print(f"✅ TTS Service initialized: {self.model_name}")
        print(f"   Using FREE Google TTS (gTTS)")

    def generate_speech_to_bytes(self, text: str, speaker: str = None) -> bytes:
        """
        Generate speech from text using gTTS (FREE)
        Returns audio as WAV bytes (no file saving)

        Args:
            text: Text to convert to speech
            speaker: Voice name ('cara' for female, 'kevin' for male)

        Returns:
            Audio bytes in WAV format
        """
        print(f"🎤 Generating speech with Google TTS (FREE)")

        try:
            # Determine language and slow parameter
            # gTTS doesn't have male/female voices, but we can adjust speed
            slow = False

            # Create gTTS object
            tts = gTTS(text=text[:500], lang='en', slow=slow)  # Limit to 500 chars

            # Save to BytesIO buffer as MP3
            mp3_buffer = io.BytesIO()
            tts.write_to_fp(mp3_buffer)
            mp3_buffer.seek(0)

            # Convert MP3 to WAV using pydub
            audio = AudioSegment.from_mp3(mp3_buffer)

            # Export as WAV to BytesIO
            wav_buffer = io.BytesIO()
            audio.export(wav_buffer, format='wav')
            wav_buffer.seek(0)

            audio_bytes = wav_buffer.read()

            print(f"✅ Generated {len(audio_bytes)} bytes of audio (FREE)")
            return audio_bytes

        except Exception as e:
            print(f"❌ TTS generation error: {e}")
            # Return empty bytes on error
            return b''

    def generate_speech_with_lipsync(self, text: str, speaker: str = None) -> Optional[Dict]:
        """
        DEPRECATED: Baymax avatar doesn't use lip-sync
        This method is kept for backward compatibility but returns None for viseme_data

        Args:
            text: Text to convert to speech
            speaker: Voice name

        Returns:
            Dict with audio_bytes and None for viseme_data
        """
        audio_bytes = self.generate_speech_to_bytes(text, speaker)

        return {
            'audio_bytes': audio_bytes,
            'viseme_data': None,  # Baymax doesn't need visemes
            'duration_ms': len(audio_bytes) // 44  # Rough estimate
        }

    def transcribe_audio(self, audio_file_path: str) -> Optional[str]:
        """
        Transcribe audio using Groq Whisper (FREE, ultra-fast)

        Args:
            audio_file_path: Path to audio file

        Returns:
            Transcribed text or None on error
        """
        try:
            print(f"🎧 Transcribing audio with Groq Whisper...")

            with open(audio_file_path, 'rb') as audio_file:
                transcription = self.groq_client.audio.transcriptions.create(
                    file=(audio_file_path, audio_file.read()),
                    model="whisper-large-v3",
                    response_format="json",
                    language="en",
                    temperature=0.0
                )

            text = transcription.text
            print(f"✅ Transcribed: {text[:100]}...")
            return text

        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return None

    def transcribe_audio_bytes(self, audio_bytes: bytes, filename: str = "audio.wav") -> Optional[str]:
        """
        Transcribe audio from bytes using Groq Whisper

        Args:
            audio_bytes: Audio data as bytes
            filename: Filename hint for Groq API

        Returns:
            Transcribed text or None on error
        """
        try:
            print(f"🎧 Transcribing audio bytes with Groq Whisper...")

            transcription = self.groq_client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                response_format="json",
                language="en",
                temperature=0.0
            )

            text = transcription.text
            print(f"✅ Transcribed: {text[:100]}...")
            return text

        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return None

    def get_available_speakers(self) -> List[Dict]:
        """
        Get list of available TTS voices

        Returns:
            List of voice configurations
        """
        return [
            {
                'id': 'cara',
                'name': 'Cara',
                'gender': 'female',
                'description': 'Clear female voice (Google TTS)',
                'preview_text': 'Hello, I am Cara, your AI interviewer.'
            },
            {
                'id': 'kevin',
                'name': 'Kevin',
                'gender': 'male',
                'description': 'Male voice (Google TTS)',
                'preview_text': 'Hello, I am Kevin, your AI interviewer.'
            }
        ]


# Global instance
tts_service = TTSService()


# Example usage
if __name__ == "__main__":
    print("Testing TTS Service...")

    # Test TTS
    test_text = "Hello, I am your AI interviewer. Let's begin the interview."
    audio_bytes = tts_service.generate_speech_to_bytes(test_text, speaker='cara')
    print(f"Generated {len(audio_bytes)} bytes of audio")

    # Test available speakers
    speakers = tts_service.get_available_speakers()
    print(f"Available speakers: {speakers}")
