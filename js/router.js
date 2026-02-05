/**
 * Router Module
 * Handles route protection and redirects based on authentication state
 */

import { getSession } from './auth.js';
import CONFIG from './config.js';

/**
 * Check if current path is a protected route
 * @returns {boolean}
 */
function isProtectedRoute() {
    const currentPath = window.location.pathname;
    return CONFIG.PROTECTED_ROUTES.some(route =>
        currentPath.endsWith(route) || currentPath === route
    );
}

/**
 * Check if current path is an auth route (login, register)
 * @returns {boolean}
 */
function isAuthRoute() {
    const currentPath = window.location.pathname;
    return CONFIG.AUTH_ROUTES.some(route =>
        currentPath.endsWith(route) || currentPath === route
    );
}

/**
 * Redirect to a specific route
 * @param {string} route - Route to redirect to
 */
function redirect(route) {
    window.location.href = route;
}

/**
 * Initialize route protection
 * Call this on page load for protected and auth pages
 */
export async function initRouteProtection() {
    const { data } = await getSession();
    const session = data?.session;

    if (isProtectedRoute() && !session) {
        // Not authenticated, redirect to login
        redirect(CONFIG.ROUTES.LOGIN);
        return false;
    }

    if (isAuthRoute() && session) {
        // Already authenticated, redirect to dashboard
        redirect(CONFIG.ROUTES.DASHBOARD);
        return false;
    }

    return true;
}

/**
 * Protect a page - show content only if authenticated
 * @param {Function} onAuthenticated - Callback when user is authenticated
 * @param {Function} onUnauthenticated - Callback when user is not authenticated
 */
export async function protectPage(onAuthenticated, onUnauthenticated) {
    const { data } = await getSession();
    const session = data?.session;

    if (session) {
        if (onAuthenticated) onAuthenticated(session);
    } else {
        if (onUnauthenticated) {
            onUnauthenticated();
        } else {
            redirect(CONFIG.ROUTES.LOGIN);
        }
    }
}

/**
 * Require guest - redirect authenticated users away
 * @param {Function} onGuest - Callback when user is a guest
 */
export async function requireGuest(onGuest) {
    const { data } = await getSession();
    const session = data?.session;

    if (session) {
        redirect(CONFIG.ROUTES.DASHBOARD);
    } else {
        if (onGuest) onGuest();
    }
}

export default {
    initRouteProtection,
    protectPage,
    requireGuest
};
