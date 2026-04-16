"""
Login credentials configuration for Voice Notes MVP.
Google Sign-In authentication with email allowlist.
"""

# Allowed emails for Google Sign-In
ALLOWED_EMAILS = [
    "test@example.com",
    "ghanashyamgawas09@gmail.com"
]

def is_allowed_email(email: str) -> bool:
    """
    Check if an email is in the allowlist.

    Args:
        email: Email address to check

    Returns:
        bool: True if email is allowed, False otherwise
    """
    return email and email.lower() in {e.lower() for e in ALLOWED_EMAILS}

def verify_google_token(id_token_str: str, audience: str = None):
    """
    Verify Google ID token and ensure the email is in ALLOWED_EMAILS.

    Args:
        id_token_str: The Google ID token string
        audience: Optional Google Client ID for verification

    Returns:
        dict: {email, name} on success
        dict: {error, email} on failure with specific error message

    Requires:
        pip install google-auth
    """
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
    except ImportError as e:
        # google-auth not installed
        print(f"[verify_google_token] ImportError: {e}")
        return {"error": "google-auth library not installed", "details": str(e)}

    try:
        request = requests.Request()
        # Verify token with or without audience
        if audience:
            print(f"[verify_google_token] Verifying token with audience: {audience}")
            idinfo = id_token.verify_oauth2_token(id_token_str, request, audience)
        else:
            print(f"[verify_google_token] Verifying token without audience")
            idinfo = id_token.verify_oauth2_token(id_token_str, request)

        email = idinfo.get("email")
        print(f"[verify_google_token] Extracted email from token: {email}")
        print(f"[verify_google_token] Checking if email is allowed...")

        if is_allowed_email(email):
            print(f"[verify_google_token] Email {email} is allowed - login successful")
            return {
                "email": email,
                "name": idinfo.get("name") or email.split("@")[0]
            }
        else:
            print(f"[verify_google_token] Email {email} is NOT in the allowed list")
            print(f"[verify_google_token] Allowed emails: {ALLOWED_EMAILS}")
            return {
                "error": "unauthorized_email",
                "email": email,
                "message": f"Email '{email}' is not authorized. Please contact the administrator to add your email to the allowlist."
            }
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        print(f"[verify_google_token] Token verification failed: {error_type}: {error_msg}")
        import traceback
        traceback.print_exc()
        return {
            "error": "token_verification_failed",
            "details": f"{error_type}: {error_msg}"
        }

    return {"error": "unknown_error"}

def verify_login(email: str, password: str = None):
    """
    Backwards-compatible function for legacy authentication.
    Now works with allowlist-only mode (no password required).

    Args:
        email: User email
        password: User password (optional, not used in allowlist mode)

    Returns:
        dict: User info with name if email is allowed, None otherwise
    """
    # Simple allowlist-only mode
    if is_allowed_email(email):
        return {
            "email": email,
            "name": email.split('@')[0]
        }
    return None


# resolve merge conflict