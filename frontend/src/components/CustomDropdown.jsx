import React, { useState, useRef, useEffect } from 'react';
import { HiChevronDown } from 'react-icons/hi';

export default function CustomDropdown({ options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { setIsOpen(!isOpen); e.preventDefault(); }
    else if (e.key === 'Escape') setIsOpen(false);
  };

  return (
    <div
      className="relative min-w-[150px] text-[0.8125rem] font-sans"
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-3 py-1 rounded-lg cursor-pointer select-none outline-none
          bg-white/[0.04] border transition-all duration-150
          ${isOpen
            ? 'border-gold/40 bg-white/[0.07]'
            : 'border-white/[0.08] hover:border-white/[0.15]'}
          text-[var(--txt)]
        `}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label}</span>
        <HiChevronDown
          size={16}
          className={`text-[var(--txt2)] ml-2 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          className="absolute top-[calc(100%+4px)] left-0 right-0 glass-surface border border-white/[0.12] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] m-0 py-1 list-none z-[300] max-h-[200px] overflow-y-auto animate-fade-in"
          role="listbox"
        >
          {options.map((option) => (
            <li
              key={option.value}
              className={`
                px-3 py-2 cursor-pointer text-[0.8125rem] transition-all duration-150
                ${option.value === value
                  ? 'text-gold bg-gold/[0.08] font-medium'
                  : 'text-[var(--txt)] hover:bg-white/[0.06]'}
              `}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}