import { create } from 'zustand';
import { saveConversation, getAllConversations, deleteConversation as deleteCachedConversation } from '../services/cache';
import { closeStream, syncHistory, getHistory } from '../services/api';

/**
 * Strict message schema — enforced throughout the app:
 * {
 *   id: string,
 *   role: 'user' | 'assistant',
 *   content: string,
 *   type: 'text' | 'voice',
 *   createdAt: number,
 * }
 */

const generateId = () => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const generateMsgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Enforces the strict message schema.
 * Throws if required fields are missing or invalid.
 */
function createMessage({ role, content, type, isError }) {
  if (!['user', 'assistant'].includes(role)) {
    throw new Error(`Invalid message role: "${role}"`);
  }
  if (typeof content !== 'string') {
    throw new Error('Message content must be a string');
  }
  if (!['text', 'voice'].includes(type)) {
    throw new Error(`Invalid message type: "${type}". Must be "text" or "voice".`);
  }

  return {
    id: generateMsgId(),
    role,
    content,
    type,
    isError: !!isError,
    isStale: false,      
    parentId: null,    
    createdAt: Date.now(),
  };
}

const useChatStore = create((set, get) => ({
  // ---- State ----
  // conversations: { [id]: { id, title, messages[], createdAt, updatedAt } }
  conversations: {},
  activeConversationId: null,
  isLoading: false,

  // Streaming state
  isStreaming: false,
  streamingText: '',
  activeStreamId: null,
  isSyncing: false,

  // ---- Helpers ----
  syncWithBackend: async () => {
    // Basic debounce to avoid spamming the backend during rapid state changes
    if (get()._syncTimeout) clearTimeout(get()._syncTimeout);
    
    const timeout = setTimeout(async () => {
      try {
        const { conversations } = get();
        await syncHistory(conversations);
      } catch (err) {
        console.warn('Failed to sync with backend:', err);
      }
    }, 1000); // 1s debounce

    set({ _syncTimeout: timeout });
  },

  // ---- Conversation Actions ----

  createConversation: () => {
    const id = generateId();
    const conversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      conversations: { ...state.conversations, [id]: conversation },
      activeConversationId: id,
      streamingText: '',
      isStreaming: false,
      isLoading: false,
    }));
    // Persist active ID so refresh restores this new chat
    localStorage.setItem('voice-ai-active-id', id);
    return id;
  },

  setActiveConversation: (id) => {
    // Cancel any active stream when switching conversations
    get().cancelStream();
    set({ activeConversationId: id, streamingText: '', isStreaming: false });
    localStorage.setItem('voice-ai-active-id', id || '');
  },

  addMessage: (conversationId, { role, content, type, isError }) => {
    const msg = createMessage({ role, content, type, isError });

    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;

      const updatedMessages = [...conv.messages, msg];

      // Auto-generate title from first user message
      let title = conv.title;
      if (title === 'New Chat' && role === 'user' && content) {
        title = content.length > 40 ? content.slice(0, 40) + '...' : content;
      }

      const updatedConv = {
        ...conv,
        messages: updatedMessages,
        title,
        updatedAt: Date.now(), // Always update on new message
      };

      const newConversations = { ...state.conversations, [conversationId]: updatedConv };
      
      // Enforce LRU cache size (max 30)
      const maxCacheSize = 30;
      const keys = Object.keys(newConversations);
      if (keys.length > maxCacheSize) {
        // Sort by updatedAt asc (oldest first)
        const sortedKeys = keys.sort((a, b) => newConversations[a].updatedAt - newConversations[b].updatedAt);
        const keysToDelete = sortedKeys.slice(0, keys.length - maxCacheSize);
        keysToDelete.forEach(k => {
          // Don't delete the active conversation
          if (k !== state.activeConversationId) {
            delete newConversations[k];
            deleteCachedConversation(k);
          }
        });
      }

      saveConversation(conversationId, updatedConv);
      
      return { conversations: newConversations };
    });

    // Sync with backend asynchronously AFTER state is updated
    get().syncWithBackend();

    return msg.id;
  },

  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;

      const updatedMessages = conv.messages.filter((m) => m.id !== messageId);
      const updatedConv = {
        ...conv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };

      const newConversations = { ...state.conversations, [conversationId]: updatedConv };
      saveConversation(conversationId, updatedConv);
      return { conversations: newConversations };
    });
    
    get().syncWithBackend();
  },

  // ---- Streaming Actions ----
  // streamingText is NEVER stored in messages until finalizeStream() is called.

  startStreaming: (streamId) => {
    set({ isStreaming: true, streamingText: '', isLoading: false, activeStreamId: streamId });
  },

  appendToken: (token, streamId) => {
    const state = get();
    // Ignore stale streams due to race conditions
    if (streamId && state.activeStreamId !== streamId) return;

    set({ streamingText: state.streamingText + token });
  },

  /**
   * Finalize stream — commit to messages, reset.
   */
  finalizeStream: (streamId) => {
    const { streamingText, activeConversationId, activeStreamId } = get();

    // Ignore if from a stale stream
    if (streamId && activeStreamId !== streamId) return;

    if (streamingText && activeConversationId) {
      get().addMessage(activeConversationId, {
        role: 'assistant',
        content: streamingText,
        type: 'text',
      });
      // addMessage already calls syncWithBackend
    }

    set({
      streamingText: '',
      isStreaming: false,
      isLoading: false,
      activeStreamId: null,
    });
  },

  /**
   * Cancel an active stream — clears partial text without committing.
   */
  cancelStream: () => {
    closeStream(); // Ensure the underlying socket is also severed
    set({
      streamingText: '',
      isStreaming: false,
      isLoading: false,
      activeStreamId: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  // ---- Conversation Management ----

  renameConversation: async (id, newTitle) => {
    const updatedConv = { ...get().conversations[id], title: newTitle, updatedAt: Date.now() };
    
    set((state) => {
      const newConversations = { ...state.conversations, [id]: updatedConv };
      saveConversation(id, updatedConv);
      return { conversations: newConversations };
    });
    
    // Immediate sync for renames
    try {
      await syncHistory(get().conversations);
    } catch (err) {
      console.warn('Failed to sync rename:', err);
    }
  },

  deleteConversation: (id) => {
    set((state) => {
      const newConversations = { ...state.conversations };
      delete newConversations[id];
      deleteCachedConversation(id);

      const newActiveId = state.activeConversationId === id
        ? Object.keys(newConversations).sort((a, b) => {
            return (newConversations[b]?.updatedAt || 0) - (newConversations[a]?.updatedAt || 0);
          })[0] || null
        : state.activeConversationId;

      // Sync with backend
      setTimeout(() => get().syncWithBackend(), 0);

      return { conversations: newConversations, activeConversationId: newActiveId };
    });
  },

  clearAll: async () => {
    // 1. Clear local state immediately
    set({
      conversations: {},
      activeConversationId: null,
      streamingText: '',
      isStreaming: false,
      isLoading: false,
      activeStreamId: null,
    });
    
    // 2. Clear browser cache
    const cache = await import('../services/cache');
    cache.clearAllConversations();
    
    // 3. FORCE immediate sync with backend (no debounce)
    try {
      await syncHistory({});
    } catch (err) {
      console.warn('Failed to clear backend history:', err);
    }
  },

  loadFromCache: async () => {
    const cached = getAllConversations();
    const savedActiveId = localStorage.getItem('voice-ai-active-id');

    set({ conversations: cached });

    // Try to fetch from backend if authenticated
    try {
      const backendResponse = await getHistory();
      const backendHistory = backendResponse?.conversations || backendResponse || {};
      if (backendHistory && typeof backendHistory === 'object') {
        const merged = { ...cached };
        
        Object.entries(backendHistory).forEach(([id, bConv]) => {
          const lConv = cached[id];
          if (!lConv || (bConv.updatedAt || 0) > (lConv.updatedAt || 0)) {
            merged[id] = bConv;
            // Update local cache to match newer backend version
            saveConversation(id, bConv);
          } else if (lConv && (lConv.updatedAt || 0) > (bConv.updatedAt || 0)) {
            // Local is newer, keep local and we will sync it later
            console.log(`Keeping newer local version for ${id}`);
          }
        });
        
        set({ conversations: merged });
      }
    } catch (err) {
      console.warn('Failed to load history from backend:', err);
    }

    const currentConversations = get().conversations;

    if (savedActiveId === '__new__') {
      set({ activeConversationId: null });
    } else if (savedActiveId && currentConversations[savedActiveId]) {
      set({ activeConversationId: savedActiveId });
    } else if (Object.keys(currentConversations).length > 0) {
      const mostRecentId = Object.values(currentConversations).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id;
      set({ activeConversationId: mostRecentId });
    } else {
      set({ activeConversationId: null });
    }
  },

  /**
   * Start a new empty chat — sets active to null (shows welcome screen)
   * and persists the state for refresh.
   */
  newChat: () => {
    get().cancelStream();
    set({ activeConversationId: null, streamingText: '', isStreaming: false, isLoading: false });
    localStorage.setItem('voice-ai-active-id', '__new__');
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return activeConversationId ? conversations[activeConversationId] : null;
  },

  // Mark message as stale (for regenerate)
  markMessageStale: (conversationId, messageId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;

      const updatedMessages = conv.messages.map((m) =>
        m.id === messageId ? { ...m, isStale: true } : m
      );

      const updatedConv = {
        ...conv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };

      saveConversation(conversationId, updatedConv);

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: updatedConv,
        },
      };
    });
  },

  // Find previous user message
  getPreviousUserMessage: (conversationId, messageId) => {
    const conv = get().conversations[conversationId];
    if (!conv) return null;

    const idx = conv.messages.findIndex((m) => m.id === messageId);
    if (idx <= 0) return null;

    for (let i = idx - 1; i >= 0; i--) {
      if (conv.messages[i].role === 'user') {
        return conv.messages[i];
      }
    }

    return null;
  },

  updateMessage: (conversationId, messageId, newContent) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;

      const updatedMessages = conv.messages.map((m) =>
        m.id === messageId ? { ...m, content: newContent, updatedAt: Date.now() } : m
      );

      const updatedConv = {
        ...conv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };

      saveConversation(conversationId, updatedConv);
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: updatedConv,
        },
      };
    });

    get().syncWithBackend();
  },

  truncateHistory: (conversationId, messageId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;

      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return state;

      // Keep messages up to and including idx
      const updatedMessages = conv.messages.slice(0, idx + 1);

      const updatedConv = {
        ...conv,
        messages: updatedMessages,
        updatedAt: Date.now(),
      };

      saveConversation(conversationId, updatedConv);
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: updatedConv,
        },
      };
    });

    get().syncWithBackend();
  },
}));

export default useChatStore;
