import React, { useEffect } from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
      if (e.key === 'Enter' && isOpen) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] flex flex-col gap-4 glass-surface border border-white/[0.12] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-[var(--txt)] m-0">{title}</h3>
        <p className="text-[0.8125rem] text-[var(--txt2)] m-0 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 mt-2">
          <button
            className="px-4 py-2 rounded-xl text-[0.8125rem] font-medium text-[var(--txt)] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-150 cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            autoFocus
            className="px-4 py-2 rounded-xl text-[0.8125rem] font-medium text-white bg-red-500 shadow-[0_2px_8px_rgba(239,68,68,0.3)] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] hover:brightness-110 transition-all duration-150 cursor-pointer"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}