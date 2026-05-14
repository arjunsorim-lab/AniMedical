const CACHE_PREFIX = 'voice-ai-chat:';
const MAX_CACHED = 50;

/**
 * Save a conversation to localStorage
 */
export function saveConversation(id, data) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(data));
    pruneCache();
  } catch (e) {
    console.warn('Cache save failed:', e);
  }
}

/**
 * Get a single conversation from cache
 */
export function getConversation(id) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Get all cached conversations as { id: conversation } map
 */
export function getAllConversations() {
  const conversations = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const id = key.replace(CACHE_PREFIX, '');
        const raw = localStorage.getItem(key);
        if (raw) {
          conversations[id] = JSON.parse(raw);
        }
      }
    }
  } catch (e) {
    console.warn('Cache read failed:', e);
  }
  return conversations;
}

/**
 * Delete a conversation from cache
 */
export function deleteConversation(id) {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${id}`);
  } catch (e) {
    console.warn('Cache delete failed:', e);
  }
}

/**
 * Clear all cached conversations
 */
export function clearAllConversations() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn('Cache clear failed:', e);
  }
}

/**
 * Prune cache to keep only the most recent MAX_CACHED conversations
 */
function pruneCache() {
  try {
    const all = getAllConversations();
    const sorted = Object.entries(all).sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
    if (sorted.length > MAX_CACHED) {
      sorted.slice(MAX_CACHED).forEach(([id]) => {
        localStorage.removeItem(`${CACHE_PREFIX}${id}`);
      });
    }
  } catch (e) {
    console.warn('Cache prune failed:', e);
  }
}
