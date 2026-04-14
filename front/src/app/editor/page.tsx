"use client";

import { EditorTopBar } from '@/components/editor/EditorTopBar';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { AiRecommendations } from '@/components/editor/AiRecommendations';
import { DawTimeline } from '@/components/editor/daw/DawTimeline';
import { TransportBar } from '@/components/editor/TransportBar';

export default function EditorPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0d0d0d] font-sans text-gray-200 selection:bg-[#00f0ff]/30 selection:text-white">
      <EditorTopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor Area */}
        <main className="flex flex-col flex-1 overflow-hidden">

          <div className="flex flex-1 overflow-hidden">
            {/* Left side: DAW Timeline (Wide) */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-[#22222a]">
              <DawTimeline />
            </div>

            {/* Right side: Video & AI Recommendations (Fixed width) */}
            <div className="w-[450px] shrink-0 flex flex-col bg-[#121215]">
              {/* Top Right: Video Preview */}
              <div className="flex flex-col border-b border-[#22222a]" style={{ flex: '0 0 auto' }}>
                <VideoPreview />
              </div>

              {/* Bottom Right: AI Recommendations */}
              <div className="flex-1 flex flex-col min-h-0">
                <AiRecommendations />
              </div>
            </div>
          </div>

          {/* Bottom section: Transport Controls */}
          <TransportBar />
        </main>
      </div>
    </div>
  );
}
