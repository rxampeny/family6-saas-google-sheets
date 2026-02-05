/**
 * API Module
 * Handles all communication with Google Apps Script backend
 */

import CONFIG from './config.js';

const STORAGE_KEY = 'family6_session';

/**
 * Make a request to the Apps Script backend
 * @param {string} action - The action to perform
 * @param {Object} data - Data to send with the request
 * @returns {Promise<{data: Object, error: Object}>}
 */
async function apiRequest(action, data = {}) {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain', // Apps Script requires text/plain for CORS
            },
            body: JSON.stringify({ action, ...data })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
            return { data: null, error: { message: result.error } };
        }

        return { data: result, error: null };
    } catch (error) {
        console.error('API request error:', error);
        return { data: null, error };
    }
}

/**
 * Save session to localStorage
 * @param {Object} session - Session data (token, user info)
 */
export function saveSession(session) {
    if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
}

/**
 * Get stored session from localStorage
 * @returns {Object|null} Session data or null
 */
export function getStoredSession() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

/**
 * Clear session from localStorage
 */
export function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get session token
 * @returns {string|null} Token or null
 */
export function getSessionToken() {
    const session = getStoredSession();
    return session?.token || null;
}

/**
 * Sign up a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} username - User's username (optional)
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function signup(email, password, username = '') {
    return apiRequest('signup', { email, password, username });
}

/**
 * Sign in an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function login(email, password) {
    const result = await apiRequest('login', { email, password });

    if (result.data && result.data.token) {
        saveSession({
            token: result.data.token,
            user: result.data.user,
            expiresAt: result.data.expiresAt
        });
    }

    return result;
}

/**
 * Validate current session
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function validateSession() {
    const token = getSessionToken();

    if (!token) {
        return { data: null, error: { message: 'No session token' } };
    }

    const result = await apiRequest('validateSession', { token });

    if (result.error) {
        clearSession();
    }

    return result;
}

/**
 * Logout current user
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function logout() {
    const token = getSessionToken();

    if (token) {
        await apiRequest('logout', { token });
    }

    clearSession();
    return { data: { success: true }, error: null };
}

/**
 * Request password reset email
 * @param {string} email - User's email
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function requestPasswordReset(email) {
    return apiRequest('requestReset', { email });
}

/**
 * Reset password using reset token
 * @param {string} token - Reset token from email
 * @param {string} newPassword - New password
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function resetPasswordWithToken(token, newPassword) {
    return apiRequest('resetPassword', { token, newPassword });
}

/**
 * Update password while logged in
 * @param {string} newPassword - New password
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function updatePassword(newPassword) {
    const token = getSessionToken();

    if (!token) {
        return { data: null, error: { message: 'No session token' } };
    }

    return apiRequest('updatePassword', { token, newPassword });
}

/**
 * Update user profile
 * @param {Object} fields - Fields to update (username, etc.)
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function updateProfile(fields) {
    const token = getSessionToken();

    if (!token) {
        return { data: null, error: { message: 'No session token' } };
    }

    return apiRequest('updateProfile', { token, ...fields });
}

/**
 * Get current user data
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function getUser() {
    const token = getSessionToken();

    if (!token) {
        return { data: null, error: { message: 'No session token' } };
    }

    const result = await apiRequest('getUser', { token });

    // Update stored session with latest user data
    if (result.data && result.data.user) {
        const session = getStoredSession();
        if (session) {
            session.user = result.data.user;
            saveSession(session);
        }
    }

    return result;
}

export default {
    apiRequest,
    saveSession,
    getStoredSession,
    clearSession,
    getSessionToken,
    signup,
    login,
    validateSession,
    logout,
    requestPasswordReset,
    resetPasswordWithToken,
    updatePassword,
    updateProfile,
    getUser
};
