// auth/auth.js
/*
  Handles:
  - showLogin / showMainApp switching
  - login form submission
  - localStorage user_id set/get
  - logout and redirect handling
*/

import { render } from '../main.js';

const loginCard = document.getElementById('loginCard');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const logoutOption = document.getElementById('logoutOption');

// --- SESSION HELPERS ---
export function setUserId(id) {
  try {
    localStorage.setItem('user_id', id);
  } catch (e) {
    console.warn('Failed to store user_id', e);
  }
}

export function getUserId() {
  try {
    return localStorage.getItem('user_id');
  } catch (e) {
    console.warn('Failed to read user_id', e);
    return null;
  }
}

export function setUserName(name) {
  try {
    localStorage.setItem('user_name', name);
  } catch (e) {
    console.warn('Failed to store user_name', e);
  }
}

export function getUserName() {
  try {
    return localStorage.getItem('user_name');
  } catch (e) {
    console.warn('Failed to read user_name', e);
    return null;
  }
}

export function logout() {
  try {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
  } catch (e) {
    console.warn('Failed to remove user data', e);
  }
  showLogin();
}

// --- SESSION VALIDATION ---
export async function validateSession() {
  const userId = getUserId();
  if (!userId) {
    return false;
  }

  try {
    // Verify the user exists by fetching their recordings
    const res = await fetch(`/recordings?user_id=${userId}`, {
      method: 'GET',
      cache: 'no-store'
    });

    if (res.ok) {
      return true;
    } else {
      // Invalid session - clear storage
      logout();
      return false;
    }
  } catch (err) {
    console.warn('Session validation failed:', err);
    return false;
  }
}

// --- LOGIN UI ---
export function showLogin() {
  if (loginCard) loginCard.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';

  // Remove logged-in class to show login background
  document.body.classList.remove('logged-in');

  // Optional redirect to /login
  if (!window.location.pathname.startsWith('/login')) {
    window.history.replaceState({}, '', '/login');
  }
}

// --- MAIN APP UI ---
export function showMainApp() {
  if (loginCard) loginCard.style.display = 'none';
  if (mainApp) mainApp.style.display = '';

  // Add logged-in class to show app background
  document.body.classList.add('logged-in');

  // Display user name in header with welcome message
  const userName = getUserName();
  const userNameDisplay = document.getElementById('userNameDisplay');
  if (userNameDisplay) {
    if (userName) {
      // Add a welcoming message before the username
      const welcomeMessages = ['Welcome back', 'Hello', 'Hi there', 'Good to see you'];
      const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      userNameDisplay.textContent = `${randomMessage}, ${userName}! 👋`;
      userNameDisplay.style.display = 'inline-block';
    } else {
      userNameDisplay.textContent = '';
      userNameDisplay.style.display = 'none';
    }
  }

  render(); // same as original showMainApp()
  if (!window.location.pathname.startsWith('/app')) {
    window.history.replaceState({}, '', '/app');
  }
}

// --- GOOGLE SIGN-IN HANDLER ---
async function handleGoogleLogin(idToken) {
  const loginError = document.getElementById('loginError');
  if (loginError) loginError.style.display = 'none';

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
      cache: 'no-store'
    });

    const json = await res.json();
    if (res.ok && json.user_id) {
      setUserId(json.user_id);
      setUserName(json.name || 'User');
      showMainApp();
    } else {
      // Show detailed error message
      let msg = json.error || 'Google login failed';

      // Add email info if available (unauthorized email case)
      if (json.email) {
        msg += `\n\nYour email: ${json.email}`;
      }

      // Add hint if available
      if (json.hint) {
        msg += `\n${json.hint}`;
      }

      // Add technical details if available
      if (json.details) {
        console.error('Google login details:', json.details);
        msg += `\n\nTechnical details: ${json.details}`;
      }

      if (loginError) {
        // Replace newlines with <br> for HTML display
        loginError.innerHTML = msg.replace(/\n/g, '<br>');
        loginError.style.display = 'block';
      } else {
        alert(msg);
      }
    }
  } catch (err) {
    console.error('Google login error:', err);
    const msg = 'Network error during Google login. Please check your connection and try again.';
    if (loginError) {
      loginError.textContent = msg;
      loginError.style.display = 'block';
    } else {
      alert(msg);
    }
  }
}

function initGoogleSignIn() {
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  if (!googleLoginBtn) return;

  // Wait for Google Sign-In library to load
  const checkGoogleLoaded = setInterval(() => {
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(checkGoogleLoaded);

      // Initialize Google Sign-In with ID token flow
      google.accounts.id.initialize({
        client_id: '429035040543-l39mdb621q90gjr9avf45oh3rchj9uit.apps.googleusercontent.com',
        callback: (response) => {
          if (response.credential) {
            handleGoogleLogin(response.credential); // ID TOKEN
          }
        },
        ux_mode: 'popup', // Force popup mode instead of FedCM
        context: 'signin'
      });

      // Replace custom button with Google's rendered button to avoid FedCM issues
      // Hide the custom button
      googleLoginBtn.style.display = 'none';

      // Create container for Google button
      const googleBtnContainer = document.createElement('div');
      googleBtnContainer.id = 'googleSignInButton';
      googleLoginBtn.parentNode.insertBefore(googleBtnContainer, googleLoginBtn);

      // Render Google's button (this avoids FedCM issues)
      google.accounts.id.renderButton(
        googleBtnContainer,
        {
          theme: 'outline',
          size: 'large',
          width: googleLoginBtn.offsetWidth || 350,
          text: 'signin_with',
          shape: 'rectangular'
        }
      );
    }
  }, 100);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkGoogleLoaded), 10000);
}

// --- LOGIN FORM HANDLER ---
export function initAuth({ loginForm, loginBtn, loginError, loginEmail, loginPassword }) {
  if (!loginForm) return;

  // Initialize Google Sign-In
  initGoogleSignIn();

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (loginBtn) loginBtn.disabled = true;
    if (loginError) loginError.style.display = 'none';

    const email = loginEmail ? loginEmail.value.trim() : '';
    const password = loginPassword ? loginPassword.value : '';

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store'
      });

      const json = await res.json();
      if (res.ok && json.user_id) {
        setUserId(json.user_id);
        setUserName(json.name || 'User');
        showMainApp();
      } else {
        const msg = json.error || 'Login failed';
        if (loginError) {
          loginError.textContent = msg;
          loginError.style.display = 'block';
        } else alert(msg);
      }
    } catch (err) {
      const msg = 'Login error';
      if (loginError) {
        loginError.textContent = msg;
        loginError.style.display = 'block';
      } else alert(msg);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  });

  if (logoutOption) logoutOption.addEventListener('click', logout);
}
