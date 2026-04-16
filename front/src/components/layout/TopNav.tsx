'use client';

import { Button } from '../ui/Button';
import Link from 'next/link';
import { useProjectStore } from '@/stores/useProjectStore';

export function TopNav() {
  const { openUploadModal } = useProjectStore();

  return (
    <header className="flex h-16 items-center justify-between px-6 border-b border-border bg-[#1c1c1c]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-md bg-[#e65a41] flex items-center justify-center font-bold text-white text-sm">S</div>
          <span className="text-lg font-medium tracking-wide text-[#e0e0e0] flex items-center gap-2 hover:bg-white/5 py-1 px-2 rounded transition-colors">
            SSAFY-프로젝트
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={openUploadModal} className="bg-[#446bdf] hover:bg-[#5277e9] rounded px-4 text-sm font-medium">+ Project</Button>
        <Button size="sm" variant="outline" className="border-transparent hover:bg-white/10 rounded px-4 text-sm text-[#e0e0e0]">Share</Button>
        <div className="w-8 h-8 rounded-full bg-gray-700 ml-4 border border-gray-600 overflow-hidden cursor-pointer hover:ring-2 hover:ring-gray-500 transition-all">
          <svg className="w-full h-full text-gray-400 mt-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
      </div>
    </header>
  );
}
