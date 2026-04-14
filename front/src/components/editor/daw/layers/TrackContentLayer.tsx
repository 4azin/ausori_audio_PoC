'use client';

import React from 'react';
import { Layer, Group } from 'react-konva';
import { Track } from '../types';
import { AudioClip } from '../tracks/AudioClip';
import { VideoFrameStrip } from '../tracks/VideoFrameStrip';

interface TrackContentLayerProps {
  tracks: Track[];
  trackHeight: number;
  pixelsPerSecond: number;
  canvasWidth: number;
  scrollX: number;
}

/**
 * 트랙 콘텐츠 레이어 — 모든 트랙의 클립들을 관리
 * 
 * 각 Track의 y 오프셋을 계산하고, track.type에 따라
 * VideoFrameStrip 또는 AudioClip을 배치합니다.
 */
export function TrackContentLayer({
  tracks,
  trackHeight,
  pixelsPerSecond,
  canvasWidth,
  scrollX,
}: TrackContentLayerProps) {
  return (
    <Layer>
      {tracks.map((track, index) => (
        <Group key={track.id} y={index * trackHeight}>
          {track.type === 'video' ? (
            /* 비디오 트랙: 프레임 스트립 */
            <VideoFrameStrip
              width={canvasWidth}
              trackHeight={trackHeight}
              videoSrc={track.videoSrc}
              pixelsPerSecond={pixelsPerSecond}
              scrollX={scrollX}
            />
          ) : (
            /* 오디오 트랙: 클립들 (뷰포트 밖은 스킵) */
            track.clips
              .filter((clip) => {
                const clipStartPx = clip.startTime * pixelsPerSecond - scrollX;
                const clipEndPx = clipStartPx + clip.duration * pixelsPerSecond;
                return clipEndPx > 0 && clipStartPx < canvasWidth;
              })
              .map((clip) => (
                <AudioClip
                  key={clip.id}
                  clip={clip}
                  trackId={track.id}
                  trackHeight={trackHeight}
                  pixelsPerSecond={pixelsPerSecond}
                  scrollX={scrollX}
                />
              ))
          )}
        </Group>
      ))}
    </Layer>
  );
}

