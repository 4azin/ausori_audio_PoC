'use client';

import React from 'react';
import { Layer, Line } from 'react-konva';

interface GridLayerProps {
  width: number;
  height: number;
  trackHeight: number;
  trackCount: number;
  pixelsPerSecond: number;
  scrollX: number;
}

/**
 * 배경 그리드 레이어 — 수직/수평 그리드선 렌더링
 * 줌/리사이즈 시에만 갱신 (정적 콘텐츠)
 */
export function GridLayer({
  width,
  height,
  trackHeight,
  trackCount,
  pixelsPerSecond,
  scrollX,
}: GridLayerProps) {
  // 수직 그리드선 간격을 룰러 틱과 동기화
  const tickIntervalSec = getGridTickInterval(pixelsPerSecond);
  const tickIntervalPx = tickIntervalSec * pixelsPerSecond;

  const startTick = Math.floor(scrollX / tickIntervalPx);
  const verticalLineCount = Math.ceil(width / tickIntervalPx) + 2;

  return (
    <Layer>
      {/* 수직 그리드선 */}
      {Array.from({ length: verticalLineCount }).map((_, i) => {
        const tickIndex = startTick + i;
        const x = tickIndex * tickIntervalPx - scrollX;
        return (
          <Line
            key={`v-${tickIndex}`}
            points={[x, 0, x, height]}
            stroke="#1a1a20"
            strokeWidth={1}
          />
        );
      })}

      {/* 수평 트랙 구분선 */}
      {Array.from({ length: trackCount }).map((_, i) => (
        <Line
          key={`h-${i}`}
          points={[0, (i + 1) * trackHeight, width, (i + 1) * trackHeight]}
          stroke="#22222a"
          strokeWidth={1}
        />
      ))}
    </Layer>
  );
}

/** 그리드 간격도 룰러와 동일한 로직 사용 */
function getGridTickInterval(pps: number): number {
  const pxPerTick = 100;
  const rawInterval = pxPerTick / pps;
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const c of candidates) {
    if (c >= rawInterval) return c;
  }
  return 600;
}
