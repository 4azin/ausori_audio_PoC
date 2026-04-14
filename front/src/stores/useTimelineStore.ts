import { create } from 'zustand';
import { TimelineState } from '@/components/editor/daw/types';
import { MOCK_TRACKS } from '@/components/editor/daw/mockData';

export const useTimelineStore = create<TimelineState>((set) => ({
  // ── 시간 축 ──
  pixelsPerSecond: 66.67,     // 100px = 1.5초 → ~66.67 px/sec (기존 100px 간격 유지)
  scrollX: 0,
  duration: 120,              // 2분

  // ── 플레이헤드 ──
  playheadTime: 0,
  isPlaying: false,

  // ── 트랙 데이터 ──
  tracks: MOCK_TRACKS,

  // ── 뷰포트 ──
  trackHeight: 96,

  // ── 액션: 타임라인 ──
  setPlayheadTime: (time) => set({ playheadTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setScrollX: (x) => set({ scrollX: x }),

  // ── 액션: 클립 이동 ──
  moveClip: (trackId, clipId, newStartTime) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id !== trackId
          ? track
          : {
              ...track,
              clips: track.clips.map((clip) =>
                clip.id !== clipId
                  ? clip
                  : { ...clip, startTime: Math.max(0, newStartTime) },
              ),
            },
      ),
    })),

  // ── 액션: 왼쪽 트림 ──
  // deltaSec > 0 → 왼쪽을 깎음 (sourceOffset 증가, duration 감소, startTime 우측 이동)
  // deltaSec < 0 → 왼쪽을 복원 (sourceOffset 감소, duration 증가, startTime 좌측 이동)
  trimClipLeft: (trackId, clipId, deltaSec) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id !== trackId
          ? track
          : {
              ...track,
              clips: track.clips.map((clip) => {
                if (clip.id !== clipId) return clip;

                const newOffset = Math.max(0, clip.sourceOffset + deltaSec);
                const actualDelta = newOffset - clip.sourceOffset;
                const newDuration = clip.duration - actualDelta;

                // 최소 0.1초는 유지
                if (newDuration < 0.1) return clip;
                // sourceDuration 범위 초과 방지
                if (newOffset >= clip.sourceDuration) return clip;

                return {
                  ...clip,
                  sourceOffset: newOffset,
                  duration: newDuration,
                  startTime: clip.startTime + actualDelta,
                };
              }),
            },
      ),
    })),

  // ── 액션: 오른쪽 트림 ──
  trimClipRight: (trackId, clipId, newDuration) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id !== trackId
          ? track
          : {
              ...track,
              clips: track.clips.map((clip) => {
                if (clip.id !== clipId) return clip;

                // 최소 0.1초, 최대 sourceDuration - sourceOffset
                const maxDuration = clip.sourceDuration - clip.sourceOffset;
                const clamped = Math.max(0.1, Math.min(newDuration, maxDuration));

                return { ...clip, duration: clamped };
              }),
            },
      ),
    })),
}));
