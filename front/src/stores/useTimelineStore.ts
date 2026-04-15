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

  // ── 비디오 시크 ──
  videoSeekFn: null,
  registerVideoSeek: (fn) => set({ videoSeekFn: fn }),

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
      tracks: state.tracks.map((track) => {
        if (track.id === trackId) {
          return {
            ...track,
            clips: track.clips.map((clip) =>
              clip.id !== clipId ? clip : { ...clip, startTime: Math.max(0, newStartTime) },
            ),
          };
        }
        // 메인 트랙이 아니고 서브 트랙이 있을 경우 서브 트랙에서도 탐색
        if (track.subTracks) {
          return {
            ...track,
            subTracks: track.subTracks.map((subTrack) =>
              subTrack.id !== trackId
                ? subTrack
                : {
                    ...subTrack,
                    clips: subTrack.clips.map((clip) =>
                      clip.id !== clipId ? clip : { ...clip, startTime: Math.max(0, newStartTime) },
                    ),
                  }
            ),
          };
        }
        return track;
      }),
    })),

  // ── 액션: 왼쪽 트림 ──
  trimClipLeft: (trackId, clipId, deltaSec) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        const processClips = (clips: typeof track.clips) =>
          clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const newOffset = Math.max(0, clip.sourceOffset + deltaSec);
            const actualDelta = newOffset - clip.sourceOffset;
            const newDuration = clip.duration - actualDelta;
            if (newDuration < 0.1) return clip;
            if (newOffset >= clip.sourceDuration) return clip;
            return {
              ...clip,
              sourceOffset: newOffset,
              duration: newDuration,
              startTime: clip.startTime + actualDelta,
            };
          });

        if (track.id === trackId) {
          return { ...track, clips: processClips(track.clips) };
        }
        if (track.subTracks) {
          return {
            ...track,
            subTracks: track.subTracks.map((sub) =>
              sub.id === trackId ? { ...sub, clips: processClips(sub.clips) } : sub
            ),
          };
        }
        return track;
      }),
    })),

  // ── 액션: 오른쪽 트림 ──
  trimClipRight: (trackId, clipId, newDuration) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        const processClips = (clips: typeof track.clips) =>
          clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const maxDuration = clip.sourceDuration - clip.sourceOffset;
            const clamped = Math.max(0.1, Math.min(newDuration, maxDuration));
            return { ...clip, duration: clamped };
          });

        if (track.id === trackId) {
          return { ...track, clips: processClips(track.clips) };
        }
        if (track.subTracks) {
          return {
            ...track,
            subTracks: track.subTracks.map((sub) =>
              sub.id === trackId ? { ...sub, clips: processClips(sub.clips) } : sub
            ),
          };
        }
        return track;
      }),
    })),

  // ── 뷰 상태 (UI) ──
  expandedTrackIds: {},
  toggleTrackExpansion: (trackId) =>
    set((state) => ({
      expandedTrackIds: {
        ...state.expandedTrackIds,
        [trackId]: !state.expandedTrackIds[trackId],
      },
    })),
}));

// ── 유틸: 화면에 보이는 트랙 목록(평탄화) ──
export const getVisibleTracks = (state: TimelineState) => {
  const visible = [];
  for (const track of state.tracks) {
    visible.push(track);
    if (state.expandedTrackIds[track.id] && track.subTracks && track.subTracks.length > 0) {
      for (const subTrack of track.subTracks) {
        visible.push(subTrack);
      }
    }
  }
  return visible;
};
