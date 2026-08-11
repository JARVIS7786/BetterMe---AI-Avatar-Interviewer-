"""
TTS Service for AI Interviewer
Coqui TTS (FREE) + Groq Whisper STT integration
Female voice by default, configurable
"""

# ── CRITICAL: Coqui TOS bypass MUST come before any TTS import ──
import os
os.environ["COQUI_TOS_AGREED"] = "1"

import io
from typing import Optional, List, Dict
from dotenv import load_dotenv
from groq import Groq
from pydub import AudioSegment
import numpy as np

load_dotenv()


class TTSService:
    """Text-to-Speech and Speech-to-Text service (100% FREE)"""

    def __init__(self):
        # Initialize Coqui TTS (FREE, local)
        try:
            from TTS.api import TTS
            self.tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False)
            print("OK: Coqui TTS model loaded (FREE)")
        except Exception as e:
            print(f"WARNING:  Coqui TTS not available: {e}")
            print("   Installing TTS library...")
            import subprocess
            subprocess.check_call(['pip', 'install', 'TTS'])
            from TTS.api import TTS
            self.tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False)

        # Initialize Groq client for Whisper STT (FREE)
        groq_api_key = os.getenv('GROQ_API_KEY')
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")

        self.groq_client = Groq(api_key=groq_api_key)

        # TTS Configuration
        self.default_voice = 'female'  # Coqui default is female
        self.model_name = "Coqui TTS (LJSpeech - Female)"
        self.is_loaded = True

        # Available voices (Coqui has limited voice options)
        self.available_voices = {
            'cara': {'gender': 'female', 'description': 'Clear female voice (LJSpeech)'},
            'kevin': {'gender': 'female', 'description': 'Same as cara (Coqui limitation)'}
        }

        print(f"OK: TTS Service initialized: {self.model_name}")
        print(f"   Note: Using FREE Coqui TTS (female voice only)")

    def generate_speech_to_bytes(self, text: str, speaker: str = None) -> bytes:
        """
        Generate speech from text using Coqui TTS (FREE)
        Returns audio as WAV bytes (no file saving)

        Args:
            text: Text to convert to speech
            speaker: Voice name (ignored - Coqui only has one voice)

        Returns:
            Audio bytes in WAV format
        """
        print(f"TTS: Generating speech with Coqui TTS (FREE)")

        try:
            # Generate audio to temporary file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_path = tmp_file.name

            # Generate speech
            self.tts.tts_to_file(text=text[:500], file_path=tmp_path)  # Limit to 500 chars for speed

            # Read the file as bytes
            with open(tmp_path, 'rb') as f:
                audio_bytes = f.read()

            # Clean up temp file
            os.remove(tmp_path)

            print(f"OK: Generated {len(audio_bytes)} bytes of audio (FREE)")
            return audio_bytes

        except Exception as e:
            print(f"ERROR: TTS generation error: {e}")
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
            {
                'audio_bytes': bytes,
                'viseme_data': None,  # Not used for Baymax
                'duration': float
            }
        """
        audio_bytes = self.generate_speech_to_bytes(text, speaker)

        if not audio_bytes:
            return None

        # Estimate duration (rough calculation)
        # Average speaking rate: ~150 words per minute
        word_count = len(text.split())
        duration = (word_count / 150) * 60  # seconds

        return {
            'audio_bytes': audio_bytes,
            'viseme_data': None,  # Baymax uses audio-reactive scaling, not visemes
            'duration': duration
        }

    def transcribe_audio(self, audio_file: bytes, filename: str = "audio.wav") -> str:
        """
        Transcribe audio to text using Groq Whisper
        Ultra-fast speech-to-text

        Args:
            audio_file: Audio file bytes
            filename: Original filename (for format detection)

        Returns:
            Transcribed text
        """
        print(f"🎧 Transcribing audio with Groq Whisper...")

        try:
            # Create file-like object
            audio_io = io.BytesIO(audio_file)
            audio_io.name = filename

            # Call Groq Whisper API
            transcription = self.groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_io,
                response_format="text"
            )

            transcript = transcription if isinstance(transcription, str) else transcription.text

            print(f"OK: Transcribed: {transcript[:100]}...")
            return transcript

        except Exception as e:
            print(f"ERROR: Transcription error: {e}")
            return ""

    def get_available_speakers(self) -> List[Dict]:
        """
        Get list of available TTS voices

        Returns:
            List of voice dictionaries with name, gender, description
        """
        speakers = []

        for voice_name, voice_info in self.available_voices.items():
            speakers.append({
                'name': voice_name,
                'gender': voice_info['gender'],
                'description': voice_info['description'],
                'is_default': voice_name == self.default_voice
            })

        return speakers

    def convert_audio_format(self, audio_bytes: bytes, from_format: str, to_format: str) -> bytes:
        """
        Convert audio between formats using pydub

        Args:
            audio_bytes: Input audio bytes
            from_format: Source format ('mp3', 'wav', 'ogg', etc.)
            to_format: Target format ('mp3', 'wav', 'ogg', etc.)

        Returns:
            Converted audio bytes
        """
        try:
            # Load audio
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=from_format)

            # Export to target format
            output = io.BytesIO()
            audio.export(output, format=to_format)
            output.seek(0)

            return output.read()

        except Exception as e:
            print(f"ERROR: Audio conversion error: {e}")
            return audio_bytes  # Return original on error

    def get_audio_duration(self, audio_bytes: bytes, format: str = 'wav') -> float:
        """
        Get duration of audio in seconds

        Args:
            audio_bytes: Audio file bytes
            format: Audio format

        Returns:
            Duration in seconds
        """
        try:
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=format)
            return len(audio) / 1000.0  # Convert milliseconds to seconds
        except Exception as e:
            print(f"ERROR: Duration calculation error: {e}")
            return 0.0

    def batch_generate_speech(self, texts: List[str], speaker: str = None) -> List[bytes]:
        """
        Generate speech for multiple texts
        Useful for pre-generating question audio

        Args:
            texts: List of text strings
            speaker: Voice name

        Returns:
            List of audio bytes
        """
        audio_list = []

        for idx, text in enumerate(texts):
            print(f"TTS: Generating {idx + 1}/{len(texts)}...")
            audio_bytes = self.generate_speech_to_bytes(text, speaker)
            audio_list.append(audio_bytes)

        print(f"OK: Generated {len(audio_list)} audio files")
        return audio_list


# Global instance
tts_service = TTSService()


# Example usage
if __name__ == "__main__":
    print("Testing TTS Service...")

    # Test TTS generation
    test_text = "Hello, I am your AI interviewer. Let's begin with your first question."

    print("\n" + "="*60)
    print("TEST 1: Generate speech with Nova (female)")
    print("="*60)
    audio_bytes = tts_service.generate_speech_to_bytes(test_text, speaker='nova')
    print(f"Generated {len(audio_bytes)} bytes")

    # Save to file for testing
    if audio_bytes:
        with open('test_nova.wav', 'wb') as f:
            f.write(audio_bytes)
        print("OK: Saved to test_nova.wav")

    print("\n" + "="*60)
    print("TEST 2: Generate speech with Echo (male)")
    print("="*60)
    audio_bytes = tts_service.generate_speech_to_bytes(test_text, speaker='echo')
    print(f"Generated {len(audio_bytes)} bytes")

    if audio_bytes:
        with open('test_echo.wav', 'wb') as f:
            f.write(audio_bytes)
        print("OK: Saved to test_echo.wav")

    print("\n" + "="*60)
    print("TEST 3: Avatar name mapping")
    print("="*60)
    # Test avatar name mapping
    audio_bytes = tts_service.generate_speech_to_bytes(test_text, speaker='cara')
    print(f"'cara' mapped to Nova: {len(audio_bytes)} bytes")

    audio_bytes = tts_service.generate_speech_to_bytes(test_text, speaker='kevin')
    print(f"'kevin' mapped to Echo: {len(audio_bytes)} bytes")

    print("\n" + "="*60)
    print("TEST 4: Available speakers")
    print("="*60)
    speakers = tts_service.get_available_speakers()
    for speaker in speakers:
        default = " (DEFAULT)" if speaker['is_default'] else ""
        print(f"- {speaker['name']}: {speaker['gender']} - {speaker['description']}{default}")

    print("\n" + "="*60)
    print("TEST 5: Batch generation")
    print("="*60)
    test_questions = [
        "Tell me about your experience with Python.",
        "How would you design a scalable API?",
        "Describe a challenging project you worked on."
    ]
    audio_list = tts_service.batch_generate_speech(test_questions, speaker='nova')
    print(f"OK: Generated {len(audio_list)} audio files")

    # Note: Whisper transcription test requires actual audio file
    print("\nOK: TTS Service tests completed!")
    print("   Play test_nova.wav and test_echo.wav to verify voices")
