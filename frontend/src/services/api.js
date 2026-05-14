/**
 * API Service Layer
 * 
 * IMPORTANT: This module owns all WebSocket connections.
 * Components should never create sockets directly — use streamMessage().
 * 
 * Endpoints:
 *   GET  /health         → health check
 *   POST /speech-to-text → audio blob → { text, confidence, language }
 *   POST /chat           → { message, conversation_id } → { response }
 *   WS   /stream         → real-time token streaming
 *   GET  /history         → conversation history
 *   POST /query          → direct data query
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api';

/**
 * Helper to get the auth token from local storage
 */
function getAuthToken() {
  const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
  return authData?.state?.token || null;
}

function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ---- Centralized WebSocket state ----
let activeSocket = null;
let isManuallyClosed = false;

/**
 * Close the active WebSocket stream.
 * Call this on: new message, component unmount, user cancel (Esc/button).
 */
export function closeStream() {
  isManuallyClosed = true;
  if (activeSocket && activeSocket.readyState <= WebSocket.OPEN) {
    activeSocket.close();
  }
  activeSocket = null;
}

/**
 * Health check — GET /health
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

/**
 * Speech-to-Text — POST /speech-to-text
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const res = await fetch(`${API_BASE}/speech-to-text`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Transcription failed');
  }

  return res.json();
}

/**
 * Chat (non-streaming fallback) — POST /chat
 */
export async function sendMessage(message, conversationId, history = []) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ message, conversation_id: conversationId, history }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Chat request failed');
  }

  return res.json();
}

/**
 * Stream response — WebSocket /stream
 * 
 * This module OWNS the socket. Only one active stream at a time.
 * Previous streams are closed before opening new ones.
 * 
 * @returns {{ close: () => void }} handle to manually close the stream
 */
export function streamMessage(message, conversationId, onToken, onComplete, onError, history = []) {
  closeStream();
  isManuallyClosed = false;

  let buffer = '';
  let timer = null;
  let hasReceivedTokens = false;

  const flush = () => {
    if (buffer) {
      onToken(buffer);
      buffer = '';
    }
  };

  const startBatching = () => {
    if (!timer) timer = setInterval(flush, 80);
  };

  const cleanup = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    flush();
  };

  let retries = 0;
  const maxRetries = 2;

  const connect = () => {
    try {
      const token = getAuthToken();
      const wsUrl = token ? `${WS_BASE}/stream?token=${token}` : `${WS_BASE}/stream`;

      const ws = new WebSocket(wsUrl);
      activeSocket = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        ws.send(JSON.stringify({
          message,
          conversation_id: conversationId,
          history,
        }));
        retries = 0; // reset on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            cleanup();
            onError(new Error(data.error));
            closeStream();
            return;
          }

          if (data.done) {
            cleanup();
            onComplete();
            closeStream();
          } else if (data.token) {
            hasReceivedTokens = true;
            buffer += data.token;
            startBatching();
          } else if (!data.token && !data.done) {
            // Ignore empty payloads to prevent UI flicker
            return;
          }
        } catch {
          // Plain text token fallback
          hasReceivedTokens = true;
          buffer += event.data;
          startBatching();
        }
      };

      ws.onerror = () => {
        activeSocket = null;
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        if (!event.wasClean && !isManuallyClosed) {
          if (retries < maxRetries) {
            retries++;
            // Exponential backoff reconnect
            setTimeout(connect, 1000 * retries);
          } else {
            cleanup();
            if (hasReceivedTokens) {
              onComplete(); // Salvage partial response
            } else {
              onError(new Error('Connection lost. Failed to generate response.'));
            }
          }
        }
        activeSocket = null;
      };
    } catch (err) {
      cleanup();
      onError(err);
    }
  };

  connect();

  return {
    close: () => {
      cleanup();
      closeStream();
    }
  };
}

/**
 * Direct data query — POST /query
 */
export async function executeQuery(query, conversationId) {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ message: query, query, conversation_id: conversationId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Query execution failed');
  }

  return res.json();
}

/**
 * Fetch conversation history — GET /history
 */
export async function getHistory() {
  const res = await fetch(`${API_BASE}/history`, {
    headers: { ...getAuthHeaders() }
  });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

/**
 * Sync conversation history to backend — POST /sync
 */
export async function syncHistory(conversations) {
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ conversations }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Sync failed');
  }

  return res.json();
}

/**
 * Authentication - POST /auth/login
 */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Login failed');
  }

  return res.json();
}

/**
 * Signup - POST /auth/signup
 */
export async function signup(userData) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Signup failed');
  }

  return res.json();
}

/**
 * Get current user - GET /auth/me
 */
export async function getMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch user data');
  return res.json();
}

/**
 * Request Password Reset - POST /auth/request-reset
 */
export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/auth/request-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to request password reset');
  }

  return res.json();
}

/**
 * Reset Password - POST /auth/reset-password
 */
export async function resetPassword(username, oldPassword, newPassword) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      old_password: oldPassword,
      new_password: newPassword
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Password reset failed');
  }

  return res.json();
}

/**
 * Upload Profile Picture - POST /auth/profile-pic
 */
export async function uploadProfilePic(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/auth/profile-pic`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Upload failed');
  }

  return res.json();
}
