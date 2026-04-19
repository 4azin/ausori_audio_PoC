import React from 'react';
import { Group, Line } from 'react-konva';

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(180,180,180,${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface WaveformDisplayProps {
  peaks: number[];
  width: number;
  height: number;
  offsetY: number;
  color: string;
  sourceOffset: number;
  sourceDuration: number;
  clipDuration: number;
}

export function WaveformDisplay({
  peaks, width, height, offsetY, color,
  sourceOffset, sourceDuration, clipDuration,
}: WaveformDisplayProps) {
  if (peaks.length === 0 || sourceDuration <= 0) return null;

  // 전체 웨이브폼 중 트림된 구간만 추출
  const startRatio = sourceOffset / sourceDuration;
  const endRatio = (sourceOffset + Math.min(clipDuration, sourceDuration)) / sourceDuration;
  const startIdx = Math.max(0, Math.floor(startRatio * peaks.length));
  const endIdx = Math.min(peaks.length, Math.ceil(endRatio * peaks.length));
  const visiblePeaks = peaks.slice(startIdx, endIdx);

  if (visiblePeaks.length === 0) return null;

  const centerY = height / 2;
  const maxAmp = (height / 2) * 0.9;

  const fillPoints: number[] = [];
  // 배열 끝이 width에 정확히 닿도록 처리하여 빈 공간 생기는 현상 방지
  const stepWidth = width / Math.max(1, visiblePeaks.length - 1);

  // 위쪽 (좌→우)
  for (let i = 0; i < visiblePeaks.length; i++) {
    fillPoints.push(i * stepWidth, centerY - visiblePeaks[i] * maxAmp);
  }
  // 아래쪽 (우→좌, 거울)
  for (let i = visiblePeaks.length - 1; i >= 0; i--) {
    fillPoints.push(i * stepWidth, centerY + visiblePeaks[i] * maxAmp);
  }

  return (
    <Group y={offsetY} listening={false}>
      <Line
        points={fillPoints}
        fill={hexToRgba(color, 0.3)}
        stroke={color}
        strokeWidth={0.5}
        opacity={0.8}
        closed={true}
      />
      <Line
        points={[0, centerY, width, centerY]}
        stroke={color}
        strokeWidth={0.5}
        opacity={0.2}
      />
    </Group>
  );
}
