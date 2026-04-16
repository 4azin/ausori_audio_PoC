// ── 타임라인 단축키 / 입력 매핑 설정 ──
//
// 나중에 단축키를 변경하고 싶으면 이 파일만 수정하면 됩니다.
// 사용자 설정 UI를 만들 때도 이 구조를 그대로 활용할 수 있습니다.

/** 수식키(Modifier) 조합 */
export interface ModifierKeys {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;   // macOS Cmd
}

/** 휠 이벤트에 매핑할 수 있는 액션 */
export type WheelAction = 'scroll' | 'zoom' | 'none';

/** 휠 바인딩 하나의 정의 */
export interface WheelBinding {
  /** 이 바인딩을 활성화하는 수식키 조합 */
  modifiers: ModifierKeys;
  /** 수행할 액션 */
  action: WheelAction;
}

/** 전체 타임라인 키맵 설정 */
export interface TimelineKeymap {
  /** 마우스 휠 바인딩 목록 (위에서부터 첫 번째 매칭을 사용) */
  wheel: WheelBinding[];

  /** 수평 스크롤 감도 (px / deltaY 1단위) */
  scrollSensitivity: number;

  /** 줌 감도 (배율 변경량 / deltaY 1단위). 값이 클수록 빠르게 줌 */
  zoomSensitivity: number;

  /** 줌 범위 제한 (pixelsPerSecond) */
  zoomMin: number;
  zoomMax: number;
}

// ═══════════════════════════════════════════════════════════
//  기본 키맵 설정
//  - 휠: 좌우 스크롤
//  - Ctrl + 휠: 줌 인/아웃
// ═══════════════════════════════════════════════════════════

export const DEFAULT_TIMELINE_KEYMAP: TimelineKeymap = {
  wheel: [
    // Ctrl + 휠 → 줌 (먼저 체크)
    {
      modifiers: { ctrl: true },
      action: 'zoom',
    },
    // 휠만 → 수평 스크롤 (fallback)
    {
      modifiers: {},
      action: 'scroll',
    },
  ],

  scrollSensitivity: 1.5,   // deltaY 1 당 1.5px 이동
  zoomSensitivity: 0.001,   // deltaY 1 당 0.1% 배율 변경
  zoomMin: 10,              // 최소 10 px/sec (많이 줌아웃)
  zoomMax: 500,             // 최대 500 px/sec (많이 줌인)
};

// ═══════════════════════════════════════════════════════════
//  유틸리티
// ═══════════════════════════════════════════════════════════

/** 현재 이벤트의 수식키가 바인딩 조건에 맞는지 확인 */
export function matchesModifiers(
  event: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean },
  modifiers: ModifierKeys,
): boolean {
  const ctrl = modifiers.ctrl ?? false;
  const shift = modifiers.shift ?? false;
  const alt = modifiers.alt ?? false;
  const meta = modifiers.meta ?? false;

  return (
    event.ctrlKey === ctrl &&
    event.shiftKey === shift &&
    event.altKey === alt &&
    event.metaKey === meta
  );
}

/** 휠 이벤트에 대해 첫 번째 매칭되는 액션을 찾기 */
export function resolveWheelAction(
  event: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean },
  bindings: WheelBinding[],
): WheelAction {
  for (const binding of bindings) {
    if (matchesModifiers(event, binding.modifiers)) {
      return binding.action;
    }
  }
  return 'none';
}
