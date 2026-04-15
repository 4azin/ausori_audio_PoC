import { useEffect, useRef } from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { audioEngine } from '@/lib/audioEngine';

/**
 * 오디오 엔진을 store 상태와 연결하는 훅.
 * EditorPage 최상단에서 한 번만 호출한다.
 */
export function useAudioEngine() {
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const tracks = useTimelineStore((s) => s.tracks);
  const soloTrackId = useTimelineStore((s) => s.soloTrackId);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const registerAudioSeek = useTimelineStore((s) => s.registerAudioSeek);

  // 최신 값을 async 콜백에서 참조하기 위한 ref
  const isPlayingRef = useRef(isPlaying);
  const tracksRef = useRef(tracks);
  const soloRef = useRef(soloTrackId);
  const playheadRef = useRef(playheadTime);

  isPlayingRef.current = isPlaying;
  tracksRef.current = tracks;
  soloRef.current = soloTrackId;
  playheadRef.current = playheadTime;

  // ── isPlaying 변화 → 재생 시작 / 정지 ──
  useEffect(() => {
    if (isPlaying) {
      audioEngine.play(tracksRef.current, soloRef.current, playheadRef.current);
    } else {
      audioEngine.stopAll();
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 수동 시크 콜백 등록 (타임라인 클릭, 이동 버튼) ──
  useEffect(() => {
    registerAudioSeek((time: number) => {
      // 재생 중일 때만 새 위치에서 재시작
      if (!isPlayingRef.current) return;
      audioEngine.play(tracksRef.current, soloRef.current, time);
    });
    return () => registerAudioSeek(null);
  }, [registerAudioSeek]);

  // ── 언마운트 시 엔진 소멸 ──
  useEffect(() => {
    return () => {
      audioEngine.destroy();
    };
  }, []);
}
