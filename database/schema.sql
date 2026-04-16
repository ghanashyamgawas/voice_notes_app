-- Voice Notes MVP - PostgreSQL + pgvector Schema
-- This schema supports user authentication, voice recordings/transcripts,
-- vector embeddings for semantic search, and AI-generated content

-- CREATE EXTENSIONS (run once as superuser or database owner)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- password hashing helpers

-----------------------------------------------------------
-- Users / Authentication
-----------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email citext UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,               -- bcrypt/argon2 hash
  password_algo TEXT DEFAULT 'argon2',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- Sessions for auth tokens




-----------------------------------------------------------
-- Voice Notes / Recordings
-- Stores metadata and transcripts; audio files remain in S3/filesystem
-----------------------------------------------------------
CREATE TABLE voice_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES voice_notes(id) ON DELETE CASCADE, -- for subnotes
  title TEXT,

  -- Transcripts
  transcript TEXT,
  transcript_cleaned TEXT,

  -- AI-generated content
  summary TEXT,
  meeting_notes TEXT,
  main_points TEXT,
  todo_list TEXT,
  email_draft TEXT,
  subnotes_summary TEXT,

  -- File information
  file_url TEXT,              -- S3 or local filesystem URL
  file_name TEXT,
  file_size_bytes BIGINT,
  audio_path TEXT,            -- legacy: local file path

  -- Metadata
  status TEXT DEFAULT 'processing',  -- processing, transcribing, transcribed, error, etc.
  duration_seconds INTEGER,
  metadata JSONB,             -- flexible storage for images, links, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_notes_user ON voice_notes(user_id);
CREATE INDEX idx_voice_notes_parent ON voice_notes(parent_id);
CREATE INDEX idx_voice_notes_status ON voice_notes(status);
CREATE INDEX idx_voice_notes_created ON voice_notes(created_at DESC);

-- Full-text search vector
ALTER TABLE voice_notes ADD COLUMN search_vector tsvector;
CREATE INDEX idx_voice_notes_search ON voice_notes USING GIN(search_vector);

-- Trigger to auto-update search_vector when transcript or title changes
CREATE OR REPLACE FUNCTION update_voice_notes_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.transcript, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_notes_search_update
  BEFORE INSERT OR UPDATE OF title, transcript, summary
  ON voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_notes_search_vector();

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_notes_updated_at
  BEFORE UPDATE ON voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-----------------------------------------------------------
-- Text Chunks + Embeddings (for semantic/vector search)
-- Each note is split into chunks, each chunk gets an embedding
-- Embedding dimension: 1536 (OpenAI text-embedding-ada-002)
-- Change this based on your embedding model
-----------------------------------------------------------
CREATE TABLE note_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES voice_notes(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  metadata JSONB,                               -- e.g., timestamps, speaker info
  embedding VECTOR(1536),                       -- pgvector column
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  embedding_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (note_id, chunk_index)
);

-- Vector similarity index (IVFFlat for cosine similarity)
-- Tune 'lists' parameter based on corpus size (sqrt of row count is a good start)
CREATE INDEX idx_note_chunks_embedding_ivf
  ON note_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_note_chunks_note ON note_chunks(note_id);
CREATE INDEX idx_note_chunks_metadata_gin ON note_chunks USING GIN (metadata);

-----------------------------------------------------------
-- Tags for organizing notes
-----------------------------------------------------------

-----------------------------------------------------------
-- Chat History (Ask AI feature)
-- Stores Q&A conversations about specific notes
-----------------------------------------------------------
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES voice_notes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_history_note ON chat_history(note_id);
CREATE INDEX idx_chat_history_created ON chat_history(created_at DESC);

-- Header Ask AI history (general conversations not tied to specific notes)
CREATE TABLE header_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rec_id TEXT,              -- Recording ID that this chat is associated with
  title TEXT,
  messages JSONB NOT NULL,  -- array of {question, answer, timestamp}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_header_chat_history_user ON header_chat_history(user_id);
CREATE INDEX idx_header_chat_history_rec ON header_chat_history(rec_id);
CREATE INDEX idx_header_chat_history_created ON header_chat_history(created_at DESC);

