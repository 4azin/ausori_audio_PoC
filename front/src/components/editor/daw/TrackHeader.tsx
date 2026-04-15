'use client';

import React from 'react';
import { Track } from './types';
import { useTimelineStore } from '@/stores/useTimelineStore';

interface TrackHeaderProps {
  track: Track;
  isSubTrack?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/** vol(0~2) → dB 문자열 */
function volToDb(vol: number): string {
  if (vol <= 0) return '–∞';
  const db = 20 * Math.log10(vol);
  return db.toFixed(1);
}

/** pan(-1~1) → 표시 문자열 */
function panLabel(pan: number): string {
  if (Math.abs(pan) < 0.01) return 'C';
  const pct = Math.round(Math.abs(pan) * 100);
  return pan < 0 ? `L${pct}` : `R${pct}`;
}

export function TrackHeader({ track, isSubTrack = false, isExpanded = false, onToggleExpand }: TrackHeaderProps) {
  const setTrackPan = useTimelineStore((s) => s.setTrackPan);
  const setTrackVol = useTimelineStore((s) => s.setTrackVol);
  const toggleTrackSolo = useTimelineStore((s) => s.toggleTrackSolo);
  const toggleTrackMute = useTimelineStore((s) => s.toggleTrackMute);

  const isVideo = track.type === 'video';
  const showPan = isSubTrack && !isVideo;   // PAN은 서브 트랙에서만
  const trackColor = isVideo ? '#b500ff' : track.color;

  const containerClasses = `h-24 border-b border-[#22222a] p-2 flex flex-col justify-between transition-colors ${
    isSubTrack ? 'bg-[#0a0a0c] pl-6 hover:bg-[#121215]' : 'hover:bg-[#1a1a20]'
  }`;

  // vol: 0~2 → 슬라이더 0~200
  const volInt = Math.round(track.vol * 100);
  const volFillPct = Math.min((track.vol / 2) * 100, 100);
  const volThumbPct = volFillPct;

  // pan: -1~1 → 슬라이더 -100~100
  const panFillPct = ((track.pan + 1) / 2) * 100; // 0%(L) ~ 50%(C) ~ 100%(R)

  return (
    <div className={containerClasses}>
      {/* ── 상단: 이름 + S/M ── */}
      <div className="flex justify-between items-center">
        <span
          className="font-bold text-sm truncate max-w-[130px]"
          style={{ color: isSubTrack ? `${trackColor}bb` : trackColor }}
        >
          {isSubTrack && <span className="mr-1 opacity-50" style={{ color: trackColor }}>↳</span>}
          {track.name}
        </span>
        <div className="flex gap-1 shrink-0">
          {/* Solo */}
          <button
            onClick={() => toggleTrackSolo(track.id)}
            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition-all ${
              track.solo
                ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300 shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                : 'bg-[#1a1a20] border-[#2a2a35] text-gray-400 hover:text-yellow-300 hover:border-yellow-400'
            }`}
            title="Solo"
          >S</button>
          {/* Mute */}
          <button
            onClick={() => toggleTrackMute(track.id)}
            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border transition-all ${
              track.mute
                ? 'bg-[#ff0055]/20 border-[#ff0055] text-[#ff0055] shadow-[0_0_6px_rgba(255,0,85,0.5)]'
                : 'bg-[#1a1a20] border-[#2a2a35] text-gray-400 hover:text-[#ff0055] hover:border-[#ff0055]'
            }`}
            title="Mute"
          >M</button>
        </div>
      </div>

      {/* ── 하단: (PAN?) / VOL + 펼치기 버튼 ── */}
      <div className="flex items-stretch gap-2 mt-auto mb-1 min-h-[44px]">
        <div className="flex flex-col gap-2 flex-1">

          {/* PAN — 서브 트랙 + 오디오만 표시 */}
          {showPan && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase font-bold text-gray-600 tracking-wide w-4">PAN</span>
              <div className="flex-1 h-3 bg-[#0a0a0c] border border-[#2a2a35] rounded-full relative flex items-center overflow-hidden">
                {/* 세로 중심선 */}
                <div className="absolute left-1/2 w-px h-full bg-[#2a2a35]" />
                {/* 썸 */}
                <div
                  className="w-2.5 h-2.5 rounded-full absolute -translate-x-1/2 shadow-[0_0_5px_#00f0ff] z-10 pointer-events-none"
                  style={{ left: `${panFillPct}%`, backgroundColor: '#00f0ff' }}
                />
                {/* 투명 range input */}
                <input
                  type="range" min={-100} max={100} step={1}
                  value={Math.round(track.pan * 100)}
                  onChange={(e) => setTrackPan(track.id, Number(e.target.value) / 100)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-[9px] text-[#00f0ff] font-mono font-bold text-center w-6 shrink-0 bg-[#0a0a0c] rounded px-0.5 shadow-[inset_0_0_3px_black]">
                {panLabel(track.pan)}
              </span>
            </div>
          )}

          {/* VOL */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-bold text-gray-600 tracking-wide w-4">VOL</span>
            <div className="flex-1 h-3 bg-[#0a0a0c] border border-[#2a2a35] rounded-full relative flex items-center overflow-hidden px-[2px]">
              {/* 채움 */}
              <div
                className="h-1.5 rounded-full opacity-80 pointer-events-none"
                style={{
                  width: `${volFillPct}%`,
                  background: isVideo
                    ? 'linear-gradient(to right, #b500ff, #ff0055)'
                    : `linear-gradient(to right, ${track.color}88, ${track.color})`,
                }}
              />
              {/* 썸 */}
              <div
                className="w-2.5 h-2.5 bg-white rounded-full absolute shadow-[0_0_5px_white] pointer-events-none"
                style={{ left: `${volThumbPct}%`, marginLeft: '-5px' }}
              />
              {/* 투명 range input */}
              <input
                type="range" min={0} max={200} step={1}
                value={volInt}
                onChange={(e) => setTrackVol(track.id, Number(e.target.value) / 100)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[9px] text-[#00f0ff] font-mono font-bold text-center w-6 shrink-0 bg-[#0a0a0c] rounded px-0.5 shadow-[inset_0_0_3px_black]">
              {volToDb(track.vol)}
            </span>
          </div>
        </div>

        {/* 메인 트랙: 펼치기 버튼 or 빈 공간 */}
        {!isSubTrack && (
          onToggleExpand ? (
            <button
              onClick={onToggleExpand}
              className={`flex items-center justify-center w-6 rounded shrink-0 border transition-all ${
                isExpanded
                  ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                  : 'bg-[#1a1a20] border-[#2a2a35] text-gray-400 hover:bg-[#22222a] hover:text-[#00f0ff] hover:border-[#00f0ff]'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
          ) : (
            <div className="w-6 shrink-0" />
          )
        )}
      </div>
    </div>
  );
}
