"""
Database package for Voice Notes MVP.
Provides database connection, models, and helper functions.
"""

from database.config import (
    init_db,
    get_db_session,
    get_db,
    create_tables,
    is_db_enabled,
    check_db_connection,
    Base
)

from database.models import (
    User,
    VoiceNote,
    NoteChunk,
    ChatHistory,
    HeaderChatHistory
)

__all__ = [
    # Config
    'init_db',
    'get_db_session',
    'get_db',
    'create_tables',
    'is_db_enabled',
    'check_db_connection',
    'Base',

    # Models
    'User',
    'VoiceNote',
    'NoteChunk',
    'ChatHistory',
    'HeaderChatHistory',
]
