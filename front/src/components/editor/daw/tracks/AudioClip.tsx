'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Clip } from '../types';
import { useAudioWaveform } from '@/hooks/useAudioWaveform';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { WaveformDisplay } from './WaveformDisplay';

interface AudioClipProps {
  clip: Clip;
  trackId: string;
  trackHeight: number;
  pixelsPerSecond: number;
  scrollX: number;
}

const CLIP_PADDING = 8;
const LABEL_HEIGHT = 16;
const HANDLE_WIDTH = 6;        // 리사이즈 핸들 너비
const HANDLE_HIT_WIDTH = 12;   // 핸들 히트 영역 (잡기 쉽게)

/**
 * 개별 오디오 클립 — 드래그 이동 + 리사이즈 핸들 + 웨이브폼
 *
 * - 클립 본체를 드래그하면 좌우 이동 (startTime 변경)
 * - 호버 시 양쪽 끝에 리사이즈 핸들 표시
 * - 핸들 드래그 시 트림 (잘라내기, 속도 변경 아님)
 */
export function AudioClip({ clip, trackId, trackHeight, pixelsPerSecond, scrollX }: AudioClipProps) {
  const [isHovered, setIsHovered] = useState(false);

  // 로컬 프리뷰 상태 (관성 제거 및 부드러운 드래그용)
  const [localPreview, setLocalPreview] = useState<{
    startTime: number;
    duration: number;
    sourceOffset: number;
  } | null>(null);

  const activeClip = localPreview ? { ...clip, ...localPreview } : clip;
  const clipWidth = activeClip.duration * pixelsPerSecond;
  const clipX = activeClip.startTime * pixelsPerSecond - scrollX;
  const innerHeight = trackHeight - CLIP_PADDING * 2;

  // Store 액션
  const moveClip = useTimelineStore((s) => s.moveClip);
  const trimClipLeft = useTimelineStore((s) => s.trimClipLeft);
  const trimClipRight = useTimelineStore((s) => s.trimClipRight);

  // 드래그 시작 시점의 값을 기억
  const dragStartRef = useRef({ startTime: 0, x: 0 });
  const trimStartRef = useRef({ sourceOffset: 0, duration: 0, startTime: 0, x: 0 });

  // 웨이브폼 추출 (원본 길이 기반으로 샘플링 고정하여 덜덜 떨림 현상 해결)
  const { waveform } = useAudioWaveform({
    src: activeClip.audioSrc || '',
    samplesCount: Math.max(50, Math.round((activeClip.sourceDuration * pixelsPerSecond) / 2)),
  });

  const bgFill = hexToRgba(activeClip.color, 0.15);

  // ═══════════════════════════════════════════════
  //  클립 본체 드래그 (좌우 이동)
  // ═══════════════════════════════════════════════

  const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
    dragStartRef.current = {
      startTime: clip.startTime,
      x: e.target.x(),
    };
  }, [clip.startTime]);

  const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    // y축 고정
    e.target.y(CLIP_PADDING);

    const dx = e.target.x() - dragStartRef.current.x;
    const deltaSec = dx / pixelsPerSecond;
    const newStartTime = Math.max(0, dragStartRef.current.startTime + deltaSec);
    
    // 글로벌 스토어 대신 로컬 프리뷰 상태만 업데이트하여 관성(Lag) 제거
    setLocalPreview({
      startTime: newStartTime,
      duration: clip.duration,
      sourceOffset: clip.sourceOffset,
    });
  }, [pixelsPerSecond, clip.duration, clip.sourceOffset]);

  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const dx = e.target.x() - dragStartRef.current.x;
    const deltaSec = dx / pixelsPerSecond;
    const newStartTime = Math.max(0, dragStartRef.current.startTime + deltaSec);
    
    setLocalPreview(null);
    moveClip(trackId, clip.id, newStartTime);
  }, [pixelsPerSecond, trackId, clip.id, moveClip]);

  // ═══════════════════════════════════════════════
  //  왼쪽 핸들 드래그 (트림 시작)
  // ═══════════════════════════════════════════════

  const handleLeftTrimStart = useCallback((e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true; // 부모 그룹 드래그 방지
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    trimStartRef.current = {
      sourceOffset: clip.sourceOffset,
      duration: clip.duration,
      startTime: clip.startTime,
      x: pointer ? pointer.x : e.target.absolutePosition().x, // 절대 좌표(pointer) 사용
    };
  }, [clip.sourceOffset, clip.duration, clip.startTime]);

  const handleLeftTrimMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    e.target.y(0); // y축 고정
    e.target.x(0); // 부모 노드(클립)가 마우스 방향으로 이동하므로 내부 원점(0) 강제 유지 (떨림 현상 완전 해결)

    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const dx = pointer.x - trimStartRef.current.x;
    let deltaSec = dx / pixelsPerSecond;

    // 핸들이 최대치를 넘어서 끌려가지 않도록 이동 한계 계산
    const maxDelta = trimStartRef.current.duration - 0.1; // 최대 오른쪽 이동 (남은 길이)
    const minDelta = -trimStartRef.current.sourceOffset; // 최대 왼쪽 이동

    if (deltaSec > maxDelta) deltaSec = maxDelta;
    if (deltaSec < minDelta) deltaSec = minDelta;

    setLocalPreview({
      startTime: trimStartRef.current.startTime + deltaSec,
      duration: trimStartRef.current.duration - deltaSec,
      sourceOffset: trimStartRef.current.sourceOffset + deltaSec,
    });
  }, [pixelsPerSecond]);

  const handleLeftTrimEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    e.target.x(0);
    
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    const pointX = pointer ? pointer.x : trimStartRef.current.x;
    
    const dx = pointX - trimStartRef.current.x;
    let deltaSec = dx / pixelsPerSecond;
    const maxDelta = trimStartRef.current.duration - 0.1;
    const minDelta = -trimStartRef.current.sourceOffset;

    deltaSec = Math.max(minDelta, Math.min(maxDelta, deltaSec));

    setLocalPreview(null);
    trimClipLeft(trackId, clip.id, deltaSec);
  }, [pixelsPerSecond, trackId, clip.id, trimClipLeft]);

  // ═══════════════════════════════════════════════
  //  오른쪽 핸들 드래그 (트림 끝)
  // ═══════════════════════════════════════════════

  const handleRightTrimStart = useCallback((e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    trimStartRef.current = {
      sourceOffset: clip.sourceOffset,
      duration: clip.duration,
      startTime: clip.startTime,
      x: e.target.x(),
    };
  }, [clip.sourceOffset, clip.duration, clip.startTime]);

  const handleRightTrimMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    e.target.y(0);

    const dx = e.target.x() - trimStartRef.current.x;
    let deltaSec = dx / pixelsPerSecond;

    // 핸들이 최대치를 넘어서 끌려가지 않도록 이동 한계 계산
    const maxDelta = clip.sourceDuration - trimStartRef.current.sourceOffset - trimStartRef.current.duration;
    const minDelta = -trimStartRef.current.duration + 0.1;

    if (deltaSec > maxDelta) {
      deltaSec = maxDelta;
      e.target.x(trimStartRef.current.x + maxDelta * pixelsPerSecond);
    }
    if (deltaSec < minDelta) {
      deltaSec = minDelta;
      e.target.x(trimStartRef.current.x + minDelta * pixelsPerSecond);
    }

    const newDuration = trimStartRef.current.duration + deltaSec;
    
    setLocalPreview({
      startTime: clip.startTime,
      duration: newDuration,
      sourceOffset: clip.sourceOffset,
    });
  }, [pixelsPerSecond, clip.sourceDuration, clip.startTime, clip.sourceOffset]);

  const handleRightTrimEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    
    const dx = e.target.x() - trimStartRef.current.x;
    let deltaSec = dx / pixelsPerSecond;
    const maxDelta = clip.sourceDuration - trimStartRef.current.sourceOffset - trimStartRef.current.duration;
    const minDelta = -trimStartRef.current.duration + 0.1;

    deltaSec = Math.max(minDelta, Math.min(maxDelta, deltaSec));
    const newDuration = trimStartRef.current.duration + deltaSec;

    setLocalPreview(null);
    trimClipRight(trackId, clip.id, newDuration);
    
    e.target.x(newDuration * pixelsPerSecond - HANDLE_WIDTH);
  }, [pixelsPerSecond, clip.sourceDuration, trackId, clip.id, trimClipRight]);

  // ═══════════════════════════════════════════════
  //  커서 스타일 관리
  // ═══════════════════════════════════════════════

  const setCursor = useCallback((cursor: string) => {
    const stage = document.querySelector('canvas');
    if (stage) stage.style.cursor = cursor;
  }, []);

  return (
    <Group
      x={clipX}
      y={CLIP_PADDING}
      draggable
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => { setIsHovered(true); setCursor('grab'); }}
      onMouseLeave={() => { setIsHovered(false); setCursor('default'); }}
    >
      {/* 클립 배경 */}
      <Rect
        name="clipBody"
        width={clipWidth}
        height={innerHeight}
        fill={bgFill}
        stroke={isHovered ? lightenColor(activeClip.color, 0.3) : activeClip.color}
        strokeWidth={isHovered ? 1.5 : 1}
        cornerRadius={2}
        shadowColor={activeClip.color}
        shadowBlur={isHovered ? 8 : 5}
        shadowOpacity={isHovered ? 0.4 : 0.2}
      />

      {/* 클립 이름 */}
      <Text
        x={HANDLE_WIDTH + 2}
        y={4}
        width={Math.max(0, clipWidth - (HANDLE_WIDTH + 2) * 2)}
        wrap="none"
        ellipsis={true}
        text={activeClip.name}
        fontSize={9}
        fontStyle="bold"
        fill={activeClip.color}
        shadowColor={activeClip.color}
        shadowBlur={2}
        listening={false}
      />

      {/* 웨이브폼 렌더링 */}
      {waveform ? (
        <WaveformDisplay
          peaks={waveform.peaks}
          width={clipWidth}
          height={innerHeight - LABEL_HEIGHT}
          offsetY={LABEL_HEIGHT}
          color={activeClip.color}
          sourceOffset={activeClip.sourceOffset}
          sourceDuration={activeClip.sourceDuration}
          clipDuration={activeClip.duration}
        />
      ) : null}

      {/* ═══════════════════════════════════════
          리사이즈 핸들 (호버 시 표시)
          ═══════════════════════════════════════ */}
      {isHovered && (
        <>
          {/* 왼쪽 핸들 */}
          <Group
            x={0}
            y={0}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: pos.y })}
            onDragStart={handleLeftTrimStart}
            onDragMove={handleLeftTrimMove}
            onDragEnd={handleLeftTrimEnd}
            onMouseEnter={() => setCursor('col-resize')}
            onMouseLeave={() => setCursor('grab')}
          >
            {/* 히트 영역 (투명, 넓게) */}
            <Rect
              x={-HANDLE_HIT_WIDTH / 2 + HANDLE_WIDTH / 2}
              width={HANDLE_HIT_WIDTH}
              height={innerHeight}
              fill="transparent"
            />
            {/* 시각적 핸들 */}
            <Rect
              width={HANDLE_WIDTH}
              height={innerHeight}
              fill={activeClip.color}
              opacity={0.3}
              cornerRadius={[2, 0, 0, 2]}
            />
            {/* 핸들 그립 라인 */}
            <Line
              points={[HANDLE_WIDTH / 2, innerHeight * 0.3, HANDLE_WIDTH / 2, innerHeight * 0.7]}
              stroke="white"
              strokeWidth={1}
              opacity={0.8}
            />
          </Group>

          {/* 오른쪽 핸들 */}
          <Group
            x={clipWidth - HANDLE_WIDTH}
            y={0}
            draggable
            dragBoundFunc={(pos) => ({ x: pos.x, y: pos.y })}
            onDragStart={handleRightTrimStart}
            onDragMove={handleRightTrimMove}
            onDragEnd={handleRightTrimEnd}
            onMouseEnter={() => setCursor('col-resize')}
            onMouseLeave={() => setCursor('grab')}
          >
            {/* 히트 영역 */}
            <Rect
              x={-HANDLE_HIT_WIDTH / 2 + HANDLE_WIDTH / 2}
              width={HANDLE_HIT_WIDTH}
              height={innerHeight}
              fill="transparent"
            />
            {/* 시각적 핸들 */}
            <Rect
              width={HANDLE_WIDTH}
              height={innerHeight}
              fill={activeClip.color}
              opacity={0.3}
              cornerRadius={[0, 2, 2, 0]}
            />
            {/* 핸들 그립 라인 */}
            <Line
              points={[HANDLE_WIDTH / 2, innerHeight * 0.3, HANDLE_WIDTH / 2, innerHeight * 0.7]}
              stroke="white"
              strokeWidth={1}
              opacity={0.8}
            />
          </Group>
        </>
      )}
    </Group>
  );
}

// ═══════════════════════════════════════════════════════════
//  유틸리티
// ═══════════════════════════════════════════════════════════

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(180,180,180,${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenColor(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.min(255, parseInt(result[1], 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(result[2], 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(result[3], 16) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}
