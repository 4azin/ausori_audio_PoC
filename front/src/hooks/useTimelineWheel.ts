'use client';

import { useEffect, useCallback, RefObject } from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import {
  TimelineKeymap,
  DEFAULT_TIMELINE_KEYMAP,
  resolveWheelAction,
} from '@/components/editor/daw/timelineKeymap';

interface UseTimelineWheelOptions {
  /** 휠 이벤트를 수신할 HTML 요소의 ref */
  containerRef: RefObject<HTMLElement | null>;
  /** 커스텀 키맵 (미지정 시 기본값 사용) */
  keymap?: TimelineKeymap;
  /** 현재 캔버스 너비 (줌 시 마우스 기준점 계산용) */
  canvasWidth: number;
}

/**
 * 타임라인 영역의 마우스 휠 이벤트를 처리하는 훅
 *
 * - keymap 설정에 따라 스크롤/줌 동작을 분기
 * - 줌: 마우스 포인터 위치를 기준으로 확대/축소 (포인터 아래 시간이 고정)
 * - 스크롤: 횡 방향 이동
 */
export function useTimelineWheel({
  containerRef,
  keymap = DEFAULT_TIMELINE_KEYMAP,
  canvasWidth,
}: UseTimelineWheelOptions) {
  const setScrollX = useTimelineStore((s) => s.setScrollX);
  const setPixelsPerSecond = useTimelineStore((s) => s.setPixelsPerSecond);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // 트랙 헤더 영역에서는 기본 세로 스크롤 허용 (가로채지 않음)
      const target = e.target as HTMLElement;
      if (target.closest('[data-track-header]')) return;

      e.preventDefault();

      const action = resolveWheelAction(e, keymap.wheel);

      // ── 현재 상태를 직접 읽기 (stale closure 방지) ──
      const state = useTimelineStore.getState();
      const { scrollX, pixelsPerSecond, duration } = state;

      if (action === 'scroll') {
        // ── 수평 스크롤 ──
        const delta = e.deltaY * keymap.scrollSensitivity;
        const maxScrollX = Math.max(0, duration * pixelsPerSecond - canvasWidth);
        const newScrollX = Math.max(0, Math.min(scrollX + delta, maxScrollX));
        setScrollX(newScrollX);
      } else if (action === 'zoom') {
        // ── 줌 (마우스 포인터 기준점 고정) ──
        const rect = containerRef.current?.getBoundingClientRect();
        const mouseX = rect ? e.clientX - rect.left : canvasWidth / 2;

        // 마우스 아래의 시간(초)을 계산
        const timeAtMouse = (mouseX + scrollX) / pixelsPerSecond;

        // 새 줌 레벨 계산
        const zoomFactor = 1 - e.deltaY * keymap.zoomSensitivity;
        const newPps = Math.max(
          keymap.zoomMin,
          Math.min(pixelsPerSecond * zoomFactor, keymap.zoomMax),
        );

        // 마우스 아래 시간이 같은 위치에 유지되도록 scrollX 조정
        const newScrollX = Math.max(0, timeAtMouse * newPps - mouseX);

        setPixelsPerSecond(newPps);
        setScrollX(newScrollX);
      }
      // action === 'none' → 아무것도 안 함
    },
    [keymap, canvasWidth, containerRef, setScrollX, setPixelsPerSecond],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // capture: true → 하위 요소(overflow-y-auto 등)보다 먼저 이벤트를 잡음
    // passive: false → preventDefault() 가능 (네이티브 스크롤 차단)
    const options = { passive: false, capture: true } as const;
    el.addEventListener('wheel', handleWheel, options);
    return () => el.removeEventListener('wheel', handleWheel, options);
  }, [containerRef, handleWheel]);
}
