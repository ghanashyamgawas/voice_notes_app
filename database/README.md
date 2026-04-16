# Database Setup Guide

This guide will help you set up PostgreSQL + pgvector for the Voice Notes MVP application.

## Overview

The application now supports **dual storage**:
- **JSON files** (existing): Your current data remains in JSON files
- **PostgreSQL + pgvector** (new): New data can be saved to a proper database

**Important**: Your existing JSON data will NOT be migrated automatically. The database is only for NEW data going forward.

## Prerequisites

1. PostgreSQL 14 or higher
2. pgvector extension
3. Python dependencies (installed via `requirements.txt`)

## Quick Start

### Option 1: Local PostgreSQL Setup

#### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### 2. Install pgvector Extension

Follow the instructions at: https://github.com/pgvector/pgvector#installation

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-server-dev-14
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**macOS:**
```bash
brew install pgvector
```

#### 3. Create Database

```bash
# Create the database
sudo -u postgres createdb voice_notes

# Or use psql
sudo -u postgres psql
postgres=# CREATE DATABASE voice_notes;
postgres=# \q
```

#### 4. Run Schema

```bash
# Apply the database schema
sudo -u postgres psql -d voice_notes -f database/schema.sql
```

Or connect and run manually:
```bash
sudo -u postgres psql voice_notes
voice_notes=# \i database/schema.sql
```

#### 5. Configure Environment

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and set:
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voice_notes
```

**Note**: Replace `postgres:postgres` with your actual username and password.

#### 6. Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### 7. Start the Application

```bash
python app.py
```

You should see:
```
[App] Initializing database...
[Database] Successfully initialized database connection
[App] Creating database tables if they don't exist...
[Database] Successfully created all tables
[App] Database is ready! New data will be saved to PostgreSQL.
```

### Option 2: Managed Database (Recommended for Production)

#### Supabase (Easiest)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. pgvector is already installed by default
4. Go to Settings → Database → Connection String
5. Copy the connection string
6. In your `.env` file:
   ```
   USE_DATABASE=true
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
7. Run the schema using Supabase SQL Editor or psql:
   ```bash
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres" -f database/schema.sql
   ```

#### AWS RDS PostgreSQL

1. Create RDS PostgreSQL instance (version 14+)
2. Install pgvector extension (requires rds_superuser role)
3. Get connection details from AWS Console
4. Update `.env`:
   ```
   USE_DATABASE=true
   DATABASE_URL=postgresql://admin:[PASSWORD]@mydb.us-east-1.rds.amazonaws.com:5432/voice_notes
   ```
5. Run schema:
   ```bash
   psql "postgresql://admin:[PASSWORD]@mydb.us-east-1.rds.amazonaws.com:5432/voice_notes" -f database/schema.sql
   ```

## Database Schema

The schema includes these main tables:

- **users**: User authentication and profiles
- **voice_notes**: Voice recordings with transcripts and AI-generated content
- **note_chunks**: Text chunks with vector embeddings for semantic search
- **chat_history**: Ask AI conversation history
- **tags**, **favorites**: Organization features

See `database/schema.sql` for the complete schema.

## How It Works

### Dual Storage During Transition

When `USE_DATABASE=true`:
1. **New recordings** are saved to BOTH JSON and PostgreSQL
2. **Updates** (transcripts, summaries, etc.) are saved to BOTH
3. **Reads** come from JSON files (for now)
4. **Your existing JSON data** is NOT touched

This allows you to:
- Compare data between JSON and database
- Ensure data integrity before fully switching
- Keep existing features working

### What Gets Saved to Database

- ✅ New voice recordings
- ✅ Transcripts (original and cleaned)
- ✅ AI-generated content (summaries, meeting notes, todos, emails, etc.)
- ✅ Chat history (Ask AI conversations)
- ✅ Metadata (images, links stored in JSONB)
- ⏳ Tags, favorites (coming soon)
- ⏳ Vector embeddings (coming soon - requires embedding generation)

### What Stays in JSON

- Your existing data (until you decide to migrate)
- Data when `USE_DATABASE=false`

## Verification

### Check Database Connection

```bash
python -c "from database import check_db_connection; print('✓ Connected' if check_db_connection() else '✗ Failed')"
```

### View Data in Database

```bash
# Connect to database
psql "YOUR_DATABASE_URL"

# List tables
\dt

# View recent recordings
SELECT id, title, status, created_at FROM voice_notes ORDER BY created_at DESC LIMIT 5;

# View chat history
SELECT note_id, question, created_at FROM chat_history ORDER BY created_at DESC LIMIT 5;

# Check if pgvector is installed
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Troubleshooting

### Error: "could not create vector extension"

This is usually safe to ignore. The extension might need superuser privileges or might already exist.

**Solution**: Create it manually:
```bash
psql voice_notes
voice_notes=# CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "FATAL: password authentication failed"

Check your DATABASE_URL credentials in `.env`.

### Error: "psycopg2" module not found

```bash
pip install psycopg2-binary
```

### Database connection hangs

Check:
1. PostgreSQL is running: `sudo systemctl status postgresql` (Linux)
2. Database exists: `psql -l | grep voice_notes`
3. Firewall allows connection to port 5432

### "Database not initialized" errors

Make sure:
1. `USE_DATABASE=true` in `.env`
2. `DATABASE_URL` is correct
3. Schema was applied: `psql -d voice_notes -f database/schema.sql`

## Advanced Usage

### Vector Similarity Search

Once embeddings are generated, you can search for similar content:

```sql
-- Find notes similar to a query (assuming embeddings exist)
SELECT nc.note_id, nc.text, nc.embedding <=> $1 AS distance
FROM note_chunks nc
ORDER BY nc.embedding <=> $1
LIMIT 10;
```

### Full-Text Search

Search across all transcripts:

```sql
SELECT id, title, ts_rank(search_vector, query) AS rank
FROM voice_notes, plainto_tsquery('english', 'meeting notes') query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

### Backup Database

```bash
# Backup
pg_dump voice_notes > backup_$(date +%Y%m%d).sql

# Restore
psql voice_notes < backup_20250124.sql
```

## Future Enhancements

- [ ] Automatic embedding generation for semantic search
- [ ] Migration script to move existing JSON data to database
- [ ] Database-first reads (instead of JSON)
- [ ] Advanced search with filters
- [ ] Multi-user support with proper authentication
- [ ] Row-level security for multi-tenant scenarios

## Need Help?

- Check the [pgvector documentation](https://github.com/pgvector/pgvector)
- PostgreSQL documentation: [postgresql.org/docs](https://www.postgresql.org/docs/)
- File an issue on the project repository
