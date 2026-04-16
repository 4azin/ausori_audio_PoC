import { create } from 'zustand';
import { TimelineState } from '@/components/editor/daw/types';
import { MOCK_TRACKS } from '@/components/editor/daw/mockData';

export const useTimelineStore = create<TimelineState>((set) => ({
  // ── 시간 축 ──
  pixelsPerSecond: 66.67,     // 100px = 1.5초 → ~66.67 px/sec (기존 100px 간격 유지)
  scrollX: 0,
  duration: 80,              // 1분 20초 (영상 길이에 맞춤)

  // ── 플레이헤드 ──
  playheadTime: 0,
  isPlaying: false,

  // ── 비디오 시크 ──
  videoSeekFn: null,
  registerVideoSeek: (fn) => set({ videoSeekFn: fn }),

  // ── 오디오 시크 ──
  audioSeekFn: null,
  registerAudioSeek: (fn) => set({ audioSeekFn: fn }),

  // ── 솔로 ──
  soloTrackId: null,

  setSoloTrack: (trackId) =>
    set((state) => {
      // 이미 솔로 중인 트랙을 다시 누르면 해제
      const newSoloId = state.soloTrackId === trackId ? null : trackId;
      if (newSoloId === null) return { soloTrackId: null };

      // 솔로된 트랙의 mute 해제
      const tracks = state.tracks.map((track) => {
        if (track.id === newSoloId) return { ...track, mute: false };
        if (track.subTracks) {
          const idx = track.subTracks.findIndex((s) => s.id === newSoloId);
          if (idx !== -1) {
            const newSubs = track.subTracks.map((s, i) =>
              i === idx ? { ...s, mute: false } : s
            );
            const allMuted = newSubs.every((s) => s.mute);
            return { ...track, mute: allMuted, subTracks: newSubs };
          }
        }
        return track;
      });
      return { soloTrackId: newSoloId, tracks };
    }),

  // ── 트랙 데이터 ──
  tracks: MOCK_TRACKS,

  // ── 뷰포트 ──
  trackHeight: 96,

  // ── 액션: 타임라인 ──
  setPlayheadTime: (time) => set({ playheadTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setScrollX: (x) => set({ scrollX: x }),

  // ── 액션: 트랙 믹서 ──
  setTrackPan: (trackId, pan) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        if (track.id === trackId) return { ...track, pan };
        if (track.subTracks) {
          const updatedSubs = track.subTracks.map((sub) =>
            sub.id === trackId ? { ...sub, pan } : sub
          );
          if (updatedSubs !== track.subTracks) return { ...track, subTracks: updatedSubs };
        }
        return track;
      }),
    })),

  setTrackVol: (trackId, vol) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        if (track.id === trackId) return { ...track, vol };
        if (track.subTracks) {
          const updatedSubs = track.subTracks.map((sub) =>
            sub.id === trackId ? { ...sub, vol } : sub
          );
          if (updatedSubs !== track.subTracks) return { ...track, subTracks: updatedSubs };
        }
        return track;
      }),
    })),

  // ── 액션: 뮤트 토글 ──
  // 메인 트랙 뮤트 → 모든 서브트랙 동기화
  // 서브 트랙 뮤트 → 서브트랙 전체가 mute면 메인도 mute, 하나라도 아니면 메인 해제
  toggleTrackMute: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        // 메인 트랙
        if (track.id === trackId) {
          const newMute = !track.mute;
          return {
            ...track,
            mute: newMute,
            subTracks: track.subTracks?.map((sub) => ({ ...sub, mute: newMute })),
          };
        }
        // 서브 트랙 탐색
        if (track.subTracks) {
          const subIdx = track.subTracks.findIndex((sub) => sub.id === trackId);
          if (subIdx !== -1) {
            const newSubs = track.subTracks.map((sub, i) =>
              i === subIdx ? { ...sub, mute: !sub.mute } : sub
            );
            const allMuted = newSubs.every((sub) => sub.mute);
            return { ...track, mute: allMuted, subTracks: newSubs };
          }
        }
        return track;
      }),
    })),

  // ── 액션: 클립 이동 ──
  moveClip: (trackId, clipId, newStartTime) =>
    set((state) => {
      const tracks = state.tracks.map((track) => {
        const applyMove = (clips: typeof track.clips) =>
          clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const updated = { ...clip, startTime: Math.max(0, newStartTime) };
            console.log(`[moveClip] ${clip.name}`, {
              startTime: updated.startTime,
              duration: updated.duration,
              sourceOffset: updated.sourceOffset,
            });
            return updated;
          });

        if (track.id === trackId) return { ...track, clips: applyMove(track.clips) };
        if (track.subTracks) {
          return {
            ...track,
            subTracks: track.subTracks.map((sub) =>
              sub.id !== trackId ? sub : { ...sub, clips: applyMove(sub.clips) }
            ),
          };
        }
        return track;
      });
      return { tracks };
    }),

  // ── 액션: 왼쪽 트림 ──
  trimClipLeft: (trackId, clipId, deltaSec) =>
    set((state) => {
      const tracks = state.tracks.map((track) => {
        const processClips = (clips: typeof track.clips) =>
          clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const newOffset = Math.max(0, clip.sourceOffset + deltaSec);
            const actualDelta = newOffset - clip.sourceOffset;
            const newDuration = clip.duration - actualDelta;
            if (newDuration < 0.1) return clip;
            if (newOffset >= clip.sourceDuration) return clip;
            const updated = {
              ...clip,
              sourceOffset: newOffset,
              duration: newDuration,
              startTime: clip.startTime + actualDelta,
            };
            console.log(`[trimClipLeft] ${clip.name}`, {
              startTime: updated.startTime,
              duration: updated.duration,
              sourceOffset: updated.sourceOffset,
            });
            return updated;
          });

        if (track.id === trackId) return { ...track, clips: processClips(track.clips) };
        if (track.subTracks) {
          return {
            ...track,
            subTracks: track.subTracks.map((sub) =>
              sub.id === trackId ? { ...sub, clips: processClips(sub.clips) } : sub
            ),
          };
        }
        return track;
      });
      return { tracks };
    }),

  // ── 액션: 오른쪽 트림 ──
  trimClipRight: (trackId, clipId, newDuration) =>
    set((state) => {
      const tracks = state.tracks.map((track) => {
        const processClips = (clips: typeof track.clips) =>
          clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            const maxDuration = clip.sourceDuration - clip.sourceOffset;
            const clamped = Math.max(0.1, Math.min(newDuration, maxDuration));
            const updated = { ...clip, duration: clamped };
            console.log(`[trimClipRight] ${clip.name}`, {
              startTime: updated.startTime,
              duration: updated.duration,
              sourceOffset: updated.sourceOffset,
            });
            return updated;
          });

        if (track.id === trackId) return { ...track, clips: processClips(track.clips) };
        if (track.subTracks) {
          return {
            ...track,
            subTracks: track.subTracks.map((sub) =>
              sub.id === trackId ? { ...sub, clips: processClips(sub.clips) } : sub
            ),
          };
        }
        return track;
      });
      return { tracks };
    }),

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
