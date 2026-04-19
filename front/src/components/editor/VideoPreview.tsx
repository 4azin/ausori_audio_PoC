'use client';

import React, { useRef, useEffect } from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30); // 30fps 기준
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
    String(f).padStart(2, '0'),
  ].join(':');
}

export function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const registerVideoSeek = useTimelineStore((s) => s.registerVideoSeek);

  // 비디오 트랙 vol/mute 동기화용
  const videoVol = useTimelineStore((s) => s.tracks.find((t) => t.type === 'video')?.vol ?? 1);
  const videoMute = useTimelineStore((s) => s.tracks.find((t) => t.type === 'video')?.mute ?? false);
  const videoTrackId = useTimelineStore((s) => s.tracks.find((t) => t.type === 'video')?.id ?? 'video');
  const soloTrackId = useTimelineStore((s) => s.soloTrackId);

  // 비디오 트랙 vol/mute → video 엘리먼트 동기화
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // soloTrackId가 있고 비디오 트랙이 아니면 강제 음소거
    const shouldMute = videoMute || (soloTrackId !== null && soloTrackId !== videoTrackId);
    video.muted = shouldMute;
    video.volume = Math.min(1, Math.max(0, videoVol));
  }, [videoVol, videoMute, soloTrackId, videoTrackId]);

  // 외부(드래그/클릭)에서 시크할 수 있도록 함수를 store에 등록
  useEffect(() => {
    registerVideoSeek((time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    });
    return () => registerVideoSeek(null);
  }, [registerVideoSeek]);

  // isPlaying 변화에 따라 영상 재생/정지 + RAF 루프
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));

      const tick = () => {
        setPlayheadTime(video.currentTime);
        if (video.ended) {
          setIsPlaying(false);
        } else {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(rafRef.current);
    } else {
      video.pause();
      cancelAnimationFrame(rafRef.current);
    }
  }, [isPlaying, setIsPlaying, setPlayheadTime]);

  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden shrink-0">
      <video
        ref={videoRef}
        src="/sample/samplevideo.mp4"
        className="w-full h-full object-contain"
        preload="metadata"
      />

      {/* 타임코드 오버레이 */}
      <div className="absolute bottom-6 right-6 bg-black/80 backdrop-blur-sm px-4 py-2 font-mono font-bold text-xl text-[#00f0ff] tracking-wider rounded shadow-[0_0_15px_rgba(0,240,255,0.2)] border border-[#00f0ff]/40">
        {formatTimecode(playheadTime)}
      </div>
    </div>
  );
}
