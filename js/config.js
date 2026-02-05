/**
 * Configuration module
 * Variables are injected by Netlify at build time or set manually for development
 */

const CONFIG = {
    // Google Apps Script Backend URL
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyyosGL8pRK-Mz8vxY5ovcEnutOj4yUELLScQopVME9kbP7DeUUr6Z2W3ezCpf3MMf7OQ/exec',

    // n8n Webhook Configuration
    N8N_WEBHOOK_URL: 'https://n8n-xwpt.onrender.com/webhook/dda36856-64ca-41d6-81b9-d335e8e807a9/chat',

    // App Configuration
    APP_NAME: 'Family6 SaaS',
    APP_URL: window.location.origin,

    // Routes
    ROUTES: {
        HOME: '/index.html',
        LOGIN: '/login.html',
        REGISTER: '/register.html',
        DASHBOARD: '/dashboard.html',
        RESET_PASSWORD: '/reset-password.html',
        UPDATE_PASSWORD: '/update-password.html',
        CONFIRM: '/confirm.html'
    },

    // Protected routes that require authentication
    PROTECTED_ROUTES: ['/dashboard.html', '/conversaciones.html', '/analiticas.html', '/configuracion.html'],

    // Auth routes that should redirect to dashboard if already logged in
    AUTH_ROUTES: ['/login.html', '/register.html']
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.ROUTES);

export default CONFIG;
