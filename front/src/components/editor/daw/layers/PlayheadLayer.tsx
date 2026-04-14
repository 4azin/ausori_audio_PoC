'use client';

import React, { useCallback } from 'react';
import { Layer, Group, Line, Path, Rect } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';

interface PlayheadLayerProps {
  x: number;              // 플레이헤드 x 위치 (px)
  height: number;         // 레이어 전체 높이
  showHandle?: boolean;   // 삼각형 핸들 표시 여부 (룰러에서는 true)
  canvasWidth?: number;   // 드래그 범위 제한용
  onDrag?: (newX: number) => void;   // 드래그 중 콜백
}

// 드래그 히트 영역 너비 (실제 선 2px보다 넓게 잡아서 잡기 쉽게)
const DRAG_HIT_WIDTH = 16;

/**
 * 플레이헤드 레이어 — 현재 재생 위치를 표시
 * 
 * - 삼각형 핸들 또는 수직선을 드래그하여 위치 변경 가능
 * - listening={false}로 설정하여 클립 이벤트를 차단하지 않음
 * - 배경 클릭은 Stage.onClick에서 처리 (TimelineCanvas 참고)
 * - 별도 Konva Layer로 분리하여 다른 레이어 리렌더 방지
 */
export function PlayheadLayer({
  x,
  height,
  showHandle = false,
  canvasWidth = 9999,
  onDrag,
}: PlayheadLayerProps) {

  // ── 드래그 핸들러 (x축만 이동, 0~canvasWidth 범위 제한) ──
  const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    // y축 고정
    node.y(0);
    // x축 범위 제한
    const newX = Math.max(0, Math.min(node.x(), canvasWidth));
    node.x(newX);

    if (onDrag) {
      onDrag(newX);
    }
  }, [canvasWidth, onDrag]);

  return (
    <Layer listening={true}>
      {/* 플레이헤드 그룹 (드래그 가능) */}
      <Group
        x={x}
        y={0}
        draggable={!!onDrag}
        onDragMove={handleDragMove}
      >
        {/* 삼각형 핸들 (룰러 영역) */}
        {showHandle && (
          <Path
            data="M-6,0 L6,0 L0,12 Z"
            fill="#ff0055"
            shadowColor="#ff0055"
            shadowBlur={10}
          />
        )}

        {/* 수직선 — 항상 y=0부터 시작하여 삼각형과 끊김 없이 연결 */}
        <Line
          points={[0, 0, 0, height]}
          stroke="#ff0055"
          strokeWidth={2}
          shadowColor="#ff0055"
          shadowBlur={8}
          listening={false}
        />

        {/* 투명 히트 영역 — 가느다란 선을 쉽게 잡을 수 있도록 */}
        <Rect
          x={-DRAG_HIT_WIDTH / 2}
          y={0}
          width={DRAG_HIT_WIDTH}
          height={height}
          fill="transparent"
        />
      </Group>
    </Layer>
  );
}
