/**
 * Session id for the current page. The lasting copy lives in an HTTP cookie
 * set by the API, and the free-meal count lives in Mongo.
 */
const LEGACY_KEYS = [
  'simmer_session_id',
  'simmer_free_uses',
  'simmer_entered',
  'simmer_local_saved_recipes',
];

try {
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
} catch {
  // Private mode can block storage. The app no longer reads it.
}

let currentSessionId = '';

export function getSessionId() {
  return currentSessionId;
}

export function setSessionId(sessionId) {
  currentSessionId = sessionId || '';
}
