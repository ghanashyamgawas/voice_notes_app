"""
Database configuration and connection management for Voice Notes MVP.
Supports PostgreSQL + pgvector for storing voice notes, embeddings, and user data.
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import NullPool
from contextlib import contextmanager

# Base class for all models
Base = declarative_base()

# Database connection settings from environment variables
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/voice_notes"
)

# Flag to enable/disable database usage
USE_DATABASE = os.getenv("USE_DATABASE", "false").lower() in ("true", "1", "yes")

# SQLAlchemy engine
engine = None
SessionLocal = None


def init_db(database_url=None, echo=False):
    """
    Initialize the database connection and session factory.

    Args:
        database_url: PostgreSQL connection string (optional, uses env var if not provided)
        echo: Whether to log SQL queries (default: False)

    Returns:
        tuple: (engine, SessionLocal) or (None, None) if database is disabled
    """
    global engine, SessionLocal

    if not USE_DATABASE:
        print("[Database] Database usage is disabled (USE_DATABASE=false)")
        return None, None

    url = database_url or DATABASE_URL

    try:
        # Create engine with connection pooling
        engine = create_engine(
            url,
            echo=echo,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,  # Verify connections before using
            pool_recycle=3600,   # Recycle connections after 1 hour
        )

        # Register pgvector extension (if not already registered)
        @event.listens_for(engine, "connect")
        def register_vector(dbapi_conn, connection_record):
            """Register pgvector extension on new connections."""
            try:
                # Use raw DBAPI cursor for extension creation
                cursor = dbapi_conn.cursor()
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
                dbapi_conn.commit()
                cursor.close()
            except Exception as e:
                # Extension might already exist or require superuser privileges
                # Log but don't fail - this is normal behavior
                pass

        # Create session factory
        SessionLocal = scoped_session(
            sessionmaker(autocommit=False, autoflush=False, bind=engine)
        )

        print(f"[Database] Successfully initialized database connection")
        return engine, SessionLocal

    except Exception as e:
        print(f"[Database] Failed to initialize database: {e}")
        print(f"[Database] Falling back to JSON file storage")
        return None, None


@contextmanager
def get_db_session():
    """
    Context manager for database sessions.
    Automatically commits on success, rolls back on error, and closes the session.

    Usage:
        with get_db_session() as session:
            user = session.query(User).filter_by(email='test@example.com').first()
    """
    if not SessionLocal:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_db():
    """
    Dependency for getting database sessions (useful for Flask routes).
    Yields a session and ensures it's closed after use.

    Usage in Flask:
        @app.route('/users')
        def list_users():
            db = next(get_db())
            users = db.query(User).all()
            return jsonify([u.to_dict() for u in users])
    """
    if not SessionLocal:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_tables():
    """
    Create all database tables defined in models.
    This should be called after all models are imported.

    Note: In production, use Alembic migrations instead.
    """
    if not engine:
        print("[Database] Cannot create tables: database not initialized")
        return False

    try:
        Base.metadata.create_all(bind=engine)
        print("[Database] Successfully created all tables")
        return True
    except Exception as e:
        print(f"[Database] Failed to create tables: {e}")
        return False


def drop_tables():
    """
    Drop all database tables. USE WITH CAUTION!
    Only for development/testing.
    """
    if not engine:
        print("[Database] Cannot drop tables: database not initialized")
        return False

    try:
        Base.metadata.drop_all(bind=engine)
        print("[Database] Successfully dropped all tables")
        return True
    except Exception as e:
        print(f"[Database] Failed to drop tables: {e}")
        return False


def check_db_connection():
    """
    Check if database connection is working.

    Returns:
        bool: True if connection is healthy, False otherwise
    """
    if not engine:
        return False

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[Database] Connection check failed: {e}")
        return False


def is_db_enabled():
    """Check if database usage is enabled."""
    return USE_DATABASE and engine is not None


# Initialize database on module import if enabled
if USE_DATABASE:
    init_db()
