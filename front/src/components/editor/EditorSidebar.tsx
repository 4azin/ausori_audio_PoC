import React from 'react';

// Basic svg icons to represent the sidebar tools
const BrowserIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/></svg>;
const PluginIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const HistoryIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>;
const FeedbackIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>;
const SettingsIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

export function EditorSidebar() {
  const menus = [
    { name: 'Browser', icon: <BrowserIcon />, active: true },
    { name: 'Plugins', icon: <PluginIcon />, active: false },
    { name: 'History', icon: <HistoryIcon />, active: false },
    { name: 'Insights', icon: <FeedbackIcon />, active: false },
    { name: 'Settings', icon: <SettingsIcon />, active: false },
  ];

  return (
    <aside className="w-[84px] h-full bg-[#121215] border-r border-[#22222a] flex flex-col items-center py-4 shrink-0 shadow-[2px_0_15px_-2px_rgba(0,0,0,0.5)] z-20">
      {/* Profile */}
      <div className="w-12 h-12 rounded-full overflow-hidden mb-8 border-2 border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.3)]">
        <div className="w-full h-full bg-[#0a0a0c] flex items-center justify-center text-[#00f0ff] font-bold text-xs">User</div>
      </div>

      {/* Nav menus */}
      <nav className="flex flex-col gap-6 w-full">
        {menus.map((menu) => (
          <button 
            key={menu.name}
            className={`flex flex-col items-center justify-center gap-1.5 py-2 w-full transition-all relative
              ${menu.active ? 'text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : 'text-gray-500 hover:text-gray-300 hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]'}
            `}
          >
            {menu.active && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
            )}
            <div className={`w-8 h-8 flex items-center justify-center ${menu.active ? 'bg-[#00f0ff]/10 rounded-md border border-[#00f0ff]/30' : ''}`}>
              {menu.icon}
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider">{menu.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
