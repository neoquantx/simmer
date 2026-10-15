/**
 * Session utility to handle persistent client session id without accounts.
 * Key stored in localStorage: 'simmer_session_id'
 */

const SESSION_KEY = 'simmer_session_id';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves the current session ID, or generates and stores a new one if not present.
 * @returns {string} The active session UUID
 */
export function getSessionId() {
  try {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = generateUUID();
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch (error) {
    console.warn('LocalStorage unavailable, generating ephemeral session ID:', error);
    return generateUUID();
  }
}

/**
 * Clears or resets the current session ID if needed.
 * @returns {string} The newly created session UUID
 */
export function resetSessionId() {
  try {
    const newId = generateUUID();
    localStorage.setItem(SESSION_KEY, newId);
    return newId;
  } catch {
    return generateUUID();
  }
}
