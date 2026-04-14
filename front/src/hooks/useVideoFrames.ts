'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface VideoFrame {
  time: number;          // 캡처 시점 (초)
  image: HTMLImageElement; // Konva Image에 전달할 수 있는 이미지
}

interface UseVideoFramesOptions {
  /** 비디오 소스 URL */
  src: string;
  /** 프레임 추출 간격 (초). 기본 1초 */
  intervalSec?: number;
  /** 썸네일 너비 (px). 기본 160 */
  thumbWidth?: number;
  /** 썸네일 높이 (px). 기본 80 */
  thumbHeight?: number;
}

interface UseVideoFramesResult {
  frames: VideoFrame[];
  duration: number;       // 비디오 총 길이 (초)
  isLoading: boolean;
  error: string | null;
}

/**
 * 비디오에서 일정 간격으로 프레임을 추출하는 훅
 *
 * 파이프라인:
 * 1. 숨겨진 <video> 생성 → src 로드
 * 2. 메타데이터 로드 후 duration 확인
 * 3. 각 시점으로 seek → canvasContext.drawImage → toDataURL → HTMLImageElement
 * 4. 완성된 프레임 배열을 반환
 */
export function useVideoFrames({
  src,
  intervalSec = 1,
  thumbWidth = 160,
  thumbHeight = 80,
}: UseVideoFramesOptions): UseVideoFramesResult {
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 중복 실행 방지
  const abortRef = useRef(false);
  const prevSrcRef = useRef('');

  const extractFrames = useCallback(async () => {
    if (!src || src === prevSrcRef.current) return;
    prevSrcRef.current = src;
    abortRef.current = false;

    setIsLoading(true);
    setError(null);
    setFrames([]);

    try {
      // ── 1. 숨겨진 video 요소 생성 ──
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'auto';
      video.src = src;

      // ── 2. 메타데이터 로드 대기 ──
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error(`비디오 로드 실패: ${src}`));
      });

      const videoDuration = video.duration;
      if (!isFinite(videoDuration) || videoDuration <= 0) {
        throw new Error('유효하지 않은 비디오 길이');
      }
      setDuration(videoDuration);

      // ── 3. Canvas 준비 ──
      const canvas = document.createElement('canvas');
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D 컨텍스트를 생성할 수 없습니다');

      // ── 4. 프레임 추출 루프 ──
      const extractedFrames: VideoFrame[] = [];
      const timePoints: number[] = [];

      for (let t = 0; t < videoDuration; t += intervalSec) {
        timePoints.push(t);
      }

      for (const time of timePoints) {
        if (abortRef.current) break;

        // seek
        video.currentTime = time;
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        // draw
        ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        // HTMLImageElement로 변환 (Konva Image가 이것을 기대)
        const img = await loadImage(dataUrl);

        extractedFrames.push({ time, image: img });

        // 점진적 업데이트 — 프레임이 추출될 때마다 UI에 반영
        setFrames([...extractedFrames]);
      }

      // 비디오 리소스 정리
      video.src = '';
      video.load();

    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : '프레임 추출 중 오류 발생');
      }
    } finally {
      setIsLoading(false);
    }
  }, [src, intervalSec, thumbWidth, thumbHeight]);

  useEffect(() => {
    extractFrames();

    return () => {
      abortRef.current = true;
    };
  }, [extractFrames]);

  return { frames, duration, isLoading, error };
}

/** dataURL → HTMLImageElement 로드 헬퍼 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
