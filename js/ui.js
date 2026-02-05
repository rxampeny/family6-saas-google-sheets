/**
 * UI Utilities Module
 * Helper functions for UI components like alerts, toasts, and loaders
 */

/**
 * Show an alert message in a container
 * @param {string} containerId - ID of the container element
 * @param {string} message - Message to display
 * @param {string} type - Alert type ('success', 'error', 'warning', 'info')
 */
export function showAlert(containerId, message, type = 'info') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear existing alerts
    container.innerHTML = '';

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    container.appendChild(alert);

    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            hideAlert(containerId);
        }, 5000);
    }
}

/**
 * Hide alert in a container
 * @param {string} containerId - ID of the container element
 */
export function hideAlert(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type ('success', 'error', 'info')
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toastContainer');

    // Create container if it doesn't exist
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Remove toast after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.2s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 200);
    }, duration);
}

/**
 * Set loading state on a button
 * @param {HTMLButtonElement} button - Button element
 * @param {boolean} loading - Whether to show loading state
 */
export function setLoading(button, loading) {
    if (!button) return;

    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');

    if (loading) {
        button.disabled = true;
        if (btnText) btnText.style.visibility = 'hidden';
        if (spinner) spinner.classList.remove('hidden');
    } else {
        button.disabled = false;
        if (btnText) btnText.style.visibility = 'visible';
        if (spinner) spinner.classList.add('hidden');
    }
}

/**
 * Show a loading overlay
 * @param {string} message - Loading message (optional)
 * @returns {HTMLElement} The overlay element
 */
export function showLoadingOverlay(message = 'Cargando...') {
    // Remove existing overlay if any
    hideLoadingOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;

    overlay.innerHTML = `
        <span class="spinner" style="width: 48px; height: 48px; border-width: 4px; color: var(--color-primary);"></span>
        <p style="margin-top: 1rem; color: var(--color-gray-600);">${message}</p>
    `;

    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Hide the loading overlay
 */
export function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether the email is valid
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and message
 */
export function validatePassword(password) {
    if (password.length < 8) {
        return {
            isValid: false,
            message: 'La contrasena debe tener al menos 8 caracteres'
        };
    }

    // Optional: Add more password requirements
    // const hasUppercase = /[A-Z]/.test(password);
    // const hasLowercase = /[a-z]/.test(password);
    // const hasNumber = /[0-9]/.test(password);

    return {
        isValid: true,
        message: ''
    };
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Format date to locale string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format date to relative time
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `hace ${days} dia${days > 1 ? 's' : ''}`;
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'ahora mismo';
}

// Add slideOut animation to stylesheet
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

export default {
    showAlert,
    hideAlert,
    showToast,
    setLoading,
    showLoadingOverlay,
    hideLoadingOverlay,
    isValidEmail,
    validatePassword,
    debounce,
    formatDate,
    formatRelativeTime
};
