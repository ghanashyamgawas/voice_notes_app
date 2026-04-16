"""
Database helper functions for Voice Notes MVP.
Provides convenient methods for saving and retrieving data.
Falls back to JSON file storage if database is not available.
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any

from database.config import get_db_session, is_db_enabled
from database.models import (
    User, VoiceNote, ChatHistory, HeaderChatHistory, NoteChunk
)


def create_voice_note(
    user_id: str,
    title: str = "",
    audio_path: str = "",
    audio_url: str = "",
    status: str = "processing",
    parent_id: Optional[str] = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """
    Create a new voice note in the database.

    Args:
        user_id: User ID (UUID as string)
        title: Note title
        audio_path: Path to audio file
        audio_url: URL for audio playback
        status: Processing status
        parent_id: Parent note ID for subnotes
        **kwargs: Additional fields (metadata, transcript, etc.)

    Returns:
        Dictionary representation of the created note, or None if database is disabled
    """
    if not is_db_enabled():
        return None

    try:
        with get_db_session() as session:
            # Create note with explicit field mapping
            note_data = {
                'id': uuid.uuid4(),
                'user_id': uuid.UUID(user_id) if user_id else None,
                'parent_id': uuid.UUID(parent_id) if parent_id else None,
                'title': title,
                'audio_path': audio_path,
                'file_url': audio_url,
                'status': status,
            }

            # Add any additional fields from kwargs
            for key, value in kwargs.items():
                if hasattr(VoiceNote, key):
                    note_data[key] = value

            note = VoiceNote(**note_data)
            session.add(note)
            session.commit()
            session.refresh(note)
            return note.to_dict()
    except Exception as e:
        print(f"[Database] Error creating voice note: {e}")
        import traceback
        traceback.print_exc()
        return None


def update_voice_note(note_id: str, **updates) -> Optional[Dict[str, Any]]:
    """
    Update an existing voice note.

    Args:
        note_id: Note ID (UUID as string)
        **updates: Fields to update

    Returns:
        Updated note as dictionary, or None if not found/database disabled
    """
    if not is_db_enabled():
        return None

    try:
        with get_db_session() as session:
            note = session.query(VoiceNote).filter_by(id=uuid.UUID(note_id)).first()
            if not note:
                return None

            for key, value in updates.items():
                if hasattr(note, key):
                    setattr(note, key, value)

            session.commit()
            session.refresh(note)
            return note.to_dict()
    except Exception as e:
        print(f"[Database] Error updating voice note: {e}")
        return None


def get_voice_note(note_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a voice note by ID.

    Args:
        note_id: Note ID (UUID as string)

    Returns:
        Note as dictionary, or None if not found/database disabled
    """
    if not is_db_enabled():
        return None

    try:
        with get_db_session() as session:
            note = session.query(VoiceNote).filter_by(id=uuid.UUID(note_id)).first()
            return note.to_dict() if note else None
    except Exception as e:
        print(f"[Database] Error getting voice note: {e}")
        return None


def get_voice_notes_by_user(user_id: str, include_subnotes: bool = True) -> List[Dict[str, Any]]:
    """
    Get all voice notes for a user.

    Args:
        user_id: User ID (UUID as string)
        include_subnotes: Whether to include subnotes (default: True)

    Returns:
        List of notes as dictionaries
    """
    if not is_db_enabled():
        return []

    try:
        with get_db_session() as session:
            query = session.query(VoiceNote).filter_by(user_id=uuid.UUID(user_id))

            if not include_subnotes:
                query = query.filter(VoiceNote.parent_id.is_(None))

            notes = query.order_by(VoiceNote.created_at.desc()).all()
            return [note.to_dict() for note in notes]
    except Exception as e:
        print(f"[Database] Error getting voice notes: {e}")
        return []


def delete_voice_note(note_id: str) -> bool:
    """
    Delete a voice note.

    Args:
        note_id: Note ID (UUID as string)

    Returns:
        True if deleted, False otherwise
    """
    if not is_db_enabled():
        return False

    try:
        with get_db_session() as session:
            note = session.query(VoiceNote).filter_by(id=uuid.UUID(note_id)).first()
            if note:
                session.delete(note)
                session.commit()
                return True
            return False
    except Exception as e:
        print(f"[Database] Error deleting voice note: {e}")
        return False


def save_chat_history(
    note_id: str,
    user_id: Optional[str],
    question: str,
    answer: str
) -> Optional[Dict[str, Any]]:
    """
    Save a chat history entry for a note.

    Args:
        note_id: Note ID (UUID as string)
        user_id: User ID (UUID as string, optional)
        question: User question
        answer: AI answer

    Returns:
        Chat entry as dictionary, or None if database disabled
    """
    if not is_db_enabled():
        return None

    try:
        with get_db_session() as session:
            chat = ChatHistory(
                id=uuid.uuid4(),
                note_id=uuid.UUID(note_id),
                user_id=uuid.UUID(user_id) if user_id else None,
                question=question,
                answer=answer
            )
            session.add(chat)
            session.commit()
            session.refresh(chat)
            return chat.to_dict()
    except Exception as e:
        print(f"[Database] Error saving chat history: {e}")
        return None


def get_chat_history(note_id: str) -> List[Dict[str, Any]]:
    """
    Get chat history for a note.

    Args:
        note_id: Note ID (UUID as string)

    Returns:
        List of chat entries as dictionaries
    """
    if not is_db_enabled():
        return []

    try:
        with get_db_session() as session:
            chats = session.query(ChatHistory).filter_by(
                note_id=uuid.UUID(note_id)
            ).order_by(ChatHistory.created_at.asc()).all()
            return [chat.to_dict() for chat in chats]
    except Exception as e:
        print(f"[Database] Error getting chat history: {e}")
        return []


def save_header_chat_history(
    chat_id: Optional[str],
    user_id: Optional[str],
    rec_id: Optional[str],
    title: str,
    messages: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Save or update header chat history.

    Args:
        chat_id: Existing chat ID for update, or None for new chat
        user_id: User ID (UUID as string, optional)
        rec_id: Recording ID associated with this chat (optional)
        title: Chat title
        messages: List of message objects

    Returns:
        Chat entry as dictionary, or None if database disabled
    """
    if not is_db_enabled():
        return None

    try:
        with get_db_session() as session:
            if chat_id:
                # Try to parse as UUID, if invalid format, create new
                try:
                    chat_uuid = uuid.UUID(chat_id)
                    # Update existing
                    chat = session.query(HeaderChatHistory).filter_by(
                        id=chat_uuid
                    ).first()
                    if chat:
                        chat.title = title
                        chat.rec_id = rec_id
                        chat.messages = messages
                        chat.updated_at = datetime.utcnow()
                    else:
                        # Not found, create new with provided UUID
                        chat = HeaderChatHistory(
                            id=chat_uuid,
                            user_id=uuid.UUID(user_id) if user_id else None,
                            rec_id=rec_id,
                            title=title,
                            messages=messages
                        )
                        session.add(chat)
                except ValueError:
                    # Invalid UUID format, create new with auto-generated UUID
                    print(f"[Database] Invalid UUID format for chat_id: {chat_id}, creating new")
                    chat = HeaderChatHistory(
                        id=uuid.uuid4(),
                        user_id=uuid.UUID(user_id) if user_id else None,
                        rec_id=rec_id,
                        title=title,
                        messages=messages
                    )
                    session.add(chat)
            else:
                # Create new
                chat = HeaderChatHistory(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(user_id) if user_id else None,
                    rec_id=rec_id,
                    title=title,
                    messages=messages
                )
                session.add(chat)

            session.commit()
            session.refresh(chat)
            return chat.to_dict()
    except Exception as e:
        print(f"[Database] Error saving header chat history: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_header_chat_history(user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get header chat history.

    Args:
        user_id: Filter by user ID (optional)
        limit: Maximum number of chats to return

    Returns:
        List of chat entries as dictionaries
    """
    if not is_db_enabled():
        return []

    try:
        with get_db_session() as session:
            query = session.query(HeaderChatHistory)
            if user_id:
                query = query.filter_by(user_id=uuid.UUID(user_id))

            chats = query.order_by(
                HeaderChatHistory.updated_at.desc()
            ).limit(limit).all()
            return [chat.to_dict() for chat in chats]
    except Exception as e:
        print(f"[Database] Error getting header chat history: {e}")
        return []


def delete_header_chat_history(chat_id: str) -> bool:
    """
    Delete a header chat history entry.

    Args:
        chat_id: Chat ID (UUID as string)

    Returns:
        True if deleted, False otherwise
    """
    if not is_db_enabled():
        return False

    try:
        with get_db_session() as session:
            chat = session.query(HeaderChatHistory).filter_by(
                id=uuid.UUID(chat_id)
            ).first()
            if chat:
                session.delete(chat)
                session.commit()
                return True
            return False
    except Exception as e:
        print(f"[Database] Error deleting header chat history: {e}")
        return False


def get_or_create_user(email: str, password_hash: str, **kwargs) -> Optional[Dict[str, Any]]:
    """
    Get existing user by email or create new one.

    Args:
        email: User email
        password_hash: Hashed password
        **kwargs: Additional user fields

    Returns:
        User as dictionary, or None if database disabled
    """
    if not is_db_enabled():
        return None

    try:
        with get_db_session() as session:
            user = session.query(User).filter_by(email=email.lower()).first()
            if user:
                return user.to_dict()

            # Create new user
            user = User(
                id=uuid.uuid4(),
                email=email.lower(),
                password_hash=password_hash,
                **kwargs
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user.to_dict()
    except Exception as e:
        print(f"[Database] Error getting/creating user: {e}")
        return None


def search_voice_notes(
    user_id: str,
    query: str,
    include_subnotes: bool = True,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Search voice notes using PostgreSQL full-text search.

    Args:
        user_id: User ID to filter results
        query: Search query string
        include_subnotes: Whether to include subnotes in results
        limit: Maximum number of results to return

    Returns:
        List of matching voice notes sorted by relevance
    """
    if not is_db_enabled():
        return []

    if not query or not query.strip():
        return []

    try:
        from sqlalchemy import func, text

        with get_db_session() as session:
            # Convert query to tsquery format
            # Replace spaces with & for AND search, or use | for OR
            search_query = query.strip()

            # Create the search query using ts_rank for relevance scoring
            # ts_rank returns higher scores for better matches
            # plainto_tsquery converts plain text to tsquery format
            tsquery = func.plainto_tsquery('english', search_query)

            # Optimize: Use ts_rank_cd (with cover density) for better performance
            # and only load necessary columns initially
            base_query = session.query(
                VoiceNote.id,
                VoiceNote.user_id,
                VoiceNote.parent_id,
                VoiceNote.title,
                VoiceNote.status,
                VoiceNote.created_at,
                func.ts_rank_cd(VoiceNote.search_vector, tsquery).label('rank')
            ).filter(
                VoiceNote.user_id == uuid.UUID(user_id),
                VoiceNote.search_vector.op('@@')(tsquery)
            )

            # Filter by parent_id if not including subnotes
            if not include_subnotes:
                base_query = base_query.filter(VoiceNote.parent_id.is_(None))

            # Order by relevance (rank) descending, then by created_at descending
            # Limit early to reduce data transfer
            initial_results = base_query.order_by(
                text('rank DESC'),
                VoiceNote.created_at.desc()
            ).limit(limit).all()

            # Now fetch full objects only for the matched IDs
            if not initial_results:
                return []

            matched_ids = [row.id for row in initial_results]
            rank_map = {row.id: float(row.rank) for row in initial_results}

            # Fetch full note objects
            full_notes = session.query(VoiceNote).filter(
                VoiceNote.id.in_(matched_ids)
            ).all()

            # Convert to dictionaries, add rank, and sort by rank
            notes = []
            for note in full_notes:
                note_dict = note.to_dict()
                note_dict['search_rank'] = rank_map.get(note.id, 0.0)
                notes.append(note_dict)

            # Sort by rank (descending) since the second query doesn't maintain order
            notes.sort(key=lambda x: x['search_rank'], reverse=True)

            return notes

    except Exception as e:
        print(f"[Database] Error searching voice notes: {e}")
        import traceback
        traceback.print_exc()
        return []


# ============================================================================
# Note Chunks (Embeddings for Semantic Search)
# ============================================================================

def create_note_chunks(
    note_id: str,
    chunks: List[Dict[str, Any]],
    embedding_model: str = "text-embedding-3-small"
) -> bool:
    """
    Create multiple chunks for a note with embeddings.

    Args:
        note_id: Voice note ID
        chunks: List of dictionaries with 'text', 'index', 'embedding' keys
        embedding_model: Name of the embedding model used

    Returns:
        True if successful, False otherwise
    """
    if not is_db_enabled():
        return False

    try:
        with get_db_session() as session:
            # Delete existing chunks for this note (if re-generating)
            session.query(NoteChunk).filter(
                NoteChunk.note_id == uuid.UUID(note_id)
            ).delete()

            # Create new chunks
            for chunk_data in chunks:
                chunk = NoteChunk(
                    id=uuid.uuid4(),
                    note_id=uuid.UUID(note_id),
                    chunk_index=chunk_data['index'],
                    text=chunk_data['text'],
                    chunk_metadata=chunk_data.get('metadata'),
                    embedding=chunk_data.get('embedding'),
                    embedding_model=embedding_model,
                    embedding_created_at=datetime.utcnow() if chunk_data.get('embedding') else None
                )
                session.add(chunk)

            session.commit()
            print(f"[Database] Created {len(chunks)} chunks for note {note_id}")
            return True

    except Exception as e:
        print(f"[Database] Error creating note chunks: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_note_chunks(note_id: str) -> List[Dict[str, Any]]:
    """
    Get all chunks for a specific note.

    Args:
        note_id: Voice note ID

    Returns:
        List of chunk dictionaries
    """
    if not is_db_enabled():
        return []

    try:
        with get_db_session() as session:
            chunks = session.query(NoteChunk).filter(
                NoteChunk.note_id == uuid.UUID(note_id)
            ).order_by(NoteChunk.chunk_index).all()

            return [chunk.to_dict() for chunk in chunks]

    except Exception as e:
        print(f"[Database] Error getting note chunks: {e}")
        return []


def search_chunks_by_similarity(
    note_ids: List[str],
    query_embedding: List[float],
    top_k: int = 5,
    similarity_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Find the most relevant chunks using vector similarity search.

    Args:
        note_ids: List of voice note IDs to search within
        query_embedding: The embedding vector of the query
        top_k: Number of top results to return
        similarity_threshold: Minimum similarity score (0-1)

    Returns:
        List of chunk dictionaries with similarity scores, ordered by relevance
    """
    if not is_db_enabled():
        return []

    if not note_ids or not query_embedding:
        return []

    try:
        with get_db_session() as session:
            # Convert note_ids to UUIDs
            note_uuids = [uuid.UUID(nid) for nid in note_ids]

            # Vector similarity search using cosine distance
            # Lower distance = higher similarity
            # Note: pgvector's cosine_distance returns 0-2 (0 = identical, 2 = opposite)
            results = session.query(
                NoteChunk,
                NoteChunk.embedding.cosine_distance(query_embedding).label('distance')
            ).filter(
                NoteChunk.note_id.in_(note_uuids),
                NoteChunk.embedding.isnot(None)
            ).order_by(
                'distance'
            ).limit(top_k).all()

            # Convert to dictionaries and add similarity score
            chunks = []
            for chunk, distance in results:
                # Convert distance to similarity (1 - distance/2)
                # This gives us 0-1 scale where 1 = identical
                similarity = 1 - (distance / 2)

                if similarity >= similarity_threshold:
                    chunk_dict = chunk.to_dict()
                    chunk_dict['similarity'] = similarity
                    chunk_dict['distance'] = distance
                    chunks.append(chunk_dict)

            print(f"[Database] Found {len(chunks)} relevant chunks from {len(note_ids)} notes")
            return chunks

    except Exception as e:
        print(f"[Database] Error searching chunks: {e}")
        import traceback
        traceback.print_exc()
        return []


def delete_note_chunks(note_id: str) -> bool:
    """
    Delete all chunks for a specific note.

    Args:
        note_id: Voice note ID

    Returns:
        True if successful, False otherwise
    """
    if not is_db_enabled():
        return False

    try:
        with get_db_session() as session:
            deleted_count = session.query(NoteChunk).filter(
                NoteChunk.note_id == uuid.UUID(note_id)
            ).delete()

            session.commit()
            print(f"[Database] Deleted {deleted_count} chunks for note {note_id}")
            return True

    except Exception as e:
        print(f"[Database] Error deleting note chunks: {e}")
        return False


def find_related_notes(
    note_id: str,
    user_id: str,
    top_k: int = 5,
    use_cache: bool = True,
    min_similarity: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Find notes most similar to the given note using vector embeddings.
    Uses cached results if available, otherwise computes similarity on-demand.

    Args:
        note_id: The note ID to find related notes for
        user_id: User ID to filter notes (only search within user's notes)
        top_k: Maximum number of related notes to return (default 5)
        use_cache: Whether to use/update cache in metadata (default True)
        min_similarity: Minimum similarity score (0-1) to consider a note related (default 0.5 = 50%)

    Returns:
        List of related note dictionaries with basic info (id, title, created_at, similarity)
    """
    if not is_db_enabled():
        return []

    try:
        with get_db_session() as session:
            from sqlalchemy import func, and_

            # Get the source note
            source_note = session.query(VoiceNote).filter_by(id=uuid.UUID(note_id)).first()
            if not source_note:
                return []

            # Check cache first (if enabled)
            if use_cache and source_note.note_metadata:
                cached_related = source_note.note_metadata.get('related_notes')
                if cached_related:
                    # Fetch cached note details
                    cached_note_ids = [uuid.UUID(r['note_id']) for r in cached_related[:top_k]]
                    cached_notes = session.query(VoiceNote).filter(
                        VoiceNote.id.in_(cached_note_ids)
                    ).all()

                    # Return in cached order with similarity scores
                    result = []
                    for cached_item in cached_related[:top_k]:
                        note = next((n for n in cached_notes if str(n.id) == cached_item['note_id']), None)
                        if note:
                            result.append({
                                'id': str(note.id),
                                'title': note.title,
                                'created_at': note.created_at.isoformat() if note.created_at else None,
                                'similarity': cached_item.get('similarity', 0)
                            })

                    if result:
                        print(f"[Database] Using cached related notes for {note_id}")
                        return result

            # No cache, compute similarity
            # Get all chunks for the source note
            source_chunks = session.query(NoteChunk).filter(
                and_(
                    NoteChunk.note_id == uuid.UUID(note_id),
                    NoteChunk.embedding.isnot(None)
                )
            ).all()

            if not source_chunks:
                print(f"[Database] No chunks found for note {note_id}")
                return []

            # Average the chunk embeddings to get note-level embedding
            source_embedding = [0.0] * len(source_chunks[0].embedding)
            for chunk in source_chunks:
                for i, val in enumerate(chunk.embedding):
                    source_embedding[i] += val

            # Divide by count to get average
            chunk_count = len(source_chunks)
            source_embedding = [val / chunk_count for val in source_embedding]

            # Find similar notes by averaging their chunk embeddings and comparing
            # Query all other user's notes that have embeddings
            # Exclude subnotes (only match with other main notes)
            other_notes_query = session.query(VoiceNote.id).filter(
                and_(
                    VoiceNote.user_id == uuid.UUID(user_id),
                    VoiceNote.id != uuid.UUID(note_id),
                    VoiceNote.parent_id.is_(None),  # Only main notes, not subnotes
                    VoiceNote.status != 'error'
                )
            ).all()

            other_note_ids = [n.id for n in other_notes_query]

            if not other_note_ids:
                return []

            # Compute similarity for each note
            note_similarities = []
            for other_note_id in other_note_ids:
                # Get chunks for this note
                other_chunks = session.query(NoteChunk).filter(
                    and_(
                        NoteChunk.note_id == other_note_id,
                        NoteChunk.embedding.isnot(None)
                    )
                ).all()

                if not other_chunks:
                    continue

                # Average embeddings
                other_embedding = [0.0] * len(other_chunks[0].embedding)
                for chunk in other_chunks:
                    for i, val in enumerate(chunk.embedding):
                        other_embedding[i] += val

                other_count = len(other_chunks)
                other_embedding = [val / other_count for val in other_embedding]

                # Calculate cosine similarity in Python
                # (Using pgvector would be more efficient but requires subqueries)
                dot_product = sum(a * b for a, b in zip(source_embedding, other_embedding))
                mag_source = sum(a * a for a in source_embedding) ** 0.5
                mag_other = sum(b * b for b in other_embedding) ** 0.5

                if mag_source > 0 and mag_other > 0:
                    similarity = dot_product / (mag_source * mag_other)
                    # Convert to Python float to avoid JSON serialization issues
                    note_similarities.append((other_note_id, float(similarity)))

            # Sort by similarity (highest first) and filter by minimum threshold
            note_similarities.sort(key=lambda x: x[1], reverse=True)

            # Filter out notes below the minimum similarity threshold
            filtered_similar = [(note_id, sim) for note_id, sim in note_similarities if sim >= min_similarity]

            # Take top_k from filtered results
            top_similar = filtered_similar[:top_k]

            if not top_similar:
                print(f"[Database] No related notes found above similarity threshold {min_similarity}")
                return []

            # Fetch note details
            similar_note_ids = [ns[0] for ns in top_similar]
            similar_notes = session.query(VoiceNote).filter(
                VoiceNote.id.in_(similar_note_ids)
            ).all()

            # Build result list in order of similarity
            result = []
            cache_data = []
            for note_id_uuid, similarity in top_similar:
                note = next((n for n in similar_notes if n.id == note_id_uuid), None)
                if note:
                    # Ensure similarity is a Python float, not numpy float32
                    similarity_float = float(round(float(similarity), 4))
                    result.append({
                        'id': str(note.id),
                        'title': note.title,
                        'created_at': note.created_at.isoformat() if note.created_at else None,
                        'similarity': similarity_float
                    })
                    cache_data.append({
                        'note_id': str(note.id),
                        'similarity': similarity_float
                    })

            # Update cache if enabled
            if use_cache and result:
                current_metadata = source_note.note_metadata or {}
                current_metadata['related_notes'] = cache_data
                current_metadata['related_notes_updated_at'] = datetime.utcnow().isoformat()
                source_note.note_metadata = current_metadata
                session.commit()
                print(f"[Database] Cached {len(result)} related notes for {note_id}")

            print(f"[Database] Found {len(result)} related notes for {note_id}")
            return result

    except Exception as e:
        print(f"[Database] Error finding related notes: {e}")
        import traceback
        traceback.print_exc()
        return []
