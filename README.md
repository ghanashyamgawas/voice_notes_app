🔹 Voice Notes MVP – AI Powered Web Application

A full-stack AI application that records audio, transcribes it using Whisper, and enables intelligent features like summarization, semantic search, and AI-powered Q&A.

🚀 Features
🎤 Browser-based audio recording (MediaRecorder API)
📝 Speech-to-text transcription using Whisper (whisper-1)
🤖 AI-generated summaries, to-do lists, and email drafts
🔍 Semantic search using embeddings + pgvector
💬 Ask-AI: Query recordings using context-aware retrieval
📂 Note management with PostgreSQL
🏗️ Tech Stack

Frontend:

HTML, CSS, JavaScript (MediaRecorder API)

Backend:

Python, Flask (REST APIs)

AI:

OpenAI Whisper (transcription)
GPT models (summarization, Q&A)
Embeddings (semantic search)

Database:

PostgreSQL + pgvector
⚙️ How It Works (Flow)
User records audio in browser
Audio sent to Flask backend
Whisper converts audio → text
Text split into ~500-word chunks
Embeddings generated and stored in PostgreSQL
Features enabled:
Semantic search
Ask-AI (context retrieval)
Summary, to-dos, email generation
🛠️ Setup
git clone <repo>
cd voice-notes-mvp
pip install -r requirements.txt

Create .env:

OPENAI_API_KEY=your_key_here

Run:

python app.py
📌 Key Highlights
Implemented vector search using pgvector
Built context-aware AI system (not full transcript based)
Designed end-to-end AI workflow pipeline
Demonstrates full-stack + AI integration
