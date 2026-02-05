/**
 * Google Apps Script Backend for Family6 SaaS Authentication
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet with two sheets: "users" and "sessions"
 * 2. In "users" sheet, add headers in row 1: email, username, password_hash, salt, created_at, verified, verify_token, reset_token, reset_token_expires, updated_at
 * 3. In "sessions" sheet, add headers in row 1: token, user_email, created_at, expires_at
 * 4. Copy this code to Apps Script (Extensions > Apps Script)
 * 5. Update SPREADSHEET_ID with your Google Sheet ID
 * 6. Update APP_URL with your Netlify domain
 * 7. Deploy as Web App: Deploy > New Deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy the deployment URL to your config.js APPS_SCRIPT_URL
 */

// ============== CONFIGURATION ==============
const SPREADSHEET_ID = '1BM1AkIUGDWiHfTXHIV0uVgxdqDWZYJIvWr2QRgdmmcI';
const APP_URL = 'https://tranquil-taiyaki-cf0922.netlify.app';

// Sheet names
const USERS_SHEET = 'users';
const SESSIONS_SHEET = 'sessions';
const CHAT_HISTORY_SHEET = 'chat_history';

// Token settings
const SESSION_DURATION_DAYS = 7;
const RESET_TOKEN_DURATION_HOURS = 24;

// ============== MAIN HANDLERS ==============

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    let result;

    switch (action) {
      case 'signup':
        result = handleSignup(data);
        break;
      case 'login':
        result = handleLogin(data);
        break;
      case 'validateSession':
        result = handleValidateSession(data);
        break;
      case 'logout':
        result = handleLogout(data);
        break;
      case 'requestReset':
        result = handleRequestReset(data);
        break;
      case 'resetPassword':
        result = handleResetPassword(data);
        break;
      case 'updatePassword':
        result = handleUpdatePassword(data);
        break;
      case 'updateProfile':
        result = handleUpdateProfile(data);
        break;
      case 'getUser':
        result = handleGetUser(data);
        break;
      case 'saveChatMessage':
        result = handleSaveChatMessage(data);
        break;
      case 'getChatHistory':
        result = handleGetChatHistory(data);
        break;
      case 'getChatStats':
        result = handleGetChatStats(data);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for email confirmation)
 */
function doGet(e) {
  const action = e.parameter.action;
  const token = e.parameter.token;

  if (action === 'confirmEmail' && token) {
    return handleConfirmEmail(token);
  }

  return HtmlService.createHtmlOutput('Invalid request');
}

// ============== AUTH HANDLERS ==============

/**
 * Handle user signup
 */
function handleSignup(data) {
  const { email, password, username } = data;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  // Check if user already exists
  const existingUser = findUserByEmail(email);
  if (existingUser) {
    return { error: 'This email is already registered' };
  }

  // Generate salt and hash password
  const salt = generateToken(32);
  const passwordHash = hashPassword(password, salt);

  // Generate verification token
  const verifyToken = generateToken(32);

  // Create user
  const now = new Date().toISOString();
  const userData = [
    email,           // A: email
    username || '',  // B: username
    passwordHash,    // C: password_hash
    salt,            // D: salt
    now,             // E: created_at
    false,           // F: verified
    verifyToken,     // G: verify_token
    '',              // H: reset_token
    '',              // I: reset_token_expires
    now              // J: updated_at
  ];

  const sheet = getSheet(USERS_SHEET);
  sheet.appendRow(userData);

  // Send verification email
  sendVerificationEmail(email, verifyToken);

  return {
    success: true,
    message: 'Registration successful. Please check your email to verify your account.'
  };
}

/**
 * Handle user login
 */
function handleLogin(data) {
  const { email, password } = data;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const user = findUserByEmail(email);
  if (!user) {
    return { error: 'Invalid login credentials' };
  }

  // Check if email is verified
  if (!user.verified) {
    return { error: 'Email not confirmed. Please check your inbox.' };
  }

  // Verify password
  const passwordHash = hashPassword(password, user.salt);
  if (passwordHash !== user.password_hash) {
    return { error: 'Invalid login credentials' };
  }

  // Create session
  const token = generateToken(64);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const sessionData = [
    token,                 // A: token
    email,                 // B: user_email
    now.toISOString(),     // C: created_at
    expiresAt.toISOString() // D: expires_at
  ];

  const sheet = getSheet(SESSIONS_SHEET);
  sheet.appendRow(sessionData);

  return {
    success: true,
    token: token,
    expiresAt: expiresAt.toISOString(),
    user: {
      email: user.email,
      username: user.username,
      id: user.email, // Using email as ID
      created_at: user.created_at
    }
  };
}

/**
 * Validate session token
 */
function handleValidateSession(data) {
  const { token } = data;

  if (!token) {
    return { error: 'Token is required' };
  }

  const session = findSessionByToken(token);
  if (!session) {
    return { error: 'Invalid session' };
  }

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    deleteSession(token);
    return { error: 'Session expired' };
  }

  const user = findUserByEmail(session.user_email);
  if (!user) {
    return { error: 'User not found' };
  }

  return {
    valid: true,
    user: {
      email: user.email,
      username: user.username,
      id: user.email,
      created_at: user.created_at
    }
  };
}

/**
 * Handle logout
 */
function handleLogout(data) {
  const { token } = data;

  if (token) {
    deleteSession(token);
  }

  return { success: true };
}

/**
 * Request password reset
 */
function handleRequestReset(data) {
  const { email } = data;

  if (!email) {
    return { error: 'Email is required' };
  }

  // Always return success to not reveal if email exists
  const user = findUserByEmail(email);
  if (user) {
    const resetToken = generateToken(32);
    const expires = new Date(Date.now() + RESET_TOKEN_DURATION_HOURS * 60 * 60 * 1000);

    // Update user with reset token
    updateUserField(email, 'reset_token', resetToken);
    updateUserField(email, 'reset_token_expires', expires.toISOString());

    // Send reset email
    sendResetEmail(email, resetToken);
  }

  return {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.'
  };
}

/**
 * Reset password with token
 */
function handleResetPassword(data) {
  const { token, newPassword } = data;

  if (!token || !newPassword) {
    return { error: 'Token and new password are required' };
  }

  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  const user = findUserByResetToken(token);
  if (!user) {
    return { error: 'Invalid or expired reset token' };
  }

  // Check if token is expired
  if (new Date(user.reset_token_expires) < new Date()) {
    return { error: 'Reset token has expired' };
  }

  // Update password
  const salt = generateToken(32);
  const passwordHash = hashPassword(newPassword, salt);

  updateUserField(user.email, 'password_hash', passwordHash);
  updateUserField(user.email, 'salt', salt);
  updateUserField(user.email, 'reset_token', '');
  updateUserField(user.email, 'reset_token_expires', '');
  updateUserField(user.email, 'updated_at', new Date().toISOString());

  return { success: true, message: 'Password updated successfully' };
}

/**
 * Update password while logged in
 */
function handleUpdatePassword(data) {
  const { token, newPassword } = data;

  if (!token || !newPassword) {
    return { error: 'Token and new password are required' };
  }

  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  // Validate session
  const session = findSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: 'Invalid or expired session' };
  }

  // Update password
  const salt = generateToken(32);
  const passwordHash = hashPassword(newPassword, salt);

  updateUserField(session.user_email, 'password_hash', passwordHash);
  updateUserField(session.user_email, 'salt', salt);
  updateUserField(session.user_email, 'updated_at', new Date().toISOString());

  return { success: true, message: 'Password updated successfully' };
}

/**
 * Update user profile
 */
function handleUpdateProfile(data) {
  const { token, username } = data;

  if (!token) {
    return { error: 'Token is required' };
  }

  const session = findSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: 'Invalid or expired session' };
  }

  if (username !== undefined) {
    updateUserField(session.user_email, 'username', username);
  }

  updateUserField(session.user_email, 'updated_at', new Date().toISOString());

  const user = findUserByEmail(session.user_email);

  return {
    success: true,
    user: {
      email: user.email,
      username: user.username,
      id: user.email,
      created_at: user.created_at
    }
  };
}

/**
 * Get current user
 */
function handleGetUser(data) {
  const { token } = data;

  if (!token) {
    return { error: 'Token is required' };
  }

  const session = findSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: 'Invalid or expired session' };
  }

  const user = findUserByEmail(session.user_email);
  if (!user) {
    return { error: 'User not found' };
  }

  return {
    user: {
      email: user.email,
      username: user.username,
      id: user.email,
      created_at: user.created_at
    }
  };
}

/**
 * Handle email confirmation (GET request)
 */
function handleConfirmEmail(token) {
  const user = findUserByVerifyToken(token);

  let redirectUrl;
  let message;

  if (!user) {
    redirectUrl = `${APP_URL}/confirm.html?error=invalid_token`;
    message = 'Token invalido o expirado.';
  } else if (user.verified) {
    redirectUrl = `${APP_URL}/confirm.html?error=already_verified`;
    message = 'Esta cuenta ya fue verificada.';
  } else {
    // Mark as verified
    updateUserField(user.email, 'verified', true);
    updateUserField(user.email, 'verify_token', '');
    updateUserField(user.email, 'updated_at', new Date().toISOString());

    redirectUrl = `${APP_URL}/confirm.html?success=true`;
    message = 'Cuenta verificada exitosamente!';
  }

  // Use meta refresh and provide a clickable link as fallback
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <title>Redirigiendo...</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 40px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    a { color: #6366F1; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h2>${message}</h2>
    <p>Redirigiendo...</p>
    <p>Si no eres redirigido automaticamente, <a href="${redirectUrl}">haz clic aqui</a>.</p>
  </div>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============== CHAT HISTORY HANDLERS ==============

/**
 * Save a chat message
 */
function handleSaveChatMessage(data) {
  const { token, sessionId, messageType, content } = data;

  if (!token) {
    return { error: 'Token is required' };
  }

  const session = findSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: 'Invalid or expired session' };
  }

  const sheet = getSheet(CHAT_HISTORY_SHEET);
  const now = new Date().toISOString();

  // Generate unique ID
  const id = now + '_' + Math.random().toString(36).substr(2, 9);

  const messageData = [
    id,                    // A: id
    sessionId,             // B: session_id
    session.user_email,    // C: user_email
    messageType,           // D: message_type (human/ai)
    content,               // E: content
    now                    // F: created_at
  ];

  sheet.appendRow(messageData);

  return { success: true, id: id };
}

/**
 * Get chat history for a user
 */
function handleGetChatHistory(data) {
  const { token } = data;

  if (!token) {
    return { error: 'Token is required' };
  }

  const session = findSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: 'Invalid or expired session' };
  }

  const sheet = getSheet(CHAT_HISTORY_SHEET);
  const allData = sheet.getDataRange().getValues();

  // Group messages by session_id
  const sessionsMap = {};

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (row[2] === session.user_email) { // Filter by user_email
      const sessionId = row[1];

      if (!sessionsMap[sessionId]) {
        sessionsMap[sessionId] = {
          sessionId: sessionId,
          messages: [],
          firstMessageTime: row[5]
        };
      }

      sessionsMap[sessionId].messages.push({
        id: row[0],
        type: row[3],
        content: row[4],
        created_at: row[5]
      });
    }
  }

  // Convert to array and calculate stats
  const conversations = Object.values(sessionsMap).map(conv => {
    const humanMessages = conv.messages.filter(m => m.type === 'human');
    const aiMessages = conv.messages.filter(m => m.type === 'ai');

    return {
      sessionId: conv.sessionId,
      title: humanMessages[0]?.content?.substring(0, 50) || 'Conversacion',
      preview: humanMessages[0]?.content?.substring(0, 100) || '',
      totalMessages: conv.messages.length,
      humanMessages: humanMessages.length,
      aiMessages: aiMessages.length,
      messages: conv.messages,
      createdAt: conv.firstMessageTime
    };
  });

  // Sort by most recent first
  conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Also return flat messages array for easier consumption
  const messages = [];
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (row[2] === session.user_email) {
      messages.push({
        id: row[0],
        session_id: row[1],
        user_email: row[2],
        message_type: row[3],
        content: row[4],
        created_at: row[5]
      });
    }
  }

  return { conversations: conversations, messages: messages };
}

/**
 * Get chat statistics for a user
 */
function handleGetChatStats(data) {
  const { token } = data;

  if (!token) {
    return { error: 'Token is required' };
  }

  const session = findSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: 'Invalid or expired session' };
  }

  const sheet = getSheet(CHAT_HISTORY_SHEET);
  const allData = sheet.getDataRange().getValues();

  const sessions = new Set();
  let humanCount = 0;
  let aiCount = 0;
  const messagesByDay = {};

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (row[2] === session.user_email) {
      sessions.add(row[1]);

      if (row[3] === 'human') humanCount++;
      else if (row[3] === 'ai') aiCount++;

      // Group by day
      const date = new Date(row[5]).toISOString().split('T')[0];
      messagesByDay[date] = (messagesByDay[date] || 0) + 1;
    }
  }

  // Get last 7 days
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    last7Days.push({
      label: days[d.getDay()],
      count: messagesByDay[dateStr] || 0
    });
  }

  const maxCount = Math.max(...last7Days.map(d => d.count), 1);
  last7Days.forEach(day => {
    day.percentage = Math.round((day.count / maxCount) * 100);
  });

  // Recent conversations
  const recentConversations = [];
  const sessionsArray = Array.from(sessions).slice(-5);
  sessionsArray.forEach(sessionId => {
    const messages = allData.filter(row => row[1] === sessionId && row[2] === session.user_email);
    recentConversations.push({
      sessionId: sessionId,
      messageCount: messages.length
    });
  });

  // Get first and last message dates
  let firstMessageDate = null;
  let lastMessageDate = null;

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (row[2] === session.user_email && row[5]) {
      const date = new Date(row[5]);
      if (!firstMessageDate || date < new Date(firstMessageDate)) {
        firstMessageDate = row[5];
      }
      if (!lastMessageDate || date > new Date(lastMessageDate)) {
        lastMessageDate = row[5];
      }
    }
  }

  return {
    stats: {
      totalSessions: sessions.size,
      totalMessages: humanCount + aiCount,
      humanMessages: humanCount,
      aiMessages: aiCount,
      messagesByDay: last7Days,
      recentConversations: recentConversations.reverse(),
      firstMessageDate: firstMessageDate,
      lastMessageDate: lastMessageDate
    }
  };
}

// ============== DATABASE HELPERS ==============

/**
 * Get spreadsheet
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Get sheet by name
 */
function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/**
 * Find user by email
 */
function findUserByEmail(email) {
  const sheet = getSheet(USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return {
        row: i + 1,
        email: data[i][0],
        username: data[i][1],
        password_hash: data[i][2],
        salt: data[i][3],
        created_at: data[i][4],
        verified: data[i][5],
        verify_token: data[i][6],
        reset_token: data[i][7],
        reset_token_expires: data[i][8],
        updated_at: data[i][9]
      };
    }
  }
  return null;
}

/**
 * Find user by verify token
 */
function findUserByVerifyToken(token) {
  const sheet = getSheet(USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === token) {
      return {
        row: i + 1,
        email: data[i][0],
        username: data[i][1],
        verified: data[i][5],
        verify_token: data[i][6]
      };
    }
  }
  return null;
}

/**
 * Find user by reset token
 */
function findUserByResetToken(token) {
  const sheet = getSheet(USERS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][7] === token) {
      return {
        row: i + 1,
        email: data[i][0],
        reset_token: data[i][7],
        reset_token_expires: data[i][8]
      };
    }
  }
  return null;
}

/**
 * Update user field
 */
function updateUserField(email, field, value) {
  const user = findUserByEmail(email);
  if (!user) return;

  const sheet = getSheet(USERS_SHEET);
  const colMap = {
    'email': 1,
    'username': 2,
    'password_hash': 3,
    'salt': 4,
    'created_at': 5,
    'verified': 6,
    'verify_token': 7,
    'reset_token': 8,
    'reset_token_expires': 9,
    'updated_at': 10
  };

  const col = colMap[field];
  if (col) {
    sheet.getRange(user.row, col).setValue(value);
  }
}

/**
 * Find session by token
 */
function findSessionByToken(token) {
  const sheet = getSheet(SESSIONS_SHEET);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      return {
        row: i + 1,
        token: data[i][0],
        user_email: data[i][1],
        created_at: data[i][2],
        expires_at: data[i][3]
      };
    }
  }
  return null;
}

/**
 * Delete session
 */
function deleteSession(token) {
  const session = findSessionByToken(token);
  if (session) {
    const sheet = getSheet(SESSIONS_SHEET);
    sheet.deleteRow(session.row);
  }
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Generate random token
 */
function generateToken(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Hash password with salt using SHA-256
 */
function hashPassword(password, salt) {
  const input = password + salt;
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  let hash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hex = (rawHash[i] & 0xFF).toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hash += hex;
  }
  return hash;
}

/**
 * Send verification email
 */
function sendVerificationEmail(email, token) {
  const verifyUrl = `${ScriptApp.getService().getUrl()}?action=confirmEmail&token=${token}`;

  const subject = 'Confirma tu cuenta - Family6 SaaS';
  const body = `
Hola!

Gracias por registrarte en Family6 SaaS.

Por favor confirma tu cuenta haciendo clic en el siguiente enlace:
${verifyUrl}

Si no creaste esta cuenta, puedes ignorar este correo.

Saludos,
El equipo de Family6
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body
  });
}

/**
 * Send password reset email
 */
function sendResetEmail(email, token) {
  const resetUrl = `${APP_URL}/update-password.html?token=${token}`;

  const subject = 'Restablecer contrasena - Family6 SaaS';
  const body = `
Hola!

Recibimos una solicitud para restablecer la contrasena de tu cuenta en Family6 SaaS.

Haz clic en el siguiente enlace para crear una nueva contrasena:
${resetUrl}

Este enlace expirara en 24 horas.

Si no solicitaste restablecer tu contrasena, puedes ignorar este correo.

Saludos,
El equipo de Family6
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body
  });
}
