import React from 'react';
import { HiOutlineChatAlt2, HiOutlineSearch } from 'react-icons/hi';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import UserAvatar from './UserAvatar';
import AppLogo from './AppLogo';

/*
 * IconRail — the always-visible narrow icon strip on the left edge.
 * Modelled after the collapsed sidebar style (icon-only navigation).
 * Width: 52px, always dark, sits at z-[80] below the full sidebar (z-[100]).
 * Clicking the chat/list icon or the logo opens the full sidebar drawer.
 */
export default function IconRail({ onToggleSidebar }) {
  const user    = useAuthStore((s) => s.user);

  /* Shared styles for icon buttons */
  const iconBtn = {
    width:           '36px',
    height:          '36px',
    borderRadius:    '10px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    cursor:          'pointer',
    background:      'transparent',
    border:          'none',
    color:           'var(--sb-txt3)',
    transition:      'background 0.15s, color 0.15s',
    flexShrink:      0,
  };

  const hoverIn  = (e) => {
    e.currentTarget.style.background = 'var(--sb-hover)';
    e.currentTarget.style.color      = '#3B82F6';
  };
  const hoverOut = (e) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color      = 'var(--sb-txt3)';
  };

  return (
    <div
      id="icon-rail"
      className="fixed left-0 top-0 bottom-0 z-[80] flex flex-col items-center py-3 gap-1 transition-colors duration-250"
      style={{
        width:       '52px',
        background:  'var(--sb-bg)',
        borderRight: '1px solid var(--sb-brd)',
      }}
    >
      {/* ── Top: VOXA logo (opens sidebar) ── */}
      <button
        style={iconBtn}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onClick={onToggleSidebar}
        aria-label="Open conversations"
        title="Open conversations"
      >
        <AppLogo size={40} className="rounded-sm" />
      </button>

      {/* Thin divider below logo */}
      <div style={{ width: '24px', height: '1px', background: 'var(--sb-brd)', margin: '4px 0' }} />



      {/* ── Open conversation list ── */}
      <button
        style={iconBtn}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onClick={onToggleSidebar}
        aria-label="Conversations"
        title="Conversations"
      >
        <HiOutlineChatAlt2 size={19} />
      </button>

      {/* ── Search (placeholder — extend later) ── */}
      <button
        style={iconBtn}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onClick={onToggleSidebar}
        aria-label="Search"
        title="Search conversations"
      >
        <HiOutlineSearch size={18} />
      </button>

      {/* ── Spacer pushes avatar to the bottom ── */}
      <div style={{ flex: 1 }} />

      {/* ── User avatar ── */}
      <div
        title={user?.name || 'User'}
        className="mb-1"
      >
        <UserAvatar 
          className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-[0.75rem] overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#0B0B0F' }}
        />
      </div>
    </div>
  );
}
