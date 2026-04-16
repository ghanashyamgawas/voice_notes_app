# Voice Notes MVP

A minimal voice-notes proof-of-concept that transcribes audio with Whisper and summarizes transcripts using OpenAI's chat models.

Purpose
- Quickly transcribe local audio files and produce short summaries of conversations.

Prerequisites
- Python 3.8+
- ffmpeg installed and available on PATH (required by Whisper)
- An OpenAI API key


Environment
- Create a `.env` file in the project root with:
  OPENAI_API_KEY=sk-...

Usage (Python)
- Example usage from the repository root:
```python
from utils.ai_utils import transcribe_audio, summarize_text

audio_path = "path/to/audio.wav"
transcript = transcribe_audio(audio_path)
print("Transcript:\n", transcript)

summary = summarize_text(transcript)
print("Summary:\n", summary)
```

Notes
- The first Whisper model load will download model weights; use a larger model for better accuracy.
- summarize_text returns a short error message on API failures so callers can handle/display it.
- Ensure ffmpeg is installed and accessible; Whisper relies on ffmpeg for many formats.

Troubleshooting
- If you see connection or authentication errors, verify OPENAI_API_KEY in `.env` and that it's loaded (python-dotenv).
- If transcription or model load is slow, try a smaller model ("tiny") for faster runs.

Contributing
- Open pull requests with small, focused changes. Include tests where applicable.

License
- MIT 
