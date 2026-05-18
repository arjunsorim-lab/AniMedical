import { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  HiMicrophone, HiOutlineClipboardCopy, HiOutlineThumbUp, HiOutlineThumbDown, 
  HiCheck, HiOutlineRefresh, HiOutlinePencilAlt
} from 'react-icons/hi';
import { toast } from 'react-hot-toast';

import UserAvatar from './UserAvatar';
import PredefinedResponseTemplate from './PredefinedResponseTemplate';
import DynamicResponseTemplate from './DynamicResponseTemplate';
import DualModeResponse from './DualModeResponse';
import SplitResponseView from './SplitResponseView';
import { getPredefinedTemplateKey } from './predefinedTemplateUtils';

import useUIStore from '../store/useUIStore';
import { useRef } from 'react';

/**
 * Helper component to render an iframe that auto-resizes based on its content
 */
function IframeResizer({ srcDoc, messageId }) {
  const [height, setHeight] = useState('400px'); // Initial fallback
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      // Only update if the message contains our specific ID
      if (event.data && event.data.type === 'setHeight' && event.data.id === messageId) {
        setHeight(`${Math.ceil(event.data.height) + 2}px`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [messageId]);

  // When sidebar toggles, the width changes (300ms transition).
  useEffect(() => {
    const triggerUpdate = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'triggerHeightUpdate' }, '*');
      }
    };

    triggerUpdate();
    const timer = setTimeout(triggerUpdate, 350); 
    
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  // Inject the ID into the script that runs inside the iframe
  const docWithId = useMemo(() => {
    if (!srcDoc) return srcDoc;
    
    let modified = srcDoc.replace(
      /window\.parent\.postMessage\(\{ type: 'setHeight', height: height \}, '\*'\)/g,
      `window.parent.postMessage({ type: 'setHeight', height: height, id: '${messageId}' }, '*')`
    );

    const listenerScript = `
      <script>
        window.addEventListener('message', (e) => {
          if (e.data.type === 'triggerHeightUpdate') {
            if (typeof sendHeight === 'function') sendHeight();
          }
        });
      </script>
    `;
    return modified.replace('</body>', `${listenerScript}</body>`);
  }, [srcDoc, messageId]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={docWithId}
      style={{ width: '100%', height, border: 'none', display: 'block', overflow: 'hidden' }}
      title={`Dashboard Response ${messageId}`}
      scrolling="no"
    />
  );
}


/**
 * Strict message schema expected:
 * { id, role, content, type: 'text'|'voice', createdAt, isError }
 */
export default function MessageBubble({ message, onRetry, onRegenerate, onEdit, isStreaming, triggerQuery }) {
  const { role, content, type, createdAt, isError } = message;
  const isUser = role === 'user';
  const isVoice = type === 'voice';

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleCopy = () => {
    if (!content || isStreaming) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy');
    });
  };

  const handleFeedback = (type) => {
    setFeedback(type === feedback ? null : type);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleEditSubmit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(content);
    }
  };

  const formattedTime = useMemo(() => {
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, [createdAt]);
  const hasDualSectionResponse = useMemo(() => {
    if (isUser || isError || isStreaming) return false;
    const c = String(content || '');
    return (
      /SECTION 1\s*[—-]\s*TEXT SUMMARY RESPONSE/i.test(c)
      && /SECTION 2\s*[—-]\s*VISUAL DASHBOARD RESPONSE/i.test(c)
      && (c.includes('```') || /"dashboard_title"\s*:/.test(c))
    );
  }, [content, isUser, isError, isStreaming]);
  const predefinedTemplateKey = useMemo(() => {
    if (isUser || isError || !triggerQuery || isStreaming || hasDualSectionResponse) return null;
    return getPredefinedTemplateKey(triggerQuery);
  }, [isUser, isError, triggerQuery, isStreaming, hasDualSectionResponse]);
  const hasPredefinedTemplate = Boolean(predefinedTemplateKey);
  const hasChartIntent = useMemo(() => {
    if (isUser || isError || !triggerQuery || isStreaming) return false;
    const q = String(triggerQuery || '').toLowerCase();
    return ['chart', 'graph', 'pie', 'bar', 'column', 'line', 'area', 'donut', 'doughnut'].some((k) => q.includes(k));
  }, [isUser, isError, triggerQuery, isStreaming]);
  const isDualMode = useMemo(() => {
    if (isUser || isError || isStreaming || hasPredefinedTemplate || hasChartIntent) return false;
    const q = String(triggerQuery || '').toLowerCase();
    return q.includes('compare dashboard') || q.includes('dashboard view') || q.includes('dual mode');
  }, [isUser, isError, isStreaming, hasPredefinedTemplate, hasChartIntent, triggerQuery]);

  const isWide = useMemo(() => {
    // All assistant responses should now fit the screen width for a consistent executive dashboard feel
    return !isUser;
  }, [isUser]);

  return (
    <div
      id={`message-${message.id}`}
      className={`
        group flex gap-2 sm:gap-3 py-1.5 sm:py-2 ${isWide ? 'max-w-full' : 'max-w-[1000px]'} w-full mx-auto animate-fade-in-up
        ${isUser ? 'flex-row-reverse' : ''}
        ${message.isStale ? 'message-stale' : ''}
      `}
    >
      {/* Avatar — smaller on mobile */}
      {isUser ? (
        <UserAvatar 
          className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[0.65rem] sm:text-xs font-bold mt-0.5 overflow-hidden shadow-lg"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: '#F8FBFF' }}
        />
      ) : (
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-[var(--surf)] border border-blue-400/20 mt-0.5">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <defs>
              <linearGradient id={`ai-grad-${message.id}`} x1="0" y1="0" x2="28" y2="28">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#BFDBFE" />
              </linearGradient>
            </defs>
            <circle cx="14" cy="14" r="13" stroke={`url(#ai-grad-${message.id})`} strokeWidth="2" fill="none" />
            <path d="M10 18 C10 12, 14 9, 14 9 C14 9, 18 12, 18 18" stroke={`url(#ai-grad-${message.id})`} strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="14" cy="10" r="2" fill={`url(#ai-grad-${message.id})`} />
          </svg>
        </div>
      )}

      {/* Content wrapper */}
      <div className={`flex flex-col gap-0.5 sm:gap-1 ${isWide ? 'max-w-full w-full' : 'max-w-[calc(100%-44px)] sm:max-w-[calc(100%-52px)]'} min-w-0 ${isUser ? 'items-end' : ''}`}>
        {/* Bubble */}
        <div
          className={`
            px-3 sm:px-4 py-2 sm:py-3 rounded-xl
            text-[0.8375rem] sm:text-[0.9375rem] leading-[1.6] sm:leading-[1.65] break-all
            ${isUser
              ? 'ci-user-bubble'
              : `ci-assistant-bubble ${isError ? '!bg-red-500/10 !border-red-500/40' : ''}`}
            ${isEditing ? 'w-full !p-0' : ''}
            ${hasPredefinedTemplate || hasDualSectionResponse ? '!p-0 !bg-transparent !border-transparent !shadow-none overflow-visible' : ''}
            ${isWide ? 'w-full' : ''}
          `}
        >
          {/* Voice badge */}
          {isUser && isVoice && !isEditing && (
            <div className="inline-flex items-center gap-1 text-xs opacity-75 mb-1">
              <HiMicrophone size={12} />
              <span>Voice message</span>
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col w-full min-w-[200px] sm:min-w-[320px] bg-white/10 rounded-lg overflow-hidden border border-black/10">
              <textarea
                autoFocus
                className="w-full bg-transparent text-black outline-none border-none p-4 resize-none font-sans text-sm sm:text-base selection:bg-black/20"
                rows={Math.max(2, editContent.split('\n').length)}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
              />
              <div className="flex items-center justify-end gap-3 p-3 bg-black/5 border-t border-black/10">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(content);
                  }}
                  className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black/60 hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditSubmit}
                  className="px-4 py-1.5 text-[11px] font-black uppercase tracking-widest bg-[#0B0B0F] text-[#3B82F6] rounded-lg hover:bg-black transition-all shadow-md active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          ) : isUser ? (
            <p>{content}</p>
          ) : hasDualSectionResponse ? (
            <SplitResponseView content={content} triggerQuery={triggerQuery} messageId={message.id} />
          ) : hasPredefinedTemplate ? (
            <div className="w-full flex flex-col gap-3">
              <PredefinedResponseTemplate templateKey={predefinedTemplateKey} content={content} />
            </div>
          ) : isDualMode ? (
            <div className="w-full flex flex-col gap-3">
              <DualModeResponse content={content} />
            </div>
          ) : hasChartIntent ? (
            <div className="w-full flex flex-col gap-3">
              <DynamicResponseTemplate content={content} query={triggerQuery} />
            </div>
          ) : (
            <div className={`prose-gold chatbot-reference-markdown overflow-x-auto ${isError ? 'text-red-400' : ''}`}>
              {(() => {
                const c = content || '';
                let displayContent = c;
                
                const lowerC = c.toLowerCase();
                const htmlStartIndex = lowerC.indexOf('<!doctype html>');
                const htmlEndIndex = lowerC.indexOf('</html>');
                
                if (htmlStartIndex !== -1 && htmlEndIndex !== -1) {
                  const fullEndIndex = htmlEndIndex + '</html>'.length;
                  let extractedHtml = c.substring(htmlStartIndex, fullEndIndex);
                  
                  // Inject auto-resize script into the HTML if not present
                  if (!extractedHtml.includes('window.parent.postMessage')) {
                    const script = `
                      <script>
                        function sendHeight() {
                          const wrapper = document.getElementById('app') || document.body;
                          const height = wrapper.getBoundingClientRect().height;
                          window.parent.postMessage({ type: 'setHeight', height: height }, '*');
                        }
                        window.addEventListener('load', sendHeight);
                        window.addEventListener('resize', sendHeight);
                        if (window.ResizeObserver) {
                          const observer = new ResizeObserver(sendHeight);
                          observer.observe(document.body);
                        }
                        setInterval(sendHeight, 1000);
                      </script>
                    `;
                    extractedHtml = extractedHtml.replace('</body>', `${script}</body>`);
                  }

                  
                  // Extract content before and after the HTML block
                  const beforeHtml = c.substring(0, htmlStartIndex).replace(/```[a-z]*\s*$/i, '').trim();
                  const afterHtml = c.substring(fullEndIndex).replace(/^\s*```/i, '').trim();

                  return (
                    <>
                      {beforeHtml && (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                table: (tableProps) => {
                  // eslint-disable-next-line no-unused-vars
                  const _n = tableProps.node;
                  const { children, ...rest } = tableProps;
                  return (
                    <div className="table-glass">
                      <table {...rest}>{children}</table>
                    </div>
                  );
                }
                          }}
                        >
                          {beforeHtml}
                        </ReactMarkdown>
                      )}

                      <div className="w-full bg-white rounded-xl overflow-hidden my-4 border border-blue-300/40 shadow-lg animate-fade-in-scale" style={{ maxWidth: '100%', display: 'block' }}>
                        <IframeResizer srcDoc={extractedHtml} messageId={message.id} />
                      </div>

                      {afterHtml && (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: (tableProps) => {
                              // eslint-disable-next-line no-unused-vars
                              const _n = tableProps.node;
                              const { children, ...rest } = tableProps;
                              return (
                                <div className="table-glass">
                                  <table {...rest}>{children}</table>
                                </div>
                              );
                            }
                          }}
                        >
                          {afterHtml}
                        </ReactMarkdown>
                      )}
                    </>
                  );
                }

                return (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: (tableProps) => {
                        // eslint-disable-next-line no-unused-vars
                        const _n = tableProps.node;
                        const { children, ...rest } = tableProps;
                        return (
                          <div className="table-glass">
                            <table {...rest}>{children}</table>
                          </div>
                        );
                      }
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                );
              })()}
            </div>
          )}

          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block text-blue-500 animate-pulse-beat ml-0.5" aria-hidden="true">▊</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[var(--txt3)] px-1">{formattedTime}</span>

          {/* User actions: Edit */}
          {isUser && !isEditing && onEdit && (
             <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                <button
                  className="w-6 h-6 rounded flex items-center justify-center text-[var(--txt3)] hover:bg-[var(--surf-hover)] hover:text-[var(--txt2)] transition-all duration-150"
                  onClick={() => setIsEditing(true)}
                  title="Edit message"
                >
                  <HiOutlinePencilAlt size={14} />
                </button>
             </div>
          )}

          {!isUser && !isStreaming && (
            /* Actions — always visible on touch, hover on desktop */
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
              {isError && onRetry && (
                <button
                  className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all duration-150"
                  onClick={onRetry}
                  title="Retry response"
                >
                  <HiOutlineRefresh size={14} />
                </button>
              )}
              {!isError && onRegenerate && (
                <button
                  className="w-6 h-6 rounded flex items-center justify-center text-[var(--txt3)] hover:bg-[var(--surf-hover)] hover:text-[var(--txt2)] transition-all duration-150"
                  onClick={onRegenerate}
                  title="Regenerate response"
                  disabled={isStreaming}
                >
                  <HiOutlineRefresh size={14} />
                </button>
              )}
              <button
                className="w-6 h-6 rounded flex items-center justify-center text-[var(--txt3)] hover:bg-[var(--surf-hover)] hover:text-[var(--txt2)] transition-all duration-150"
                onClick={handleCopy}
                title="Copy response"
              >
                {copied ? <HiCheck size={14} className="text-emerald-400" /> : <HiOutlineClipboardCopy size={14} />}
              </button>
              <button
                className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150
                  ${feedback === 'up' ? 'text-emerald-400' : 'text-[var(--txt3)] hover:bg-[var(--surf-hover)] hover:text-[var(--txt2)]'}`}
                onClick={() => handleFeedback('up')}
                title="Good response"
              >
                <HiOutlineThumbUp size={14} />
              </button>
              <button
                className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-150
                  ${feedback === 'down' ? 'text-red-400' : 'text-[var(--txt3)] hover:bg-[var(--surf-hover)] hover:text-[var(--txt2)]'}`}
                onClick={() => handleFeedback('down')}
                title="Bad response"
              >
                <HiOutlineThumbDown size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Typing indicator shown while waiting for first token
 */
export function TypingIndicator() {
  return (
    <div className="flex gap-3 py-2 max-w-[1000px] w-full mx-auto animate-fade-in-up" id="typing-indicator">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--surf)] border border-blue-400/20 mt-0.5">
        <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
          <defs>
            <linearGradient id="ai-grad-typing" x1="0" y1="0" x2="28" y2="28">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#BFDBFE" />
            </linearGradient>
          </defs>
          <circle cx="14" cy="14" r="13" stroke="url(#ai-grad-typing)" strokeWidth="2" fill="none" />
          <path d="M10 18 C10 12, 14 9, 14 9 C14 9, 18 12, 18 18" stroke="url(#ai-grad-typing)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="14" cy="10" r="2" fill="url(#ai-grad-typing)" />
        </svg>
      </div>
      <div className="flex flex-col gap-1 max-w-[calc(100%-52px)] min-w-0">
        <div className="px-4 py-3 rounded-xl rounded-bl-sm bg-[var(--surf)] border border-blue-300/25 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <div className="flex gap-1.5 py-1">
            <span className="w-2 h-2 rounded-full bg-[var(--txt3)] animate-typing-dot" style={{ animationDelay: '0s' }} />
            <span className="w-2 h-2 rounded-full bg-[var(--txt3)] animate-typing-dot" style={{ animationDelay: '0.15s' }} />
            <span className="w-2 h-2 rounded-full bg-[var(--txt3)] animate-typing-dot" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
