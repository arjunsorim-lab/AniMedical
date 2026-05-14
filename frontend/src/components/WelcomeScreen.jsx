import React from 'react';
import { HiMicrophone, HiStop } from 'react-icons/hi';
import AudioWaveform, { AudioGlow } from './AudioVisualizer';
import TextInput from './TextInput';
import AppLogo from './AppLogo';

const EXAMPLES = [
  { text: 'Give me healthcare dashboard report', icon: 'KPI' },
  { text: 'Revenue by service this month', icon: 'REV' },
  { text: 'Total patients served today', icon: 'PT' },
  { text: 'Doctor performance ranking', icon: 'DOC' },
  { text: 'Active vs critical patient count', icon: 'RISK' },
  { text: 'Abnormal vitals alerts summary', icon: 'ALRT' },
  { text: 'Patients per doctor', icon: 'LOAD' },
  { text: 'Region-wise patient distribution', icon: 'REG' },
  { text: 'Pending payment cases', icon: 'PAY' },
  { text: 'Patient outcome trends', icon: 'TRND' },
];

export default function WelcomeScreen({
  onQueryClick,
  onVoiceClick,
  onTextSend,
  isRecording,
  isTranscribing,
  isBusy,
}) {
  return (
    <div
      id="welcome-screen"
      className="
        flex flex-col items-center w-full h-full
        px-3 sm:px-6
        pt-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))]
        overflow-hidden
      "
    >
      {/* ── Scrollable centre column ── */}
      <main className="
        flex flex-col items-center justify-center
        flex-1 min-h-0 w-full max-w-[1600px]
        gap-3 sm:gap-[clamp(8px,1.8vh,18px)]
      ">

        <div className="flex items-center justify-center flex-shrink-0">
          <AppLogo width="130px" className="rounded-md" />
        </div>

        {/* Title */}
        <h1 className="
          text-gold-gradient-animated font-extrabold tracking-tight text-center leading-tight m-0
          text-[1.1rem] sm:text-[1.4rem] md:text-[1.6rem]
          px-2
        ">
          AniCare Vox : Voice Enabled AI Assistant
        </h1>

        {/* Subtitle */}
        <p className="text-[var(--txt2)] text-center max-w-xs sm:max-w-sm leading-snug m-0 text-[0.7rem] sm:text-[0.75rem]">
          Ask any question using voice or text
        </p>

        {/* ── Voice section ── */}
        <div className="flex flex-col items-center gap-2 sm:gap-[clamp(4px,1vh,8px)] flex-shrink-0">

          {/* Mic wrap — fluid size based on viewport */}
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{
              width: 'clamp(100px, 16vh, 150px)',
              height: 'clamp(100px, 16vh, 150px)',
            }}
          >
            {/* Glow ring — always mounted, opacity controls visibility */}
            <AudioGlow size={150} />

            {isTranscribing ? (
              /* ── Gold orbital loader ── */
              <div
                className="transcribing-loader z-[2]"
                style={{ width: 'clamp(44px, 8vh, 64px)', height: 'clamp(44px, 8vh, 64px)' }}
                aria-label="Transcribing audio"
                aria-busy="true"
              >
                <div className="orbit-ring" />
                <div className="orbit-ring-inner" />
                <div className="orbit-dot" />
              </div>
            ) : (
              <button
                className={`
                  relative z-[2] flex items-center justify-center
                  text-white transition-all duration-200 flex-shrink-0
                  ${isRecording
                    ? 'bg-red-500 shadow-[0_4px_28px_rgba(239,68,68,0.4)] animate-pulse-beat'
                    : 'bg-gold-gradient shadow-[0_4px_24px_rgba(59,130,246,0.35)] hover:scale-[1.06] active:scale-95'}
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:!transform-none disabled:!animate-none
                `}
                style={{
                  width: 'clamp(44px, 8vh, 64px)',
                  height: 'clamp(44px, 8vh, 64px)',
                  borderRadius: '9999px',   /* explicit circle — immune to Tailwind purge */
                }}
                onClick={onVoiceClick}
                disabled={isBusy && !isRecording}
                id="welcome-voice-btn"
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording
                  ? <HiStop size={20} />
                  : <HiMicrophone size={24} />}
              </button>
            )}
          </div>

          {/* Waveform — always mounted so canvas is in DOM; opacity shows/hides it */}
          <div className="relative flex items-center justify-center" style={{ minHeight: 30 }}>
            <AudioWaveform width={180} height={30} />
            {!isRecording && (
              <span
                className={`absolute inset-0 flex items-center justify-center font-medium text-[0.7rem] sm:text-[0.75rem] ${isTranscribing ? 'text-gold' : 'text-[var(--txt3)]'}`}
                aria-live="polite"
              >
                {isTranscribing ? 'Transcribing...' : 'Tap to speak'}
              </span>
            )}
          </div>
        </div>

        {/* ── Chips ── */}
        <div className="
          flex flex-col items-center w-full
          gap-2 sm:gap-[clamp(8px,1.5vh,12px)]
          flex-[0_1_auto] min-h-0
          overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
        ">
          {/* Divider */}
          <span className="
            flex items-center justify-center gap-3 w-full
            text-[0.65rem] sm:text-[0.72rem] text-[var(--txt2)] uppercase tracking-[0.1em] font-semibold whitespace-nowrap
            before:content-[''] before:flex-1 before:h-px before:bg-[var(--brd)]
            after:content-[''] after:flex-1 after:h-px after:bg-[var(--brd)]
          ">
            Try asking
          </span>

          {/* Chip grid — 2 col on xs, wraps freely otherwise */}
          <div className="
            grid grid-cols-2 xs:grid-cols-2 sm:flex sm:flex-wrap
            gap-1.5 sm:gap-2 justify-center w-full
          ">
            {EXAMPLES.map((e, i) => (
              <button
                key={i}
                id={`wc-${i}`}
                className="
                  inline-flex items-center gap-1.5 sm:gap-2 rounded-full
                  bg-[var(--surf)] border border-[var(--brd)] text-[var(--txt2)]
                  cursor-pointer transition-all duration-150 font-sans
                  px-3 py-1.5 sm:px-[clamp(10px,2vw,14px)] sm:py-[clamp(4px,1vh,7px)]
                  text-[0.65rem] sm:text-[0.75rem]
                  hover:border-gold/40 hover:text-gold hover:bg-[var(--surf-hover)] hover:-translate-y-px
                  disabled:opacity-35 disabled:cursor-not-allowed disabled:!transform-none
                  whitespace-nowrap overflow-hidden text-ellipsis max-w-full
                "
                onClick={() => onQueryClick(e.text)}
                disabled={isBusy}
              >
                <span className="text-[0.85rem] sm:text-[0.9rem] leading-none flex-shrink-0">{e.icon}</span>
                <span className="truncate">{e.text}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* ── Bottom input ── */}
      <footer className="w-full max-w-[1200px] flex-shrink-0 pt-2 sm:pt-3">
        <div className="
          relative flex items-center gap-2 sm:gap-2.5
          px-3 sm:px-4 py-1.5
          glass-surface border border-white/[0.10] rounded-full
          shadow-[0_4px_16px_rgba(0,0,0,0.3)]
          transition-all duration-150 gradient-border-focus
        ">
          <TextInput onSend={onTextSend} disabled={isBusy} />
        </div>
        <p className="text-[11px] text-[var(--txt3)] text-center mt-1.5 hidden sm:block opacity-70">
          Press Enter to send · Shift+Enter for new line
        </p>
      </footer>
    </div>
  );
}
