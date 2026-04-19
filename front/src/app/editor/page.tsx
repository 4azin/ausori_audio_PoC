"use client";

import { useState } from 'react';
import { EditorTopBar } from '@/components/editor/EditorTopBar';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { AiRecommendations } from '@/components/editor/AiRecommendations';
import { DawTimeline } from '@/components/editor/daw/DawTimeline';
import { TransportBar } from '@/components/editor/TransportBar';
import { ExportOverlay } from '@/components/editor/ExportOverlay';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { exportVideo, ExportPhase } from '@/lib/videoExporter';
import { useTimelineStore } from '@/stores/useTimelineStore';

export default function EditorPage() {
  useAudioEngine();

  const [exporting, setExporting] = useState(false);
  const [exportPhase, setExportPhase] = useState<ExportPhase>('preparing');
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    if (exporting) return;

    // 재생 중이면 정지
    useTimelineStore.getState().setIsPlaying(false);

    const { tracks, soloTrackId } = useTimelineStore.getState();

    setExporting(true);
    setExportPhase('preparing');
    setExportProgress(0);

    try {
      await exportVideo(
        { tracks, soloTrackId, videoSrc: '/sample/samplevideo.mp4' },
        (phase, progress) => {
          setExportPhase(phase);
          if (progress !== undefined) setExportProgress(progress);
        }
      );
    } catch (err) {
      console.error('[Export] 실패:', err);
      alert(`Export 중 오류가 발생했습니다.\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0d0d0d] font-sans text-gray-200 selection:bg-[#00f0ff]/30 selection:text-white">
      {/* Export 로딩 오버레이 */}
      {exporting && <ExportOverlay phase={exportPhase} progress={exportProgress} />}

      <EditorTopBar onExport={handleExport} />
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
