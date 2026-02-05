/**
 * Chat Module
 * Handles chat functionality with n8n webhook integration
 */

import CONFIG from './config.js';

// Chat state
let sessionId = null;
let currentUser = null;
let isProcessing = false;

/**
 * Generate a unique session ID
 * @returns {string} UUID
 */
function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get or create session ID (includes userId prefix for filtering)
 * Format: {userId}_{uuid}
 * @returns {string} Session ID
 */
function getSessionId() {
    if (!sessionId) {
        // Try to restore from sessionStorage
        sessionId = sessionStorage.getItem('chat_session_id');

        // Check if existing session belongs to current user
        if (sessionId && currentUser?.id) {
            const sessionUserId = sessionId.split('_')[0];
            if (sessionUserId !== currentUser.id) {
                // Different user, create new session
                sessionId = null;
            }
        }

        if (!sessionId) {
            const userId = currentUser?.id || 'anonymous';
            sessionId = `${userId}_${generateSessionId()}`;
            sessionStorage.setItem('chat_session_id', sessionId);
        }
    }
    return sessionId;
}

/**
 * Send message to n8n webhook
 * @param {string} message - User message
 * @returns {Promise<{data: Object, error: Object}>}
 */
export async function sendMessage(message) {
    if (!message.trim()) {
        return { data: null, error: { message: 'Message cannot be empty' } };
    }

    const payload = {
        action: 'sendMessage',
        sessionId: getSessionId(),
        chatInput: message.trim(),
        metadata: {
            userId: currentUser?.id || 'anonymous',
            userEmail: currentUser?.email || 'anonymous',
            timestamp: new Date().toISOString()
        }
    };

    try {
        const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // n8n returns streaming NDJSON (newline-delimited JSON)
        const text = await response.text();
        const lines = text.trim().split('\n');

        // Extract content from all "item" type responses
        let fullContent = '';
        for (const line of lines) {
            try {
                const json = JSON.parse(line);
                if (json.type === 'item' && json.content) {
                    fullContent += json.content;
                } else if (json.type === 'error') {
                    throw new Error(json.content || 'Error from n8n');
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }

        // If no streaming content, try to parse as regular JSON
        if (!fullContent && lines.length === 1) {
            try {
                const data = JSON.parse(lines[0]);
                return { data, error: null };
            } catch (e) {
                fullContent = text;
            }
        }

        return { data: { output: fullContent || text }, error: null };
    } catch (error) {
        console.error('Chat error:', error);
        return { data: null, error };
    }
}

/**
 * Add message to chat UI
 * @param {string} content - Message content
 * @param {string} type - Message type ('user', 'assistant', 'error')
 */
function addMessageToUI(content, type) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // Remove welcome message if exists
    const welcome = messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
        welcome.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    messageEl.textContent = content;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const typingEl = document.createElement('div');
    typingEl.className = 'chat-typing';
    typingEl.id = 'typingIndicator';
    typingEl.innerHTML = '<span></span><span></span><span></span>';

    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    const typingEl = document.getElementById('typingIndicator');
    if (typingEl) {
        typingEl.remove();
    }
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');

    if (!input || isProcessing) return;

    const message = input.value.trim();
    if (!message) return;

    // Disable input while processing
    isProcessing = true;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    // Add user message to UI
    addMessageToUI(message, 'user');

    // Show typing indicator
    showTypingIndicator();

    // Send to n8n
    const { data, error } = await sendMessage(message);

    // Hide typing indicator
    hideTypingIndicator();

    if (error) {
        addMessageToUI('Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo.', 'error');
    } else {
        // Handle different response formats from n8n
        let responseText = '';

        if (typeof data === 'string') {
            responseText = data;
        } else if (data?.output) {
            responseText = data.output;
        } else if (data?.response) {
            responseText = data.response;
        } else if (data?.message) {
            responseText = data.message;
        } else if (data?.text) {
            responseText = data.text;
        } else if (Array.isArray(data) && data.length > 0) {
            responseText = data[0]?.output || data[0]?.response || data[0]?.message || JSON.stringify(data[0]);
        } else {
            responseText = JSON.stringify(data);
        }

        addMessageToUI(responseText, 'assistant');
    }

    // Re-enable input
    isProcessing = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
}

/**
 * Initialize chat functionality
 * @param {Object} user - Current user object
 */
export function initChat(user) {
    currentUser = user;

    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');

    if (!input || !sendBtn) return;

    // Enable/disable send button based on input
    input.addEventListener('input', () => {
        sendBtn.disabled = !input.value.trim() || isProcessing;
    });

    // Handle enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.value.trim() && !isProcessing) {
                handleSendMessage();
            }
        }
    });

    // Handle send button click
    sendBtn.addEventListener('click', handleSendMessage);
}

/**
 * Clear chat history
 */
export function clearChat() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="chat-welcome">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <h4>Hola! Como puedo ayudarte?</h4>
                <p>Escribe tu mensaje para comenzar una conversacion.</p>
            </div>
        `;
    }

    // Generate new session with userId prefix
    const userId = currentUser?.id || 'anonymous';
    sessionId = `${userId}_${generateSessionId()}`;
    sessionStorage.setItem('chat_session_id', sessionId);
}

export default {
    sendMessage,
    initChat,
    clearChat
};
