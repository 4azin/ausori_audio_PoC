'use client';

import React from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import { useVideoFrames, VideoFrame } from '@/hooks/useVideoFrames';

interface VideoFrameStripProps {
  width: number;           // 사용 가능한 전체 너비
  trackHeight: number;
  videoSrc?: string;       // 비디오 소스 URL
  pixelsPerSecond: number; // 줌 레벨
  scrollX: number;         // 수평 스크롤 오프셋
}

const STRIP_PADDING = 4;

/**
 * 비디오 프레임 스트립 — 비디오에서 추출한 프레임 썸네일을 나열
 *
 * - videoSrc가 없으면 플레이스홀더 표시
 * - 프레임 추출 중이면 로딩 인디케이터 + 이미 추출된 프레임 표시
 * - 줌 레벨에 따라 프레임 간격(intervalSec) 자동 조절
 */
export function VideoFrameStrip({
  width,
  trackHeight,
  videoSrc,
  pixelsPerSecond,
  scrollX,
}: VideoFrameStripProps) {
  const innerHeight = trackHeight - STRIP_PADDING * 2;

  // 프레임 간격: 줌 레벨에 따라 프레임 너비가 ~thumbWidth px이 되도록 조절
  const thumbHeight = innerHeight;
  const aspectRatio = 16 / 9;
  const thumbWidth = Math.round(thumbHeight * aspectRatio);
  const intervalSec = Math.max(0.5, thumbWidth / pixelsPerSecond);

  const { frames, duration, isLoading, error } = useVideoFrames({
    src: videoSrc || '',
    intervalSec,
    thumbWidth,
    thumbHeight: Math.round(thumbHeight),
  });

  // videoSrc가 없으면 플레이스홀더 표시
  if (!videoSrc) {
    return <PlaceholderStrip width={width} trackHeight={trackHeight} />;
  }

  // 전체 스트립 너비 (비디오 길이 기반)
  const totalStripWidth = duration > 0
    ? duration * pixelsPerSecond
    : Math.max(200, width - STRIP_PADDING * 2);

  return (
    <Group x={STRIP_PADDING} y={STRIP_PADDING}>
      {/* 배경 */}
      <Rect
        width={Math.min(totalStripWidth, width - STRIP_PADDING * 2)}
        height={innerHeight}
        fill="#0d0d12"
        stroke="#2a2a35"
        strokeWidth={1}
        cornerRadius={3}
      />

      {/* 프레임 썸네일 시퀀스 */}
      {frames.map((frame: VideoFrame, i: number) => {
        const frameX = frame.time * pixelsPerSecond - scrollX;
        const frameEndX = frameX + thumbWidth;

        // 뷰포트 밖의 프레임은 렌더링 스킵 (가상화)
        if (frameEndX < 0 || frameX > width) return null;

        return (
          <Group key={i} x={frameX} y={0}>
            <KonvaImage
              image={frame.image}
              width={thumbWidth}
              height={innerHeight}
              cornerRadius={2}
            />
            {/* 프레임 사이 구분선 */}
            <Rect
              x={thumbWidth - 1}
              y={0}
              width={1}
              height={innerHeight}
              fill="rgba(0,0,0,0.6)"
            />
          </Group>
        );
      })}

      {/* 로딩 인디케이터 */}
      {isLoading && (
        <Group x={frames.length * thumbWidth + 8} y={innerHeight / 2 - 6}>
          <Text
            text="⏳ 프레임 추출 중..."
            fontSize={10}
            fill="#00f0ff"
            fontStyle="italic"
          />
        </Group>
      )}

      {/* 에러 표시 */}
      {error && (
        <Text
          x={8}
          y={innerHeight / 2 - 5}
          text={`⚠ ${error}`}
          fontSize={10}
          fill="#ff4444"
        />
      )}

      {/* 테두리 오버레이 */}
      <Rect
        width={Math.min(totalStripWidth, width - STRIP_PADDING * 2)}
        height={innerHeight}
        fill="transparent"
        stroke="#3a3a50"
        strokeWidth={1}
        cornerRadius={3}
      />
    </Group>
  );
}

/** videoSrc 없을 때 표시되는 플레이스홀더 */
function PlaceholderStrip({ width, trackHeight }: { width: number; trackHeight: number }) {
  const innerWidth = Math.max(200, width - STRIP_PADDING * 2);
  const innerHeight = trackHeight - STRIP_PADDING * 2;

  return (
    <Group x={STRIP_PADDING} y={STRIP_PADDING}>
      <Rect
        width={innerWidth}
        height={innerHeight}
        fill="transparent"
        stroke="#3a3a45"
        strokeWidth={1}
        dash={[5, 10]}
        cornerRadius={4}
      />
      <Text
        x={innerWidth / 2 - 100 > 0 ? innerWidth / 2 - 100 : 10}
        y={innerHeight / 2 - 5}
        text="영상을 분석하여 프레임이 추가될 예정입니다"
        fontSize={12}
        fontFamily="Arial"
        fill="#4a4a5a"
        fontStyle="italic"
      />
    </Group>
  );
}
