'use client';

import React from 'react';
import { Layer, Group, Line, Text } from 'react-konva';

interface RulerLayerProps {
  width: number;
  pixelsPerSecond: number;
  scrollX: number;
}

/**
 * 눈금자 레이어 — 시간 틱 마크와 라벨을 렌더링
 * 줌 레벨(pixelsPerSecond)에 따라 틱 간격을 적응적으로 조절
 */
export function RulerLayer({ width, pixelsPerSecond, scrollX }: RulerLayerProps) {
  // 줌 레벨에 따라 적응적 틱 간격 결정
  const tickIntervalSec = getAdaptiveTickInterval(pixelsPerSecond);
  const tickIntervalPx = tickIntervalSec * pixelsPerSecond;

  // 보이는 영역에서 렌더링할 틱 수
  const startTick = Math.floor(scrollX / tickIntervalPx);
  const tickCount = Math.ceil(width / tickIntervalPx) + 2;

  return (
    <Layer>
      {Array.from({ length: tickCount }).map((_, i) => {
        const tickIndex = startTick + i;
        const x = tickIndex * tickIntervalPx - scrollX;
        const timeSec = tickIndex * tickIntervalSec;
        const timeString = formatTime(timeSec);

        return (
          <Group key={tickIndex} x={x} y={10}>
            {/* 주요 틱 마크 */}
            <Line
              points={[0, 0, 0, 4]}
              stroke="#b500ff"
              strokeWidth={1}
              opacity={0.8}
            />
            {/* 시간 라벨 */}
            <Text
              x={4}
              y={-2}
              text={timeString}
              fontSize={10}
              fill="#b500ff"
              opacity={0.8}
            />
          </Group>
        );
      })}

    </Layer>
  );
}

/** 줌 레벨에 따른 적응적 틱 간격 (초) */
function getAdaptiveTickInterval(pps: number): number {
  const pxPerTick = 100; // 최소 100px 간격 유지
  const rawInterval = pxPerTick / pps;

  // 깔끔한 간격으로 스냅
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  for (const c of candidates) {
    if (c >= rawInterval) return c;
  }
  return 600;
}

/** 초 → MM:SS 포맷 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
