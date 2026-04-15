import React from 'react';
import { Button } from '../ui/Button';

interface EditorTopBarProps {
  onExport?: () => void;
}

export function EditorTopBar({ onExport }: EditorTopBarProps) {
  return (
    <header className="h-14 w-full bg-[#0a0a0c] border-b border-[#22222a] flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1 font-black text-xl tracking-wide text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
          SonicFlow AI
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Projects</span>
          <span>/</span>
          <span className="font-semibold text-gray-300">My_Vlog_Final.mp4</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
          Save
        </button>
        <Button
          onClick={onExport}
          className="bg-[#00f0ff] hover:bg-[#00c0cc] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)] rounded px-6 py-1.5 h-8 text-sm font-bold tracking-wider"
        >
          EXPORT
        </Button>
      </div>
    </header>
  );
}
