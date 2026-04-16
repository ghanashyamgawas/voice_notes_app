🔹 Voice Notes MVP – AI Powered Web Application

A full-stack AI application that records audio, transcribes it using Whisper, and enables intelligent features like summarization, semantic search, and AI-powered Q&A.

🚀 Features
Browser-based audio recording (MediaRecorder API)
Speech-to-text using Whisper (whisper-1)
AI summaries, to-do lists, email drafts
Semantic search using embeddings + pgvector
Ask-AI (context-aware retrieval)
Note management with PostgreSQL
🏗️ Tech Stack

Frontend:
HTML, CSS, JavaScript (MediaRecorder API)

Backend:
Python, Flask (REST APIs)

AI:
OpenAI Whisper, GPT models, Embeddings

Database:
PostgreSQL + pgvector

⚙️ How It Works (Flow)
User records audio in browser
Audio sent to Flask backend
Whisper converts audio → text
Text split into ~500-word chunks
Embeddings stored in PostgreSQL
Features: search, Ask-AI, summaries
🛠️ Setup
git clone <repo>
cd voice-notes-mvp
pip install -r requirements.txt

Create .env:

OPENAI_API_KEY=your_key_here

Run:

python app.py
📌 Key Highlights
Vector search using pgvector
Context-aware AI (not full transcript)
End-to-end AI workflow
Full-stack + AI integration
