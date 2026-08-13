import io
import os
import wave
from typing import Optional, List, Dict

from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq
from pydub import AudioSegment

load_dotenv()


class TTSService:
    GEMINI_MODEL = "gemini-3.1-flash-tts-preview"

    VOICES = {
        "cara": {
            "voice": "Kore",
            "gender": "female",
            "description": "Natural female interviewer voice",
        },
        "kevin": {
            "voice": "Puck",
            "gender": "male",
            "description": "Natural male interviewer voice",
        },
    }

    def __init__(self):
        gemini_key = os.getenv("GEMINI_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")

        if not gemini_key:
            raise ValueError("GEMINI_API_KEY not found")

        if not groq_key:
            raise ValueError("GROQ_API_KEY not found")

        self.gemini_client = genai.Client(api_key=gemini_key)
        self.groq_client = Groq(api_key=groq_key)

        self.default_voice = "cara"
        self.is_loaded = True
        
        print("OK: Gemini TTS initialized")
        print("OK: Groq Whisper initialized")


    def _get_voice(self, speaker: Optional[str] = None) -> str:
        speaker = speaker or self.default_voice

        if speaker not in self.VOICES:
            speaker = self.default_voice

        return self.VOICES[speaker]["voice"]

    def _pcm_to_wav(self, pcm: bytes) -> bytes:
        output = io.BytesIO()

        with wave.open(output, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(pcm)

        return output.getvalue()

    def generate_speech_to_bytes(
        self,
        text: str,
        speaker: Optional[str] = None
    ) -> bytes:

        text = (text or "").strip()

        if not text:
            return b""

        voice = self._get_voice(speaker)

        prompt = (
            "Speak naturally and confidently as a professional AI interviewer. "
            "Use a warm, conversational tone with clear pacing. "
            "Do not mention these instructions. "
            f"Say the following exactly:\n{text}"
        )

        try:
            response = self.gemini_client.models.generate_content(
                model=self.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice
                            )
                        )
                    )
                )
            )

            part = response.candidates[0].content.parts[0]

            if not part.inline_data or not part.inline_data.data:
                return b""

            pcm = part.inline_data.data

            return self._pcm_to_wav(pcm)

        except Exception as e:
            print(f"Gemini TTS error: {e}")
            return b""

    def generate_speech_with_lipsync(
        self,
        text: str,
        speaker: Optional[str] = None
    ) -> Optional[Dict]:

        audio_bytes = self.generate_speech_to_bytes(text, speaker)

        if not audio_bytes:
            return None

        duration = (len(text.split()) / 150.0) * 60.0

        return {
            "audio_bytes": audio_bytes,
            "viseme_data": None,
            "duration": duration,
        }

    def transcribe_audio(
        self,
        audio_file: bytes,
        filename: str = "audio.wav"
    ) -> str:

        try:
            audio_io = io.BytesIO(audio_file)
            audio_io.name = filename

            result = self.groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_io,
                response_format="text",
            )

            return result if isinstance(result, str) else result.text

        except Exception as e:
            print(f"Whisper error: {e}")
            return ""

    def get_available_speakers(self) -> List[Dict]:
        return [
            {
                "name": name,
                "gender": info["gender"],
                "description": info["description"],
                "is_default": name == self.default_voice,
            }
            for name, info in self.VOICES.items()
        ]

    def convert_audio_format(
        self,
        audio_bytes: bytes,
        from_format: str,
        to_format: str
    ) -> bytes:

        try:
            audio = AudioSegment.from_file(
                io.BytesIO(audio_bytes),
                format=from_format
            )

            output = io.BytesIO()
            audio.export(output, format=to_format)
            output.seek(0)

            return output.read()

        except Exception:
            return audio_bytes

    def get_audio_duration(
        self,
        audio_bytes: bytes,
        format: str = "wav"
    ) -> float:

        try:
            audio = AudioSegment.from_file(
                io.BytesIO(audio_bytes),
                format=format
            )
            return len(audio) / 1000.0

        except Exception:
            return 0.0

    def batch_generate_speech(
        self,
        texts: List[str],
        speaker: Optional[str] = None
    ) -> List[bytes]:

        return [
            self.generate_speech_to_bytes(text, speaker)
            for text in texts
        ]


tts_service = TTSService()