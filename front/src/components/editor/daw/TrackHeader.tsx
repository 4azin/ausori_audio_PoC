import React from 'react';

export type TrackInfo = {
  id: string | number;
  name: string;
  io: string;
  type: string;
  subTracks?: TrackInfo[];
};

interface TrackHeaderProps {
  track: TrackInfo;
  isSubTrack?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function TrackHeader({ track, isSubTrack = false, isExpanded = false, onToggleExpand }: TrackHeaderProps) {
  const containerClasses = `h-24 border-b border-[#22222a] p-2 flex flex-col justify-between transition-colors group ${
    isSubTrack ? 'bg-[#0a0a0c] pl-6 hover:bg-[#121215]' : 'hover:bg-[#1a1a20]'
  }`;

  const isVideo = track.type === 'video';
  const nameColor = isVideo ? 'text-[#b500ff]' : (isSubTrack ? 'text-gray-400' : 'text-gray-200');

  return (
    <div className={containerClasses}>
      {/* ── 상단: 이름 + S/M ── */}
      <div className="flex justify-between items-center">
        <span className={`font-bold text-sm ${nameColor}`}>
          {isSubTrack && <span className="mr-1 opacity-50 text-[#00f0ff]">↳</span>}
          {track.name}
        </span>
        <div className="flex gap-1">
          <button className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-[#1a1a20] border border-[#2a2a35] text-gray-400 hover:text-[#00f0ff] hover:border-[#00f0ff] transition-all">S</button>
          <button className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-[#1a1a20] border border-[#2a2a35] text-gray-400 hover:text-[#ff0055] hover:border-[#ff0055] transition-all">M</button>
        </div>
      </div>

      {/* ── 하단: PAN / VOL + 펼치기 버튼 ── */}
      <div className="flex items-stretch gap-2 mt-auto mb-1">
        <div className="flex flex-col gap-2 flex-1">
          {/* PAN — 오디오 트랙만 표시 */}
          {!isVideo && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase font-bold text-gray-600 tracking-wide w-4">PAN</span>
              <div className="flex-1 h-3 bg-[#0a0a0c] border border-[#2a2a35] rounded-full relative flex items-center px-1">
                <div className="w-2.5 h-2.5 bg-[#00f0ff] rounded-full absolute left-1/2 -ml-1.5 shadow-[0_0_5px_#00f0ff]"></div>
              </div>
              <span className="text-[9px] text-[#00f0ff] font-mono font-bold text-center w-6 shrink-0 bg-[#0a0a0c] rounded px-0.5 shadow-[inset_0_0_3px_black]">C</span>
            </div>
          )}

          {/* VOL */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-bold text-gray-600 tracking-wide w-4">VOL</span>
            <div className="flex-1 h-3 bg-[#0a0a0c] border border-[#2a2a35] rounded-full relative flex items-center px-[2px]">
              <div
                className="h-1.5 rounded-full opacity-80"
                style={{
                  width: '75%',
                  background: isVideo
                    ? 'linear-gradient(to right, #b500ff, #ff0055)'
                    : 'linear-gradient(to right, #00f0ff, #b500ff, #ff0055)',
                }}
              ></div>
              <div className="w-2.5 h-2.5 bg-white rounded-full absolute shadow-[0_0_5px_white]" style={{ left: '75%', marginLeft: '-5px' }}></div>
            </div>
            <span className="text-[9px] text-[#00f0ff] font-mono font-bold text-center w-6 shrink-0 bg-[#0a0a0c] rounded px-0.5 shadow-[inset_0_0_3px_black]">0.0</span>
          </div>
        </div>

        {/* 오디오 메인 트랙: 펼치기 버튼 / 비디오 트랙: 동일 너비 빈 공간 */}
        {!isSubTrack && (
          onToggleExpand ? (
            <button
              onClick={onToggleExpand}
              className={`flex items-center justify-center w-6 rounded shrink-0 border transition-all
                ${isExpanded
                  ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                  : 'bg-[#1a1a20] border-[#2a2a35] text-gray-400 hover:bg-[#22222a] hover:text-[#00f0ff] hover:border-[#00f0ff]'
                }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
          ) : (
            /* 펼치기 버튼 없는 경우(비디오 등) — 슬라이더 길이 맞추는 빈 공간 */
            <div className="w-6 shrink-0" />
          )
        )}
      </div>
    </div>
  );
}
