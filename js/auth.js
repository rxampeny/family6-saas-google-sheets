/**
 * Authentication Module
 * Handles all authentication operations with Google Apps Script backend
 */

import * as api from './api.js';
import CONFIG from './config.js';

// Auth state change callbacks
const authCallbacks = new Set();

/**
 * Sign up a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} username - User's username (optional)
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function signUp(email, password, username = '') {
    try {
        const { data, error } = await api.signup(email, password, username);

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Sign up error:', error);
        return { data: null, error };
    }
}

/**
 * Sign in an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function signIn(email, password) {
    try {
        const { data, error } = await api.login(email, password);

        if (error) throw error;

        // Notify auth state change
        notifyAuthStateChange('SIGNED_IN', data);

        return { data, error: null };
    } catch (error) {
        console.error('Sign in error:', error);
        return { data: null, error };
    }
}

/**
 * Sign out the current user
 * @returns {Promise<{error: Object}>}
 */
export async function signOut() {
    try {
        await api.logout();

        // Notify auth state change
        notifyAuthStateChange('SIGNED_OUT', null);

        return { error: null };
    } catch (error) {
        console.error('Sign out error:', error);
        return { error };
    }
}

/**
 * Send a password reset email
 * @param {string} email - User's email
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function resetPassword(email) {
    try {
        const { data, error } = await api.requestPasswordReset(email);

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Reset password error:', error);
        return { data: null, error };
    }
}

/**
 * Update user's password (after reset via token)
 * @param {string} newPassword - New password
 * @param {string} resetToken - Reset token from URL (optional, for reset flow)
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function updatePassword(newPassword, resetToken = null) {
    try {
        let result;

        if (resetToken) {
            // Reset password flow (from email link)
            result = await api.resetPasswordWithToken(resetToken, newPassword);
        } else {
            // Logged in password change
            result = await api.updatePassword(newPassword);
        }

        if (result.error) throw result.error;

        return { data: result.data, error: null };
    } catch (error) {
        console.error('Update password error:', error);
        return { data: null, error };
    }
}

/**
 * Get the current session
 * @returns {Promise<{data: {session: Object}, error: Object}>}
 */
export async function getSession() {
    try {
        const storedSession = api.getStoredSession();

        if (!storedSession) {
            return { data: { session: null }, error: null };
        }

        // Validate session with backend
        const { data, error } = await api.validateSession();

        if (error) {
            api.clearSession();
            return { data: { session: null }, error: null };
        }

        return {
            data: {
                session: {
                    token: storedSession.token,
                    user: data.user || storedSession.user,
                    expiresAt: storedSession.expiresAt
                }
            },
            error: null
        };
    } catch (error) {
        console.error('Get session error:', error);
        return { data: null, error };
    }
}

/**
 * Get the current user
 * @returns {Promise<{data: {user: Object}, error: Object}>}
 */
export async function getUser() {
    try {
        const { data, error } = await api.getUser();

        if (error) throw error;

        return { data: { user: data.user }, error: null };
    } catch (error) {
        console.error('Get user error:', error);
        return { data: null, error };
    }
}

/**
 * Notify all registered callbacks about auth state change
 * @param {string} event - Event type
 * @param {Object} session - Session data
 */
function notifyAuthStateChange(event, session) {
    authCallbacks.forEach(callback => {
        try {
            callback(event, session);
        } catch (e) {
            console.error('Auth callback error:', e);
        }
    });
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Callback function (event, session)
 * @returns {Object} Subscription object with unsubscribe method
 */
export function onAuthStateChange(callback) {
    authCallbacks.add(callback);

    return {
        unsubscribe: () => {
            authCallbacks.delete(callback);
        }
    };
}

/**
 * Handle auth callback from URL
 * Used on confirm.html and update-password.html
 * Now reads query params instead of hash tokens
 * @returns {Promise<{data: Object, error: Object, type: string}>}
 */
export async function handleAuthCallback() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        // Check for email confirmation result
        const success = urlParams.get('success');
        const errorParam = urlParams.get('error');

        if (success === 'true') {
            return { data: { confirmed: true }, error: null, type: 'email_confirm' };
        }

        if (errorParam) {
            const errorMessages = {
                'invalid_token': 'El enlace de confirmacion es invalido o ha expirado.',
                'already_verified': 'Esta cuenta ya fue verificada anteriormente.',
                'expired': 'El enlace ha expirado. Solicita uno nuevo.'
            };
            throw new Error(errorMessages[errorParam] || 'Error en la confirmacion.');
        }

        // Check for reset password token
        const resetToken = urlParams.get('token');
        if (resetToken) {
            // Store token for later use when submitting new password
            sessionStorage.setItem('reset_token', resetToken);
            return { data: { hasResetToken: true, token: resetToken }, error: null, type: 'password_reset' };
        }

        return { data: null, error: null, type: null };
    } catch (error) {
        console.error('Auth callback error:', error);
        return { data: null, error, type: null };
    }
}

/**
 * Get stored reset token (for password update page)
 * @returns {string|null}
 */
export function getResetToken() {
    return sessionStorage.getItem('reset_token');
}

/**
 * Clear stored reset token
 */
export function clearResetToken() {
    sessionStorage.removeItem('reset_token');
}

export default {
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    getSession,
    getUser,
    onAuthStateChange,
    handleAuthCallback,
    getResetToken,
    clearResetToken
};
