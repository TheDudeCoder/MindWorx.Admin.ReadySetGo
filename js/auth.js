/* ============================================================
   MindWorx Admin — Google OAuth Authentication
   Restricts access to AUTHORIZED_EMAIL only
   ============================================================ */

const Auth = (() => {
    // Replace with your Google OAuth Client ID from Google Cloud Console
    const CLIENT_ID = window.MINDWORX_CONFIG?.GOOGLE_CLIENT_ID || '';
    const AUTHORIZED_EMAIL = window.MINDWORX_CONFIG?.AUTHORIZED_EMAIL || '';
    const SESSION_KEY = 'mindworx-admin-session';

    // Dev mode: auto-login when running on localhost (no Google OAuth needed)
    const DEV_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    let currentUser = null;

    function getSession() {
        try {
            const data = localStorage.getItem(SESSION_KEY);
            if (!data) return null;
            const session = JSON.parse(data);
            // Check if session has expired (24h)
            if (Date.now() > session.expiresAt) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return session;
        } catch {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
    }

    function setSession(user) {
        const session = {
            email: user.email,
            name: user.name,
            picture: user.picture,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        currentUser = session;
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        currentUser = null;
    }

    function isAuthenticated() {
        if (currentUser) return true;
        const session = getSession();
        if (session) {
            currentUser = session;
            return true;
        }
        return false;
    }

    function getUser() {
        if (!currentUser) {
            currentUser = getSession();
        }
        return currentUser;
    }

    function isAuthorized(email) {
        if (!AUTHORIZED_EMAIL) {
            console.warn('AUTHORIZED_EMAIL not configured — allowing any Google account');
            return true;
        }
        return email.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase();
    }

    // Called by Google Identity Services callback
    function handleCredentialResponse(response) {
        const errorEl = document.getElementById('auth-error');
        const loadingEl = document.getElementById('login-loading');
        const signinEl = document.getElementById('google-signin-btn');

        try {
            // Decode JWT payload (Google ID token)
            const payload = JSON.parse(atob(response.credential.split('.')[1]));

            if (!isAuthorized(payload.email)) {
                showError('Access denied. This dashboard is restricted.');
                return;
            }

            // Store session
            setSession({
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            });

            // Show loading state
            if (signinEl) signinEl.style.display = 'none';
            if (loadingEl) loadingEl.classList.add('visible');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);

        } catch (err) {
            console.error('Auth error:', err);
            showError('Authentication failed. Please try again.');
        }
    }

    function showError(message) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
        }
    }

    function initGoogleSignIn() {
        if (!CLIENT_ID) {
            showError('Google OAuth Client ID not configured. Please set GOOGLE_CLIENT_ID in config.js.');
            return;
        }

        if (typeof google === 'undefined') {
            showError('Google Sign-In library failed to load. Check your internet connection.');
            return;
        }

        google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // Render the sign-in button
        const btnContainer = document.getElementById('google-signin-btn');
        if (btnContainer) {
            btnContainer.addEventListener('click', () => {
                google.accounts.id.prompt();
            });
        }
    }

    function logout() {
        clearSession();
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        window.location.href = 'index.html';
    }

    function requireAuth() {
        // Dev mode: auto-create mock session on localhost
        if (DEV_MODE && !isAuthenticated()) {
            console.log('%c[DEV MODE] Auto-login enabled on localhost', 'color: #3ecf8e; font-weight: bold;');
            setSession({
                email: 'dev@mindworx.ai',
                name: 'Dev User',
                picture: ''
            });
            return true;
        }

        if (!isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    return {
        initGoogleSignIn,
        handleCredentialResponse,
        isAuthenticated,
        getUser,
        logout,
        requireAuth
    };
})();

// Make handleCredentialResponse available globally for Google callback
window.handleCredentialResponse = Auth.handleCredentialResponse;
