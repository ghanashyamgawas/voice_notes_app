from flask import Flask, request, jsonify, send_from_directory, redirect, url_for
from flask_cors import CORS
import os
import uuid
from dotenv import load_dotenv
from utils.ai_utils import (
    transcribe_audio,
    summarize_text,
    meeting_notes_text,
    main_points_text,
    generate_title_from_transcript,
    todo_list_text,
    generate_email_draft_text,
    clean_transcript_text,
    ask_ai_about_transcript
)

# Database imports
from database import (
    init_db,
    create_tables,
    check_db_connection,
    get_db_session
)
from database.helpers import (
    create_voice_note,
    update_voice_note,
    get_voice_note,
    get_voice_notes_by_user,
    delete_voice_note,
    search_voice_notes,
    save_chat_history,
    get_chat_history,
    save_header_chat_history,
    get_header_chat_history,
    delete_header_chat_history,
    get_or_create_user,
    create_note_chunks,
    search_chunks_by_similarity,
    find_related_notes
)
from utils.chunking_utils import split_into_chunks, create_chunks_with_metadata
from utils.embedding_utils import get_embedding, get_embeddings_batch
from database.models import User, VoiceNote


load_dotenv()

# Force database to be enabled
os.environ["USE_DATABASE"] = "true"

app = Flask(__name__, static_folder="static", static_url_path="")

# Enable CORS for Google Sign-In
CORS(app, resources={
    r"/*": {
        "origins": ["http://127.0.0.1:5000", "http://localhost:5000"],
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialize database (REQUIRED)
print("[App] Initializing database...")
engine, session_factory = init_db()
if not engine:
    print("[App] ERROR: Database initialization failed!")
    print("[App] Please check your DATABASE_URL in .env file.")
    exit(1)

print("[App] Creating database tables if they don't exist...")
create_tables()

if not check_db_connection():
    print("[App] ERROR: Database connection check failed!")
    print("[App] Please verify PostgreSQL is running and DATABASE_URL is correct.")
    exit(1)

print("[App] ✓ Database is ready! All data will be saved to PostgreSQL.")

# Directories for file storage (audio, images)
TMP_DIR = "tmp"
AUDIO_DIR = os.path.join(TMP_DIR, "audio")
IMAGES_DIR = os.path.join(TMP_DIR, "images")

# Create necessary directories
for d in [AUDIO_DIR, IMAGES_DIR]:
    os.makedirs(d, exist_ok=True)

# Simple in-memory cache for search results (15 minute TTL for better performance)
from datetime import timedelta
import time

SEARCH_CACHE = {}
SEARCH_CACHE_TTL = 900  # 15 minutes in seconds (increased from 300 for faster repeat searches)

def get_cached_search(cache_key):
    """Get cached search results if not expired."""
    if cache_key in SEARCH_CACHE:
        results, timestamp = SEARCH_CACHE[cache_key]
        if time.time() - timestamp < SEARCH_CACHE_TTL:
            return results
        else:
            del SEARCH_CACHE[cache_key]
    return None

def set_cached_search(cache_key, results):
    """Cache search results with timestamp."""
    SEARCH_CACHE[cache_key] = (results, time.time())
    # Clean old cache entries if too many
    if len(SEARCH_CACHE) > 100:
        # Remove oldest 20 entries
        sorted_keys = sorted(SEARCH_CACHE.keys(), key=lambda k: SEARCH_CACHE[k][1])
        for key in sorted_keys[:20]:
            del SEARCH_CACHE[key]

def resolve_audio_path(p):
    """Resolve audio path to absolute path."""
    if not p:
        return None
    if os.path.isabs(p):
        return p
    return os.path.join(os.path.dirname(__file__), p)

def get_user_id_from_request():
    """Get user ID from request parameters or use default."""
    user_id = request.form.get("user_id") or request.args.get("user_id")
    if user_id:
        return user_id

    # Get first user from database as default
    try:
        with get_db_session() as session:
            first_user = session.query(User).first()
            if first_user:
                return str(first_user.id)
    except Exception as e:
        print(f"[App] Error getting default user: {e}")

    return None

def no_cache_json(obj, status=200):
    """Return a Flask Response with JSON and Cache-Control: no-store to avoid client caching."""
    resp = jsonify(obj)
    resp.status_code = status
    resp.headers['Cache-Control'] = 'no-store'
    return resp

def generate_chunks_for_note(note_id, transcript, chunk_size=500, overlap=50):
    """
    Generate chunks with embeddings for a note's transcript.
    This enables semantic search for the Ask AI feature.

    Args:
        note_id: Voice note ID
        transcript: The transcript text to chunk
        chunk_size: Target words per chunk
        overlap: Words to overlap between chunks

    Returns:
        Number of chunks created, or 0 on error
    """
    if not transcript or not transcript.strip():
        print(f"[generate_chunks] note_id={note_id} - no transcript to chunk")
        return 0

    try:
        print(f"[generate_chunks] note_id={note_id} - starting chunk generation...")

        # Step 1: Split transcript into chunks
        chunks_with_meta = create_chunks_with_metadata(
            transcript,
            chunk_size=chunk_size,
            overlap=overlap
        )

        if not chunks_with_meta:
            print(f"[generate_chunks] note_id={note_id} - no chunks created")
            return 0

        print(f"[generate_chunks] note_id={note_id} - created {len(chunks_with_meta)} text chunks")

        # Step 2: Generate embeddings for all chunks (batch processing)
        chunk_texts = [chunk['text'] for chunk in chunks_with_meta]
        embeddings = get_embeddings_batch(chunk_texts)

        print(f"[generate_chunks] note_id={note_id} - generated {len(embeddings)} embeddings")

        # Step 3: Attach embeddings to chunks
        chunks_to_save = []
        for i, chunk in enumerate(chunks_with_meta):
            chunk['embedding'] = embeddings[i] if i < len(embeddings) else None
            chunks_to_save.append(chunk)

        # Step 4: Save to database
        success = create_note_chunks(note_id, chunks_to_save)

        if success:
            print(f"[generate_chunks] note_id={note_id} - successfully saved {len(chunks_to_save)} chunks to database")
            return len(chunks_to_save)
        else:
            print(f"[generate_chunks] note_id={note_id} - failed to save chunks to database")
            return 0

    except Exception as e:
        print(f"[generate_chunks] note_id={note_id} - error: {e}")
        import traceback
        traceback.print_exc()
        return 0

def start_transcription(rec_id):
    """Helper to start transcription process for a recording (runs in background)."""
    import traceback

    # Get recording from database
    rec = get_voice_note(rec_id)
    if not rec:
        print(f"[start_transcription] no recording found for id={rec_id}")
        return False

    audio_path = resolve_audio_path(rec.get("audio_path", ""))
    if not audio_path or not os.path.exists(audio_path):
        print(f"[start_transcription] audio missing for id={rec_id}; audio_path={audio_path}")
        update_voice_note(rec_id, status="audio_missing")
        return False

    try:
        # Update status to transcribing
        update_voice_note(rec_id, status="transcribing")

        # Perform transcription
        transcript = transcribe_audio(audio_path)

        # DEBUG: show some info about transcription result
        try:
            t_type = type(transcript).__name__
            t_len = len(transcript) if isinstance(transcript, str) else "n/a"
        except Exception:
            t_type = "unknown"
            t_len = "n/a"
        preview = (transcript or "")[:300].replace("\n", " ")
        print(f"[start_transcription] rec_id={rec_id} transcript type={t_type}; len={t_len}")
        print(f"[start_transcription] rec_id={rec_id} transcript preview: {repr(preview)}")

        # Generate AI title from transcript
        title = rec.get("title", "")
        try:
            print(f"[start_transcription] rec_id={rec_id} calling generate_title_from_transcript(...)")
            generated_title = generate_title_from_transcript(transcript, min_words=3, max_words=5, prefer_existing=False)
            print(f"[start_transcription] rec_id={rec_id} generate_title returned: {repr(generated_title)}")
            if generated_title:
                title = generated_title
        except Exception as e:
            print(f"[start_transcription] rec_id={rec_id} generate_title exception: {e}")
            traceback.print_exc()

        # Update recording with transcript and title
        update_voice_note(
            rec_id,
            transcript=transcript or "",
            title=title,
            status="transcribed"
        )

        # Generate chunks with embeddings (background task, don't fail if it errors)
        try:
            generate_chunks_for_note(rec_id, transcript)
        except Exception as chunk_error:
            print(f"[start_transcription] rec_id={rec_id} chunk generation failed: {chunk_error}")
            # Don't fail the transcription if chunking fails
            traceback.print_exc()

        print(f"[start_transcription] rec_id={rec_id} finished successfully")
        return True

    except Exception as e:
        print(f"[start_transcription] rec_id={rec_id} top-level exception: {e}")
        traceback.print_exc()
        update_voice_note(rec_id, status="error")
        return False

@app.route("/")
def root():
    return redirect(url_for('login_page'))

@app.route("/login")
def login_page():
    return send_from_directory("static", "index.html")

@app.route("/app")
def app_page():
    return send_from_directory("static", "index.html")

@app.route("/upload", methods=["POST"])
def upload_audio():
    file = request.files.get("file")
    if not file:
        return no_cache_json({"error": "no file"}, 400)

    # Check file size limit (10 MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB in bytes
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_FILE_SIZE:
        file_size_mb = file_size / 1024 / 1024
        return no_cache_json({
            "error": f"File is too large ({file_size_mb:.2f} MB). Maximum file size is 10 MB."
        }, 400)

    # Check if this is a subnote (has parent_id)
    parent_id = request.form.get("parent_id")

    # Get user_id
    if parent_id:
        parent_rec = get_voice_note(parent_id)
        if parent_rec:
            user_id = parent_rec.get("user_id", get_user_id_from_request())
        else:
            user_id = get_user_id_from_request()
    else:
        user_id = get_user_id_from_request()

    if not user_id:
        return no_cache_json({"error": "User not found. Please log in first."}, 401)

    rec_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename or "")
    if not ext:
        ext = ".wav"
    filename = f"{rec_id}{ext}"
    file_path = os.path.join(AUDIO_DIR, filename)

    # Save the file
    file.save(file_path)

    # Verify the file was saved
    if not os.path.exists(file_path):
        print(f"[upload_audio] ERROR: File was not saved to {file_path}")
        return no_cache_json({"error": "Failed to save audio file"}, 500)

    saved_size = os.path.getsize(file_path)
    print(f"[upload_audio] Saved audio file: {file_path} ({saved_size} bytes)")

    if saved_size == 0:
        print(f"[upload_audio] ERROR: Saved file is empty (0 bytes)")
        os.remove(file_path)
        return no_cache_json({"error": "Audio file is empty"}, 400)

    # Create voice note in database
    entry = create_voice_note(
        user_id=user_id,
        parent_id=parent_id,
        title="",
        audio_path=file_path,
        audio_url=f"/audio/{filename}",
        status="processing",
        file_name=filename,
        file_size_bytes=saved_size
    )

    if not entry:
        return no_cache_json({"error": "Failed to create recording in database"}, 500)

    rec_id = entry["id"]

    # Start transcription in background
    import threading
    thread = threading.Thread(target=start_transcription, args=(rec_id,), daemon=True)
    thread.start()

    return no_cache_json({
        "id": rec_id,
        "message": "processing",
        "recording": entry,
        "status_url": f"/status/{rec_id}"
    })


@app.route("/status/<rec_id>", methods=["GET"])
def get_status(rec_id):
    """Return status, transcript and summary for a recording (frontend can poll this)."""
    rec = get_voice_note(rec_id)
    if not rec:
        return no_cache_json({"error": "not found"}, 404)
    return no_cache_json({
        "status": rec.get("status", "unknown"),
        "title": rec.get("title", ""),
        "transcript": rec.get("transcript", ""),
        "summary": rec.get("summary", ""),
        "meeting_notes": rec.get("meeting_notes", "")
    })

@app.route("/edit_transcript/<rec_id>", methods=["POST"])
def edit_transcript(rec_id):
    """Allow user to edit and save a transcript produced automatically."""
    data = request.get_json(force=True)
    new_transcript = data.get("transcript", "")

    # Generate a new title from the updated transcript
    title = ""
    try:
        generated_title = generate_title_from_transcript(new_transcript, min_words=3, max_words=5, prefer_existing=False)
        if generated_title:
            title = generated_title.strip()
            print(f"[edit_transcript] rec_id={rec_id} - generated new title: {title}")
    except Exception as e:
        print(f"[edit_transcript] rec_id={rec_id} - title generation failed: {e}")
        # Use first sentence as fallback
        if new_transcript:
            first = new_transcript.split(".")[0].strip()
            title = first[:50] if first else "Untitled"

    # Update transcript and title
    rec = update_voice_note(rec_id, transcript=new_transcript, title=title, status="transcribed")
    if not rec:
        return no_cache_json({"error": "not found"}, 404)

    # Regenerate chunks/embeddings for the updated transcript
    # This ensures search and Ask AI features work with the edited content
    try:
        generate_chunks_for_note(rec_id, new_transcript)
        print(f"[edit_transcript] rec_id={rec_id} - chunks regenerated successfully")
    except Exception as chunk_error:
        print(f"[edit_transcript] rec_id={rec_id} - chunk regeneration failed: {chunk_error}")
        # Don't fail the save if chunking fails

    return no_cache_json({"message": "transcript updated", "recording": rec})

@app.route("/delete_field/<rec_id>/<field>", methods=["DELETE"])
def delete_field(rec_id, field):
    """Delete a specific field from a recording (summary, meeting_notes, etc.)"""
    # List of allowed fields to delete (not transcript)
    allowed_fields = ["summary", "meeting_notes", "main_points", "todo_list", "email_draft", "transcript_cleaned"]

    if field not in allowed_fields:
        return no_cache_json({"error": f"Cannot delete field: {field}"}, 400)

    # Map clean_transcript to transcript_cleaned
    db_field = "transcript_cleaned" if field == "clean_transcript" else field

    # Update the field to empty string
    rec = update_voice_note(rec_id, **{db_field: ""})
    if not rec:
        return no_cache_json({"error": "not found"}, 404)

    return no_cache_json({"message": f"{field} deleted successfully", "recording": rec})

# add a route to serve audio files saved under tmp/audio/
@app.route("/audio/<path:filename>")
def serve_audio(filename):
    # serve files from the AUDIO_DIR so the frontend can play them via audio_url
    return send_from_directory(AUDIO_DIR, filename, as_attachment=False)

# add a route to serve images
@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)

# add a route to upload images for recordings
@app.route("/upload_image/<rec_id>", methods=["POST"])
def upload_image(rec_id):
    try:
        file = request.files.get("image")
        if not file:
            return no_cache_json({"error": "No image file provided"}, 400)

        # Get recording
        rec = get_voice_note(rec_id)
        if not rec:
            return no_cache_json({"error": "Recording not found"}, 404)

        # Generate unique filename
        image_id = str(uuid.uuid4())
        _, ext = os.path.splitext(file.filename or "")
        if not ext:
            ext = ".jpg"
        filename = f"{rec_id}_{image_id}{ext}"
        file_path = os.path.join(IMAGES_DIR, filename)
        file.save(file_path)

        # Update recording metadata with image reference
        metadata = rec.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        if "images" not in metadata:
            metadata["images"] = []
        metadata["images"].append({
            "filename": filename,
            "url": f"/images/{filename}"
        })

        update_voice_note(rec_id, note_metadata=metadata)

        return no_cache_json({
            "success": True,
            "filename": filename,
            "url": f"/images/{filename}"
        })
    except Exception as e:
        return no_cache_json({"error": str(e)}, 500)

# add a route to delete images for recordings
@app.route("/delete_image/<rec_id>", methods=["POST"])
def delete_image(rec_id):
    try:
        data = request.get_json(force=True)
        image_url = data.get("image_url")

        if not image_url:
            return no_cache_json({"error": "No image URL provided"}, 400)

        # Get recording
        rec = get_voice_note(rec_id)
        if not rec:
            return no_cache_json({"error": "Recording not found"}, 404)

        # Extract filename from URL
        filename = image_url.split('/')[-1]

        # Delete file from filesystem
        file_path = os.path.join(IMAGES_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        # Update recording metadata
        metadata = rec.get("metadata", {})
        if isinstance(metadata, dict) and "images" in metadata:
            metadata["images"] = [img for img in metadata["images"] if img.get("url") != image_url]
            update_voice_note(rec_id, note_metadata=metadata)

        return no_cache_json({"success": True})
    except Exception as e:
        return no_cache_json({"error": str(e)}, 500)

# add a route to add links to recordings
@app.route("/add_link/<rec_id>", methods=["POST"])
def add_link(rec_id):
    try:
        data = request.get_json(force=True)
        link_url = data.get("link_url")
        link_text = data.get("link_text", link_url)

        if not link_url:
            return no_cache_json({"error": "No link URL provided"}, 400)

        # Get recording
        rec = get_voice_note(rec_id)
        if not rec:
            return no_cache_json({"error": "Recording not found"}, 404)

        # Update recording metadata with link
        metadata = rec.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        if "links" not in metadata:
            metadata["links"] = []
        metadata["links"].append({
            "url": link_url,
            "text": link_text
        })

        update_voice_note(rec_id, note_metadata=metadata)

        return no_cache_json({
            "success": True,
            "link": {
                "url": link_url,
                "text": link_text
            }
        })
    except Exception as e:
        return no_cache_json({"error": str(e)}, 500)

# add a route to delete links from recordings
@app.route("/delete_link/<rec_id>", methods=["POST"])
def delete_link(rec_id):
    try:
        data = request.get_json(force=True)
        link_url = data.get("link_url")

        if not link_url:
            return no_cache_json({"error": "No link URL provided"}, 400)

        # Get recording
        rec = get_voice_note(rec_id)
        if not rec:
            return no_cache_json({"error": "Recording not found"}, 404)

        # Update recording metadata
        metadata = rec.get("metadata", {})
        if isinstance(metadata, dict) and "links" in metadata:
            metadata["links"] = [link for link in metadata["links"] if link.get("url") != link_url]
            update_voice_note(rec_id, note_metadata=metadata)

        return no_cache_json({"success": True})
    except Exception as e:
        return no_cache_json({"error": str(e)}, 500)

# add a route to download audio files
@app.route("/download/<path:filename>")
def download_audio(filename):
    # serve files from the AUDIO_DIR with download headers
    try:
        # Check if file exists
        file_path = os.path.join(AUDIO_DIR, filename)
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return jsonify({"error": f"Audio file not found: {filename}"}), 404

        print(f"Downloading file: {file_path}")
        return send_from_directory(AUDIO_DIR, filename, as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"Error downloading file {filename}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# small favicon route to avoid 404 noise from browsers/extensions
@app.route("/favicon.ico")
def favicon():
    from flask import send_file
    import io
    return send_file(io.BytesIO(b""), mimetype="image/x-icon")

@app.route("/login", methods=["POST"])
def login():
    from credentials import verify_google_token, verify_login

    # Accept either an id_token (Google Sign-In) or legacy email/password
    data = request.get_json(force=True) or {}
    id_token_str = data.get("id_token")

    # Google Sign-In flow
    if id_token_str:
        result = verify_google_token(id_token_str, audience=os.getenv("GOOGLE_CLIENT_ID"))

        # Check if verification was successful (no error key means success)
        if result and "error" not in result:
            user_name = result.get("name", result["email"].split('@')[0])
            # Create/get DB user
            user = get_or_create_user(result["email"], password_hash="", full_name=user_name)
            if user:
                return no_cache_json({"user_id": str(user["id"]), "name": user.get("full_name") or user_name})
            return no_cache_json({"error": "Failed to create user session"}, 500)

        # Handle specific error cases
        if result and "error" in result:
            error_type = result.get("error")
            if error_type == "unauthorized_email":
                return no_cache_json({
                    "error": result.get("message", "Unauthorized email"),
                    "email": result.get("email"),
                    "hint": "Please contact the administrator to add your email to the allowlist."
                }, 403)
            elif error_type == "token_verification_failed":
                return no_cache_json({
                    "error": "Invalid Google token",
                    "details": result.get("details", "Token verification failed")
                }, 401)
            elif error_type == "google-auth library not installed":
                return no_cache_json({
                    "error": "Server configuration error",
                    "details": "Google authentication library not installed"
                }, 500)

        return no_cache_json({"error": "Google authentication failed"}, 401)

    # Fallback to legacy email/password flow
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    if email:
        user_info = verify_login(email, password)
        if user_info:
            user_name = user_info.get("name", email.split('@')[0])
            user = get_or_create_user(email, password_hash="", full_name=user_name)
            if user:
                return no_cache_json({"user_id": str(user["id"]), "name": user.get("full_name") or user_name})
            return no_cache_json({"error": "Failed to create user session"}, 500)

    return no_cache_json({"error": "Invalid credentials"}, 401)

# Add recordings listing endpoint
@app.route("/recordings", methods=["GET"])
def list_recordings():
    user_id = request.args.get("user_id")
    if user_id:
        recs = get_voice_notes_by_user(user_id, include_subnotes=True)
    else:
        # Get all recordings if no user specified
        try:
            with get_db_session() as session:
                all_notes = session.query(VoiceNote).order_by(VoiceNote.created_at.desc()).all()
                recs = [note.to_dict() for note in all_notes]
        except Exception as e:
            print(f"[list_recordings] Error: {e}")
            recs = []

    return no_cache_json(recs)

# Related notes endpoint
@app.route("/related/<rec_id>", methods=["GET"])
def get_related_notes(rec_id):
    """
    Get related notes for a specific recording based on semantic similarity.
    Uses cached results if available, otherwise computes on-demand.

    Query parameters:
        - user_id: Required - User ID to filter results (only show user's notes)
        - limit: Optional - Maximum results (default: 5)
    """
    user_id = request.args.get("user_id")
    limit = int(request.args.get("limit", 5))

    if not user_id:
        return no_cache_json({"error": "user_id is required"}, 400)

    try:
        # Find related notes using helper function
        related = find_related_notes(
            note_id=rec_id,
            user_id=user_id,
            top_k=limit,
            use_cache=True
        )

        return no_cache_json({
            "note_id": rec_id,
            "related_notes": related,
            "count": len(related)
        })

    except Exception as e:
        print(f"[get_related_notes] Error: {e}")
        import traceback
        traceback.print_exc()
        return no_cache_json({"error": str(e)}, 500)

# Search recordings endpoint
@app.route("/search", methods=["GET"])
def search_recordings():
    """
    Search voice notes using PostgreSQL full-text search with caching.
    Query parameters:
        - user_id: Required - User ID to filter results
        - q: Required - Search query string
        - include_subnotes: Optional - Whether to include subnotes (default: true)
        - limit: Optional - Maximum results (default: 20, optimized for performance)
    """
    user_id = request.args.get("user_id")
    query = request.args.get("q", "").strip()
    include_subnotes = request.args.get("include_subnotes", "true").lower() in ("true", "1", "yes")
    limit = int(request.args.get("limit", 20))  # Reduced from 100 to 20 for 5x faster loading

    if not user_id:
        return no_cache_json({"error": "user_id is required"}, 400)

    if not query:
        return no_cache_json({"error": "search query (q) is required"}, 400)

    # Create cache key
    cache_key = f"{user_id}:{query}:{include_subnotes}:{limit}"

    # Check cache first
    cached_results = get_cached_search(cache_key)
    if cached_results is not None:
        print(f"[search] Cache hit for query: {query}")
        return no_cache_json(cached_results)

    try:
        results = search_voice_notes(
            user_id=user_id,
            query=query,
            include_subnotes=include_subnotes,
            limit=limit
        )

        # Cache the results
        set_cached_search(cache_key, results)

        return no_cache_json(results)
    except Exception as e:
        print(f"[search_recordings] Error: {e}")
        import traceback
        traceback.print_exc()
        return no_cache_json({"error": "Search failed"}, 500)

# Add summarize endpoint (used by frontend)
@app.route("/summarize/<rec_id>", methods=["POST"])
def summarize(rec_id):
    rec = get_voice_note(rec_id)
    if not rec or not rec.get("transcript"):
        return no_cache_json({"error": "no transcript"}, 400)

    summary = summarize_text(rec["transcript"])

    # Generate or refresh AI title
    title = rec.get("title", "")
    try:
        src_text = rec.get("transcript") or summary or ""
        generated_title = generate_title_from_transcript(src_text, min_words=3, max_words=5, prefer_existing=False)
        if generated_title:
            title = generated_title.strip()
    except Exception:
        if summary:
            first = summary.split(".")[0].strip()
            title = first if first else title or "Untitled"

    # Update recording
    rec = update_voice_note(rec_id, summary=summary, title=title, status="summarized")

    return no_cache_json({"message": "summarized", "summary": summary, "recording": rec})

# NEW: meeting notes endpoint
@app.route("/meeting_notes/<rec_id>", methods=["POST"])
def meeting_notes(rec_id):
    rec = get_voice_note(rec_id)
    if not rec or not rec.get("transcript"):
        return no_cache_json({"error": "no transcript"}, 400)

    notes = meeting_notes_text(rec["transcript"])
    rec = update_voice_note(rec_id, meeting_notes=notes, status="meeting_notes")

    return no_cache_json({"message": "meeting_notes_generated", "meeting_notes": notes, "recording": rec})

    # NEW: main points endpoint
@app.route("/main_points/<rec_id>", methods=["POST"])
def main_points(rec_id):
    rec = get_voice_note(rec_id)
    if not rec or not rec.get("transcript"):
        return no_cache_json({"error": "no transcript"}, 400)

    points = main_points_text(rec["transcript"])
    rec = update_voice_note(rec_id, main_points=points, status="main_points")

    return no_cache_json({"message": "main_points_generated", "main_points": points, "recording": rec})

@app.route("/todo_list/<rec_id>", methods=["POST"])
def todo_list(rec_id):
    rec = get_voice_note(rec_id)
    if not rec:
        return no_cache_json({"error": "recording not found"}, 404)

    transcript = rec.get("transcript", "").strip()
    if not transcript:
        return no_cache_json({"error": "no transcript available"}, 400)

    if len(transcript) < 50:
        return no_cache_json({"error": "transcript too short for reliable extraction"}, 400)

    try:
        todos = todo_list_text(transcript)
        rec = update_voice_note(rec_id, todo_list=todos)
        return no_cache_json({"message": "todo_generated", "recording": rec})
    except Exception as e:
        return no_cache_json({"error": f"Failed to generate to-do list: {str(e)}"}, 500)

@app.route("/email_draft/<rec_id>", methods=["POST"])
def email_draft(rec_id):
    rec = get_voice_note(rec_id)
    if not rec:
        return no_cache_json({"error": "not found"}, 404)

    transcript = rec.get("transcript", "").strip()
    if not transcript:
        return no_cache_json({"error": "no transcript available"}, 400)

    try:
        draft = generate_email_draft_text(transcript)
        rec = update_voice_note(rec_id, email_draft=draft, status="email_draft")
        return no_cache_json({"message": "email_generated", "email_draft": draft, "recording": rec})
    except Exception as e:
        return no_cache_json({"error": "email generation failed", "detail": str(e)}, 500)

@app.route("/cleanup_transcript/<rec_id>", methods=["POST"])
def cleanup_transcript(rec_id):
    rec = get_voice_note(rec_id)
    if not rec:
        return no_cache_json({"error": "not found"}, 404)

    orig = rec.get("transcript", "") or ""
    if not orig.strip():
        return no_cache_json({"error": "no transcript available"}, 400)

    try:
        cleaned = clean_transcript_text(orig)
        rec = update_voice_note(rec_id, transcript_cleaned=cleaned, status="cleaned")
        # For backward compatibility, also return as clean_transcript
        rec["clean_transcript"] = cleaned
        return no_cache_json({"message": "cleaned", "clean_transcript": cleaned, "recording": rec})
    except Exception as e:
        return no_cache_json({"error": "cleanup failed", "detail": str(e)}, 500)

@app.route("/summarize_subnotes/<parent_id>", methods=["POST"])
def summarize_subnotes(parent_id):
    """
    Summarize main note + all its subnotes together.
    Expects JSON body with 'subnote_ids' field (list of subnote IDs).
    Creates a 'subnotes_summary' field on the parent recording, displayed like other AI features.
    """
    data = request.get_json() or {}
    subnote_ids = data.get("subnote_ids", [])

    # Get parent recording from database
    parent_rec = get_voice_note(parent_id)
    if not parent_rec:
        return no_cache_json({"error": "parent recording not found"}, 404)

    # Start with main note transcript
    combined_parts = []

    # Add main note transcript if available
    main_transcript = (parent_rec.get("transcript") or "").strip()
    if main_transcript:
        main_title = parent_rec.get("title") or "Main Note"
        combined_parts.append(f"Main Note ({main_title}):\n{main_transcript}")

    # Collect transcripts from all subnotes
    if subnote_ids:
        for i, subnote_id in enumerate(subnote_ids):
            subnote = get_voice_note(subnote_id)
            if subnote and subnote.get("transcript"):
                subnote_title = subnote.get("title") or "Untitled"
                subnote_transcript = subnote.get("transcript") or ""
                combined_parts.append(f"Subnote {i+1} ({subnote_title}):\n{subnote_transcript}")

    if not combined_parts:
        return no_cache_json({"error": "no transcripts found in main note or subnotes"}, 400)

    # Combine all transcripts
    combined_text = "\n\n".join(combined_parts)

    # Generate summary using AI
    try:
        summary = summarize_text(combined_text)

        # Update parent recording with subnotes summary
        updated_rec = update_voice_note(
            parent_id,
            subnotes_summary=summary,
            status="subnotes_summarized"
        )

        if not updated_rec:
            return no_cache_json({"error": "failed to update recording with summary"}, 500)

        return no_cache_json({
            "message": "subnotes_summarized",
            "subnotes_summary": summary,
            "recording": updated_rec
        })
    except Exception as e:
        print(f"[summarize_subnotes] Error: {e}")
        import traceback
        traceback.print_exc()
        return no_cache_json({"error": "failed to summarize subnotes", "detail": str(e)}, 500)

@app.route("/ask_ai/<rec_id>", methods=["POST"])
def ask_ai(rec_id):
    """
    Answer a user's question about one or more recording transcripts.
    Uses semantic search (embeddings) to find relevant chunks for better accuracy and lower cost.

    Expects JSON body with:
    - 'question' field (required)
    - optional 'save_to_server' boolean
    - optional 'rec_ids' array of additional recording IDs to include
    - optional 'use_semantic_search' boolean (default: True)

    If rec_ids is provided, transcripts from all recordings will be combined.
    Otherwise, only the rec_id from the URL will be used (backward compatible).
    """
    # Get question from request body
    data = request.get_json() or {}
    question = data.get("question", "").strip()
    save_to_server = data.get("save_to_server", True)
    additional_rec_ids = data.get("rec_ids", [])
    use_semantic_search = data.get("use_semantic_search", True)  # Default to True

    if not question:
        return no_cache_json({"error": "no question provided"}, 400)

    # Collect all recording IDs (URL param + optional rec_ids from body)
    all_rec_ids = [rec_id]
    if additional_rec_ids and isinstance(additional_rec_ids, list):
        # Add additional IDs, avoiding duplicates
        for rid in additional_rec_ids:
            if rid not in all_rec_ids:
                all_rec_ids.append(rid)

    # Validate recordings exist
    valid_recs = []
    for rid in all_rec_ids:
        rec = get_voice_note(rid)
        if rec:
            valid_recs.append(rec)

    if not valid_recs:
        return no_cache_json({"error": "no recordings found"}, 404)

    try:
        # SEMANTIC SEARCH APPROACH (using note_chunks)
        if use_semantic_search:
            print(f"[ask_ai] Using semantic search for question: {question[:100]}...")

            # Step 1: Generate embedding for the question
            question_embedding = get_embedding(question)

            if question_embedding:
                # Step 2: Find most relevant chunks across all selected notes
                relevant_chunks = search_chunks_by_similarity(
                    note_ids=all_rec_ids,
                    query_embedding=question_embedding,
                    top_k=5,  # Get top 5 most relevant chunks
                    similarity_threshold=0.3  # Minimum similarity score
                )

                if relevant_chunks:
                    # Step 3: Use only relevant chunks as context
                    context = "\n\n".join([chunk['text'] for chunk in relevant_chunks])
                    print(f"[ask_ai] Found {len(relevant_chunks)} relevant chunks (total {len(context)} chars)")

                    # Include similarity scores in debug log
                    for i, chunk in enumerate(relevant_chunks):
                        similarity = chunk.get('similarity', 0)
                        print(f"[ask_ai] Chunk {i+1}: similarity={similarity:.3f}, length={len(chunk['text'])} chars")

                    # Use semantic search result
                    answer = ask_ai_about_transcript(context, question)

                    return_data = {
                        "answer": answer,
                        "method": "semantic_search",
                        "chunks_used": len(relevant_chunks)
                    }

                    # Save chat history if requested
                    if save_to_server and valid_recs:
                        save_chat_history(
                            note_id=valid_recs[0].get('id'),
                            user_id=valid_recs[0].get('user_id'),
                            question=question,
                            answer=answer
                        )

                    return no_cache_json(return_data)

            # If semantic search didn't work (no embedding or no chunks), fall back
            print(f"[ask_ai] Semantic search unavailable, falling back to full transcript")

        # FALLBACK: Traditional approach (full transcripts)
        print(f"[ask_ai] Using full transcript approach")
        transcripts = []
        for rec in valid_recs:
            transcript = rec.get("transcript", "") or ""
            if transcript.strip():
                transcripts.append(transcript)

        if not transcripts:
            return no_cache_json({"error": "no transcript available"}, 400)

        # Combine all transcripts
        combined_transcript = "\n\n---\n\n".join(transcripts)
        print(f"[ask_ai] Using full transcript ({len(combined_transcript)} chars)")

        # Use AI to answer the question based on combined transcript(s)
        answer = ask_ai_about_transcript(combined_transcript, question)

        return_data = {
            "answer": answer,
            "method": "full_transcript"
        }

        # Save chat history if requested (use first recording for backward compatibility)
        if save_to_server and valid_recs:
            save_chat_history(
                note_id=valid_recs[0].get('id'),
                user_id=valid_recs[0].get('user_id'),
                question=question,
                answer=answer
            )

        return no_cache_json(return_data)
    except Exception as e:
        print(f"[ask_ai] Error: {e}")
        import traceback
        traceback.print_exc()
        return no_cache_json({"error": "failed to answer question", "detail": str(e)}, 500)

@app.route("/chat_history/<rec_id>", methods=["GET"])
def get_chat_history_route(rec_id):
    """
    Get the chat history for a specific recording.
    Returns array of {question, answer, timestamp} objects.
    """
    try:
        history = get_chat_history(rec_id)
        return no_cache_json({"history": history})
    except Exception as e:
        return no_cache_json({"error": "failed to load chat history", "detail": str(e)}, 500)

@app.route("/header_ask_ai_history", methods=["GET"])
def get_header_ask_ai_history_route():
    """
    Get chat history from the header Ask AI modal.
    Optionally filter by user_id query parameter.
    Returns array of chat sessions.
    """
    try:
        user_id = request.args.get("user_id")
        print(f"[header_ask_ai_history GET] user_id: {user_id}")
        history = get_header_chat_history(user_id=user_id, limit=50)
        print(f"[header_ask_ai_history GET] Retrieved {len(history)} history items")
        return no_cache_json({"history": history})
    except Exception as e:
        print(f"[header_ask_ai_history GET] Error: {e}")
        return no_cache_json({"error": "failed to load header ask ai history", "detail": str(e)}, 500)

@app.route("/header_ask_ai_history", methods=["POST"])
def save_header_ask_ai_history_route():
    """
    Save a chat session from the header Ask AI modal.
    Expects JSON body with chat data.
    """
    data = request.get_json() or {}
    if not data:
        return no_cache_json({"error": "no data provided"}, 400)

    try:
        print(f"[header_ask_ai_history POST] Saving chat data: id={data.get('id')}, user_id={data.get('user_id')}, rec_id={data.get('recId')}, title={data.get('title')}")
        result = save_header_chat_history(
            chat_id=data.get('id'),
            user_id=data.get('user_id'),
            rec_id=data.get('recId'),
            title=data.get('title', ''),
            messages=data.get('messages', [])
        )
        print(f"[header_ask_ai_history POST] Save result: {result}")
        return no_cache_json({"message": "history saved successfully", "result": result})
    except Exception as e:
        print(f"[header_ask_ai_history POST] Error: {e}")
        import traceback
        traceback.print_exc()
        return no_cache_json({"error": "failed to save history", "detail": str(e)}, 500)

@app.route("/header_ask_ai_history/<chat_id>", methods=["DELETE"])
def delete_header_ask_ai_history_route(chat_id):
    """
    Delete a specific chat session from header Ask AI history.
    """
    try:
        success = delete_header_chat_history(chat_id)
        if success:
            return no_cache_json({"message": "chat deleted successfully"})
        else:
            return no_cache_json({"message": "chat not found"}, 404)
    except Exception as e:
        return no_cache_json({"error": "failed to delete chat", "detail": str(e)}, 500)

@app.route("/create_content", methods=["POST"])
def create_content():
    """
    Create content (summary, email, todo list, etc.) from one or more recordings.
    Expects JSON body with:
    - option: 'summary' | 'meeting-report' | 'todo' | 'email' | 'main-points' | 'cleanup'
    - rec_ids: array of recording IDs
    """
    data = request.get_json() or {}
    option = data.get("option", "").strip()
    rec_ids = data.get("rec_ids", [])

    if not option:
        return no_cache_json({"error": "no option provided"}, 400)

    if not rec_ids or not isinstance(rec_ids, list):
        return no_cache_json({"error": "no recording IDs provided"}, 400)

    # Get transcripts for selected recordings from database
    transcripts = []
    for rec_id in rec_ids:
        rec = get_voice_note(rec_id)
        if rec:
            transcript = rec.get("transcript", "") or ""
            if transcript.strip():
                transcripts.append(transcript)

    if not transcripts:
        return no_cache_json({"error": "no valid transcripts found"}, 400)

    # Combine transcripts if multiple
    combined_transcript = "\n\n---\n\n".join(transcripts)

    try:
        # Call appropriate AI function based on option
        if option == "summary":
            result = summarize_text(combined_transcript)
        elif option == "meeting-report":
            result = meeting_notes_text(combined_transcript)
        elif option == "todo":
            result = todo_list_text(combined_transcript)
        elif option == "email":
            result = generate_email_draft_text(combined_transcript)
        elif option == "main-points":
            result = main_points_text(combined_transcript)
        elif option == "cleanup":
            result = clean_transcript_text(combined_transcript)
        else:
            return no_cache_json({"error": f"unknown option: {option}"}, 400)

        return no_cache_json({
            "option": option,
            "result": result,
            "rec_count": len(transcripts)
        })

    except Exception as e:
        return no_cache_json({"error": "failed to create content", "detail": str(e)}, 500)


# Add delete endpoint (used by frontend)
@app.route('/delete/<recording_id>', methods=['POST'])
def delete_recording(recording_id):
    """Delete a recording by id: remove audio file (if exists) and remove entry from database."""
    # Get recording first
    rec = get_voice_note(recording_id)
    if not rec:
        return no_cache_json({"error": "recording not found"}, 404)

    # Remove audio file if exists
    audio_path = resolve_audio_path(rec.get("audio_path", ""))
    if audio_path and os.path.exists(audio_path):
        try:
            os.remove(audio_path)
        except Exception as e:
            print(f"[delete_recording] Failed to delete audio file: {e}")

    # Delete from database
    success = delete_voice_note(recording_id)
    if success:
        # Get updated list for frontend
        user_id = rec.get("user_id")
        if user_id:
            recs = get_voice_notes_by_user(user_id)
        else:
            recs = []

        return no_cache_json({"success": True, "recordings": recs}, 200)
    else:
        return no_cache_json({"error": "failed to delete recording"}, 500)

#if __name__ == "__main__":
#app.run(debug=True)
    
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        use_reloader=False
    )
