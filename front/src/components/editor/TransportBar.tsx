'use client';

import React from 'react';
import { useTimelineStore } from '@/stores/useTimelineStore';

export function TransportBar() {
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const videoSeekFn = useTimelineStore((s) => s.videoSeekFn);
  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond);
  const setPixelsPerSecond = useTimelineStore((s) => s.setPixelsPerSecond);

  const PPS_MIN = 20;
  const PPS_MAX = 400;
  // 로그 스케일: 슬라이더 0~100 → pps 20~400
  const toSlider = (pps: number) =>
    Math.round((Math.log(pps) - Math.log(PPS_MIN)) / (Math.log(PPS_MAX) - Math.log(PPS_MIN)) * 100);
  const fromSlider = (v: number) =>
    Math.round(Math.exp(Math.log(PPS_MIN) + (v / 100) * (Math.log(PPS_MAX) - Math.log(PPS_MIN))));

  const sliderValue = toSlider(pixelsPerSecond);
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPixelsPerSecond(fromSlider(Number(e.target.value)));
  const handleZoomMinus = () =>
    setPixelsPerSecond(Math.max(PPS_MIN, fromSlider(Math.max(0, sliderValue - 10))));
  const handleZoomPlus = () =>
    setPixelsPerSecond(Math.min(PPS_MAX, fromSlider(Math.min(100, sliderValue + 10))));

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const seekTo = (time: number) => {
    const clamped = Math.max(0, time);
    setPlayheadTime(clamped);
    videoSeekFn?.(clamped);
  };

  const handleGoToStart = () => seekTo(0);
  const handleBack10 = () => seekTo(playheadTime - 10);
  const handleForward10 = () => seekTo(playheadTime + 10);

  return (
    <div className="h-16 bg-[#121215] border-t border-[#22222a] flex items-center px-4 justify-between shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20 relative">

      {/* Grid and Zoom Controls */}
      <div className="flex flex-col gap-1 w-[250px]">
        <div className="flex items-center justify-between px-2">
          <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Zoom</span>
          <span className="text-[9px] font-mono text-[#00f0ff]/60">{Math.round(pixelsPerSecond)}px/s</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomMinus}
            className="w-6 h-6 bg-[#1a1a20] border border-[#2a2a35] text-gray-400 rounded flex items-center justify-center hover:bg-[#25252b] hover:text-[#00f0ff] transition-colors shrink-0"
          >-</button>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={handleZoomChange}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-[#0a0a0c] [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:border-[#22222a] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00f0ff] [&::-webkit-slider-thumb]:shadow-[0_0_6px_#00f0ff] [&::-webkit-slider-thumb]:-mt-[3px]"
            style={{ background: `linear-gradient(to right, #00f0ff ${sliderValue}%, #0a0a0c ${sliderValue}%)` }}
          />
          <button
            onClick={handleZoomPlus}
            className="w-6 h-6 bg-[#1a1a20] border border-[#2a2a35] text-gray-400 rounded flex items-center justify-center hover:bg-[#25252b] hover:text-[#00f0ff] transition-colors shrink-0"
          >+</button>
        </div>
      </div>

      {/* Main Transport Controls */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">

        {/* 처음으로 이동 */}
        <button onClick={handleGoToStart} className="w-10 h-10 bg-[#1a1a20] border border-[#2a2a35] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#25252b] hover:border-[#00f0ff]/50 transition-all group" title="처음으로 이동">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-[#00f0ff]">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* 뒤로 빨리감기 */}
        {/* <button className="w-10 h-10 bg-[#1a1a20] border border-[#2a2a35] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#25252b] hover:border-[#00f0ff]/50 transition-all group" title="뒤로 빨리감기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-[#00f0ff]">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        </button> */}

        {/* 뒤로 10초 */}
        <button onClick={handleBack10} className="w-10 h-10 bg-[#1a1a20] border border-[#2a2a35] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#25252b] hover:border-[#00f0ff]/50 transition-all group" title="10초 뒤로">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-[#00f0ff]">
            <path d="M3 11a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        {/* 재생 / 정지 */}
        <button
          onClick={handlePlayPause}
          className="w-14 h-14 bg-[#0a0a0c] rounded-full flex items-center justify-center transition-all transform hover:scale-105 mx-1"
          style={{
            border: `2px solid ${isPlaying ? '#ff0055' : '#00f0ff'}`,
            boxShadow: isPlaying
              ? '0 0 15px rgba(255,0,85,0.4), 0 0 30px rgba(255,0,85,0.2) inset'
              : '0 0 15px rgba(0,240,255,0.4), 0 0 30px rgba(0,240,255,0.2) inset',
          }}
          title={isPlaying ? '정지' : '재생'}
        >
          {isPlaying ? (
            /* 정지 아이콘 — 빨간색 || */
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff0055" className="drop-shadow-[0_0_8px_#ff0055]">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            /* 재생 아이콘 — 삼각형 중앙 정렬 */
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#00f0ff" className="drop-shadow-[0_0_8px_#00f0ff]">
              {/* 꼭짓점: (7,5) (7,19) (17,12) → bounding box x: 7~17, center=12 */}
              <path d="M7 5v14l10-7z" />
            </svg>
          )}
        </button>

        {/* 앞으로 10초 */}
        <button onClick={handleForward10} className="w-10 h-10 bg-[#1a1a20] border border-[#2a2a35] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#25252b] hover:border-[#00f0ff]/50 transition-all group" title="10초 앞으로">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-[#00f0ff]">
            <path d="M21 11a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>

        {/* 앞으로 빨리감기 */}
        {/* <button className="w-10 h-10 bg-[#1a1a20] border border-[#2a2a35] rounded-full shadow-[0_4px_6px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-[#25252b] hover:border-[#00f0ff]/50 transition-all group" title="앞으로 빨리감기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-[#00f0ff]">
            <path d="M4 6v12l8.5-6L4 6zm7.5 0v12l8.5-6-8.5-6z" />
          </svg>
        </button> */}
      </div>
    </div>
  );
}
