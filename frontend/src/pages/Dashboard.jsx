import React, { useEffect } from 'react';
import useThemeStore from '../store/useThemeStore';
import useChatStore from '../store/useChatStore';
import useUIStore from '../store/useUIStore';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function Dashboard() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const loadTheme     = useThemeStore((s) => s.loadTheme);
  const loadFromCache = useChatStore((s) => s.loadFromCache);

  useEffect(() => {
    loadTheme();
    loadFromCache();
  }, [loadTheme, loadFromCache]);

  const closeSidebar  = () => setSidebarOpen(false);

  return (
    <div
      className="flex w-full h-screen overflow-hidden bg-[var(--bg)] transition-colors duration-250"
      id="app-root"
    >
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div
        className={`
          flex flex-col h-screen min-w-0 relative pt-16 
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${sidebarOpen ? 'sm:ml-[240px] sm:w-[calc(100%-240px)]' : 'ml-0 w-full'}
        `}
        id="main-content"
      >
        <Header onToggleSidebar={toggleSidebar} onCloseSidebar={closeSidebar} />
        <ChatWindow />
      </div>
    </div>
  );
}



