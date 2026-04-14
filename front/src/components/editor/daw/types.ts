// ── DAW Timeline 핵심 타입 정의 ──

/** 개별 클립 (오디오 or 비디오) */
export interface Clip {
  id: string;
  name: string;
  startTime: number;      // 초 단위 — 타임라인 위 시작점
  duration: number;        // 초 단위 — 보이는(트림된) 클립 길이
  color: string;           // 클립 테마 색상 (rgba or hex)

  // ── 소스 오디오 관련 (트리밍 정보) ──
  /** 원본 오디오 내에서 재생 시작 오프셋 (초). 기본 0 */
  sourceOffset: number;
  /** 원본 오디오의 전체 길이 (초). 트림 한계값으로 사용 */
  sourceDuration: number;

  /** 오디오 파일 URL (웨이브폼 추출용) */
  audioSrc?: string;
  /** 레거시: 하드코딩 웨이브폼 SVG path */
  waveformPath?: string;
}

/** 트랙 타입 */
export type TrackType = 'video' | 'audio';

/** 개별 트랙 */
export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;       // 트랙 테마 색상
  io: string;          // I/O 라벨
  clips: Clip[];
  subTracks?: Track[];
  /** 비디오 트랙 전용: 프레임 추출할 비디오 소스 URL */
  videoSrc?: string;
}

/** 타임라인 전역 상태 */
export interface TimelineState {
  // ── 시간 축 ──
  pixelsPerSecond: number;
  scrollX: number;
  duration: number;        // 전체 타임라인 길이 (초)

  // ── 플레이헤드 ──
  playheadTime: number;    // 현재 재생 위치 (초)
  isPlaying: boolean;

  // ── 트랙 데이터 ──
  tracks: Track[];

  // ── 뷰포트 ──
  trackHeight: number;

  // ── 액션: 타임라인 ──
  setPlayheadTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPixelsPerSecond: (pps: number) => void;
  setScrollX: (x: number) => void;

  // ── 액션: 클립 조작 ──
  /** 클립을 타임라인 위에서 좌우로 이동 (startTime 변경) */
  moveClip: (trackId: string, clipId: string, newStartTime: number) => void;
  /** 클립의 왼쪽 끝을 트림 (sourceOffset 증가, duration 감소, startTime 이동) */
  trimClipLeft: (trackId: string, clipId: string, deltaSec: number) => void;
  /** 클립의 오른쪽 끝을 트림 (duration 변경) */
  trimClipRight: (trackId: string, clipId: string, newDuration: number) => void;
}
