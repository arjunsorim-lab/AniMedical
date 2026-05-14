import React, { useState, useRef, useEffect } from 'react';
import { HiPaperAirplane } from 'react-icons/hi2';

export default function TextInput({ onSend, disabled = false }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="text-input-wrap flex-1 min-w-0 flex items-center gap-2">
      <textarea
        ref={textareaRef}
        id="text-input-field"
        className="text-input-field flex-1 min-w-0 resize-none bg-transparent border-none outline-none text-[var(--txt)] text-[0.9375rem] leading-6 py-2 px-3 min-h-[40px] max-h-[120px] overflow-auto font-sans disabled:opacity-50 placeholder:text-[var(--txt3)] focus-visible:outline-none"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        aria-label="Type a message"
      />
      <button
        id="text-send-btn"
        className={`
          text-send-btn flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0 transition-all duration-150
          ${text.trim()
            ? 'ci-primary-btn hover:scale-105 active:scale-95'
            : 'bg-[var(--ci-surface-high)] text-[var(--ci-text-soft)] opacity-40 cursor-not-allowed'}
        `}
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        aria-label="Send message"
        title="Send"
      >
        <HiPaperAirplane size={18} />
      </button>
    </div>
  );
}
