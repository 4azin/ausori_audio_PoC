'use client';

import React from 'react';
import type { ExportPhase } from '@/lib/videoExporter';

interface Props {
  phase: ExportPhase;
  progress: number; // 0 ~ 1
}

const PHASE_LABEL: Record<ExportPhase, string> = {
  preparing: '파일 준비 중',
  mixing:    '오디오 믹싱 중',
  recording: '영상 렌더링 중',
};

const PHASE_SUB: Record<ExportPhase, string> = {
  preparing: '오디오 트랙을 불러오는 중...',
  mixing:    '모든 트랙을 혼합하고 있습니다...',
  recording: '영상을 프레임 단위로 캡처하는 중...',
};

export function ExportOverlay({ phase, progress }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md">
      {/* 배경 그리드 장식 */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,240,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 카드 */}
      <div className="relative flex flex-col items-center gap-7 text-center w-[380px] bg-[#0d0d12]/90 border border-[#00f0ff]/20 rounded-2xl p-10 shadow-[0_0_60px_rgba(0,240,255,0.1)]">

        {/* 스피너 */}
        <div className="relative w-24 h-24 shrink-0">
          {/* 바깥 링 */}
          <div className="absolute inset-0 rounded-full border border-[#00f0ff]/10" />
          {/* 회전 링 */}
          <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-[#00f0ff] animate-spin"
               style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.7))' }} />
          {/* 내부 아이콘 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="30" height="30" viewBox="0 0 24 24"
              fill="none" stroke="#00f0ff" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.9))' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
        </div>

        {/* 텍스트 */}
        <div className="flex flex-col gap-1.5">
          <div className="text-xl font-bold text-white tracking-wide">
            {PHASE_LABEL[phase]}
          </div>
          <div className="text-sm text-gray-400">
            {PHASE_SUB[phase]}
          </div>
        </div>

        {/* 진행 바 (recording 단계) */}
        {phase === 'recording' ? (
          <div className="w-full flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">렌더링 진행률</span>
              <span className="font-mono text-[#00f0ff]">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-[#1a1a22] rounded-full overflow-hidden border border-[#22222a]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #00a8cc, #00f0ff)',
                  boxShadow: '0 0 10px rgba(0,240,255,0.5)',
                }}
              />
            </div>
          </div>
        ) : (
          /* 점 애니메이션 (preparing / mixing) */
          <div className="flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#00f0ff]/70 animate-bounce"
                style={{
                  animationDelay: `${i * 0.18}s`,
                  boxShadow: '0 0 6px rgba(0,240,255,0.6)',
                }}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-600 leading-relaxed">
          Export 완료 시 자동으로 다운로드됩니다
          <br />
          (탭을 닫거나 이동하지 마세요)
        </p>
      </div>
    </div>
  );
}
