import React from 'react';
import { Group, Rect } from 'react-konva';
import { WaveformDisplay } from './WaveformDisplay';
import { useAudioWaveform } from '@/hooks/useAudioWaveform';
import { Clip, Track } from '../types';

interface TrackOverviewProps {
  track: Track;
  trackHeight: number;
  pixelsPerSecond: number;
  scrollX: number;
  canvasWidth: number;
}

// 개별 클립에 대해 웨이브폼 훅을 호출하기 위한 서브 컴포넌트
function TrackOverviewClip({
  clip, x, y, width, height, pixelsPerSecond, fallbackColor
}: {
  clip: Clip; x: number; y: number; width: number; height: number;
  pixelsPerSecond: number; fallbackColor: string;
}) {
  const { waveform } = useAudioWaveform({
    src: clip.audioSrc || '',
    samplesCount: Math.max(20, Math.round((clip.sourceDuration * pixelsPerSecond) / 4)),
  });

  return (
    <Group x={x} y={y}>
      <Rect
        width={width}
        height={height}
        fill={clip.color || fallbackColor}
        opacity={0.6}
        cornerRadius={2}
      />
      {waveform && (
        <WaveformDisplay
          peaks={waveform.peaks}
          width={width}
          height={height}
          offsetY={0}
          color={clip.color || fallbackColor}
          sourceOffset={clip.sourceOffset}
          sourceDuration={clip.sourceDuration}
          clipDuration={clip.duration}
        />
      )}
    </Group>
  );
}

export function TrackOverview({ track, trackHeight, pixelsPerSecond, scrollX, canvasWidth }: TrackOverviewProps) {
  const subTracks = track.subTracks || [];
  const subTrackCount = Math.max(1, subTracks.length);

  // 대분류 트랙에서 개요들이 차지할 총 세로 높이 (일반 오디오 클립과 동일한 상하 8px 여백 적용)
  const CLIP_PADDING = 8;
  const totalOverviewHeight = trackHeight - (CLIP_PADDING * 2);
  // 각 줄 간의 간격
  const gap = subTrackCount > 1 ? 4 : 0;
  // 각 개별 개요 줄의 높이
  const eachLineHeight = Math.max(2, (totalOverviewHeight - (subTrackCount - 1) * gap) / subTrackCount);
  
  // 개요가 시작될 Y 좌표 (상단 여백)
  const startY = CLIP_PADDING;

  return (
    <Group>
      {subTracks.map((subTrack, index) => {
        const lineY = startY + index * (eachLineHeight + gap);

        return subTrack.clips.map((clip) => {
          const x = clip.startTime * pixelsPerSecond - scrollX;
          const width = clip.duration * pixelsPerSecond;
          
          // 화면 밖에 있는 건 렌더링 무시
          if (x + width < 0 || x > canvasWidth) return null;

          return (
            <TrackOverviewClip
              key={clip.id}
              clip={clip}
              x={x}
              y={lineY}
              width={width}
              height={eachLineHeight}
              pixelsPerSecond={pixelsPerSecond}
              fallbackColor={track.color || '#555'}
            />
          );
        });
      })}
    </Group>
  );
}
