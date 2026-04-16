#!/usr/bin/env python3
"""
Seed the database with initial data (test user).
Run this after setting up the database schema.
"""

import os
import sys
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

# Force database to be enabled
os.environ["USE_DATABASE"] = "true"

from database import init_db, get_db_session, User

def seed_database():
    """Seed database with initial test data."""
    print("=" * 60)
    print("Voice Notes MVP - Database Seeding")
    print("=" * 60)

    # Initialize database
    print("\n[1/3] Initializing database connection...")
    engine, session_factory = init_db()
    if not engine:
        print("❌ Failed to initialize database!")
        print("   Check your DATABASE_URL in .env file.")
        return False

    print("✓ Database connection established")

    # Create test user
    print("\n[2/3] Creating test user...")
    try:
        with get_db_session() as session:
            # Check if user already exists
            existing = session.query(User).filter_by(email="test@example.com").first()
            if existing:
                print(f"✓ Test user already exists (ID: {existing.id})")
                return True

            # Create new user
            import uuid
            user = User(
                id=uuid.uuid4(),
                email="test@example.com",
                password_hash="password123",  # Note: Use proper hashing in production!
                full_name="Test User"
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            print(f"✓ Created test user:")
            print(f"   Email: test@example.com")
            print(f"   Password: password123")
            print(f"   ID: {user.id}")

    except Exception as e:
        print(f"❌ Error creating user: {e}")
        import traceback
        traceback.print_exc()
        return False

    print("\n[3/3] Verifying database...")
    try:
        with get_db_session() as session:
            user_count = session.query(User).count()
            print(f"✓ Database has {user_count} user(s)")
    except Exception as e:
        print(f"❌ Error verifying database: {e}")
        return False

    print("\n" + "=" * 60)
    print("✅ Database seeding complete!")
    print("=" * 60)
    print("\nYou can now:")
    print("1. Start the application: python app.py")
    print("2. Login with: test@example.com / password123")
    print("3. Upload voice notes and they'll be saved to PostgreSQL")
    print()

    return True


if __name__ == '__main__':
    success = seed_database()
    sys.exit(0 if success else 1)
