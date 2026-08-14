import io
import os
import tempfile
from typing import Optional, List, Dict

import edge_tts
from dotenv import load_dotenv
from groq import Groq
from pydub import AudioSegment
import imageio_ffmpeg

load_dotenv()

# pydub needs an ffmpeg binary to decode Edge TTS's MP3 output.
# imageio-ffmpeg supplies a portable binary on Render/Linux and locally.
AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()


class TTSService:
    # The frontend expects audio/wav. Edge TTS natively returns MP3, so we
    # explicitly decode and re-encode it rather than relabeling MP3 bytes as
    # WAV. Relabeling compressed MP3 bytes as WAV produces static/noise.
    TTS_FORMAT = "audio/wav"

    # Canonical avatar ids (MUST match frontend/src/config/avatars.js).
    # Voice groups are intentional: we do not need 7 unique voices.
    VOICES = {
        # Female voice group
        "cara": {
            "voice": "en-US-AriaNeural",
            "gender": "female",
            "description": "Natural female interviewer voice",
        },
        "bunny": {
            "voice": "en-US-JennyNeural",
            "gender": "female",
            "description": "Light, upbeat female interviewer voice",
        },
        "mushroom_king": {
            "voice": "en-US-SaraNeural",
            "gender": "female",
            "description": "Warm female interviewer voice",
        },
        # Male voice group
        "kevin": {
            "voice": "en-US-GuyNeural",
            "gender": "male",
            "description": "Natural male interviewer voice",
        },
        "blue_demon": {
            "voice": "en-US-DavisNeural",
            "gender": "male",
            "description": "Deeper male interviewer voice",
        },
        "yeti": {
            "voice": "en-US-TonyNeural",
            "gender": "male",
            "description": "Low, calm male interviewer voice",
        },
        "baymax": {
            "voice": "en-US-ChristopherNeural",
            "gender": "male",
            "description": "Soft, measured male interviewer voice",
        },
    }

    def __init__(self):
        groq_key = os.getenv("GROQ_API_KEY")

        if not groq_key:
            raise ValueError("GROQ_API_KEY not found")

        self.groq_client = Groq(api_key=groq_key)
        self.default_voice = "cara"
        # Kept for /api/stats compatibility.
        self.model_name = "edge-tts"
        self.is_loaded = True

        print("OK: Edge TTS initialized")
        print("OK: Groq Whisper initialized")

    def _get_voice(self, speaker: Optional[str] = None) -> str:
        speaker = speaker or self.default_voice

        if speaker not in self.VOICES:
            print(
                f"WARNING: unknown TTS speaker '{speaker}' "
                f"(known: {sorted(self.VOICES.keys())}). "
                f"Falling back to default '{self.default_voice}'."
            )
            speaker = self.default_voice

        return self.VOICES[speaker]["voice"]

    def generate_speech_to_bytes(
        self,
        text: str,
        speaker: Optional[str] = None
    ) -> bytes:
        """Generate Edge TTS speech and return valid 24 kHz mono WAV bytes."""
        text = (text or "").strip()

        if not text:
            return b""

        voice = self._get_voice(speaker)
        temp_path = None

        try:
            # edge-tts.save_sync() safely manages its own asyncio loop and is
            # suitable for this synchronous service method.
            with tempfile.NamedTemporaryFile(
                suffix=".mp3",
                delete=False
            ) as temp_file:
                temp_path = temp_file.name

            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate="+0%",
                volume="+0%",
                pitch="+0Hz",
            )
            communicate.save_sync(temp_path)

            with open(temp_path, "rb") as audio_file:
                mp3_bytes = audio_file.read()

            if not mp3_bytes:
                print("Edge TTS returned empty audio")
                return b""

            # IMPORTANT: Edge TTS returns audio/mpeg. Decode it first, then
            # encode a real WAV file. This prevents the static/noise symptom
            # caused by treating MP3 bytes as WAV in the browser.
            audio = AudioSegment.from_file(
                io.BytesIO(mp3_bytes),
                format="mp3"
            )
            audio = (
                audio
                .set_channels(1)
                .set_frame_rate(24000)
                .set_sample_width(2)
            )

            output = io.BytesIO()
            audio.export(output, format="wav")
            wav_bytes = output.getvalue()

            if not wav_bytes:
                print("Edge TTS WAV conversion returned empty audio")
                return b""

            print(
                f"OK: Edge TTS generated {len(wav_bytes)} WAV bytes "
                f"using {voice}"
            )
            return wav_bytes

        except Exception as e:
            print(f"Edge TTS error: {e}")
            return b""

        finally:
            if temp_path:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

    def generate_speech_with_lipsync(
        self,
        text: str,
        speaker: Optional[str] = None
    ) -> Optional[Dict]:
        audio_bytes = self.generate_speech_to_bytes(text, speaker)

        if not audio_bytes:
            return None

        # Edge TTS does not provide model-specific visemes through this
        # endpoint. The frontend continues using frequency-based mouth
        # animation from the actual playing WAV audio.
        duration = self.get_audio_duration(audio_bytes, format="wav")

        if duration <= 0:
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

        except Exception as e:
            print(f"Audio duration parse warning: {e}")
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
