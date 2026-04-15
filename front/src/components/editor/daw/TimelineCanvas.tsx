'use client';

import React, { useRef, useCallback } from 'react';
import { Stage } from 'react-konva';
import { useSize } from '@/hooks/useSize';
import { useTimelineStore, getVisibleTracks } from '@/stores/useTimelineStore';
import { useShallow } from 'zustand/react/shallow';
import { useTimelineWheel } from '@/hooks/useTimelineWheel';
import { TrackHeaderList } from './TrackHeaderList';

// ── Layer 컴포넌트 ──
import { RulerLayer } from './layers/RulerLayer';
import { GridLayer } from './layers/GridLayer';
import { PlayheadLayer } from './layers/PlayheadLayer';
import { TrackContentLayer } from './layers/TrackContentLayer';

const RULER_HEIGHT = 20;

export function TimelineCanvas() {
  const timelineWrapperRef = useRef<HTMLDivElement>(null);
  const rulerContainerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const { width: rulerWidth } = useSize(rulerContainerRef);
  const { width: gridWidth, height: gridHeight } = useSize(gridContainerRef);

  // ── Zustand Store ──
  const tracks = useTimelineStore((s) => s.tracks);
  const visibleTracks = useTimelineStore(useShallow(getVisibleTracks));
  const trackHeight = useTimelineStore((s) => s.trackHeight);
  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond);
  const scrollX = useTimelineStore((s) => s.scrollX);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const videoSeekFn = useTimelineStore((s) => s.videoSeekFn);
  const audioSeekFn = useTimelineStore((s) => s.audioSeekFn);

  // ── 휠 스크롤 / 줌 ──
  const canvasWidth = rulerWidth || gridWidth;
  useTimelineWheel({
    containerRef: timelineWrapperRef,
    canvasWidth,
  });

  // ── 파생 값 ──
  const playheadX = playheadTime * pixelsPerSecond - scrollX;

  // ── px 위치 → 시간(초) 변환 후 Store 업데이트 + 영상 시크 ──
  const updatePlayheadFromX = useCallback((xPx: number) => {
    const time = Math.max(0, (xPx + scrollX) / pixelsPerSecond);
    setPlayheadTime(time);
    videoSeekFn?.(time);
    audioSeekFn?.(time);
  }, [scrollX, pixelsPerSecond, setPlayheadTime, videoSeekFn, audioSeekFn]);

  // ── Stage 클릭으로 플레이헤드 이동 (빈 영역 = 그리드/룰러 클릭 시만) ──
  const handleStageClick = useCallback((e: import('konva/lib/Node').KonvaEventObject<MouseEvent>) => {
    // 클립 등 다른 요소를 클릭한 경우는 무시 (Stage 자체 또는 Grid 배경만 처리)
    const targetName = e.target?.name?.() || '';
    if (targetName === 'clipBody') return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (pos) updatePlayheadFromX(pos.x);
  }, [updatePlayheadFromX]);

  // ── 드래그로 플레이헤드 이동 ──
  const handleDrag = useCallback((newX: number) => {
    updatePlayheadFromX(newX);
  }, [updatePlayheadFromX]);

  return (
    <div ref={timelineWrapperRef} className="flex flex-col flex-1 overflow-hidden">
      {/* ════════════════════════════════════════════════════════════
          Ruler Row (Fixed at top, never scrolls vertically)
          ════════════════════════════════════════════════════════════ */}
      <div className="flex h-5 bg-[#15151a] shrink-0 text-xs text-gray-500 font-mono select-none">
        {/* Header spacer – matches TrackHeaderList width */}
        <div className="w-[280px] bg-[#121215] border-r border-[#22222a] flex flex-col justify-center px-4 shrink-0 shadow-[2px_0_5px_rgba(0,0,0,0.5)] z-20" />

        {/* Ruler canvas */}
        <div className="flex-1 relative overflow-hidden bg-[#15151a] cursor-pointer" ref={rulerContainerRef}>
          {rulerWidth > 0 && (
            <Stage width={rulerWidth} height={RULER_HEIGHT} className="absolute inset-0" onClick={handleStageClick}>
              <RulerLayer
                width={rulerWidth}
                pixelsPerSecond={pixelsPerSecond}
                scrollX={scrollX}
              />
              <PlayheadLayer
                x={playheadX}
                height={RULER_HEIGHT}
                showHandle={true}
                canvasWidth={rulerWidth}
                onDrag={handleDrag}
              />
            </Stage>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          Track Area (Scrollable vertically)
          ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-y-auto relative overflow-x-hidden">
        <div className="flex w-full min-w-max h-fit min-h-full">
          <TrackHeaderList />

          {/* Grid canvas */}
          <div className="flex-1 bg-[#0a0a0c] overflow-hidden relative cursor-pointer" ref={gridContainerRef}>
            {gridWidth > 0 && gridHeight > 0 && (
              <Stage width={gridWidth} height={gridHeight} className="absolute inset-0" onClick={handleStageClick}>
                {/* Layer 1: 정적 배경 그리드 */}
                <GridLayer
                  width={gridWidth}
                  height={gridHeight}
                  trackHeight={trackHeight}
                  trackCount={visibleTracks.length}
                  pixelsPerSecond={pixelsPerSecond}
                  scrollX={scrollX}
                />

                {/* Layer 2: 트랙 콘텐츠 (클립, 웨이브폼) */}
                <TrackContentLayer
                  tracks={visibleTracks}
                  trackHeight={trackHeight}
                  pixelsPerSecond={pixelsPerSecond}
                  canvasWidth={gridWidth}
                  scrollX={scrollX}
                />

                {/* Layer 3: 플레이헤드 (독립 갱신) */}
                <PlayheadLayer
                  x={playheadX}
                  height={gridHeight}
                  canvasWidth={gridWidth}
                  onDrag={handleDrag}
                />
              </Stage>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
