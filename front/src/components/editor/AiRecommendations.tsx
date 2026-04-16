import React from 'react';
import { Button } from '../ui/Button';

export function AiRecommendations() {
  const recommendations = [
    { id: 1, title: 'neon_city_ambience.wav', duration: '0.8s', type: 'STEREO', sampleRate: '48kHz', match: 92, active: true },
    { id: 2, title: 'cyber_step_02.wav', duration: '0.9s', type: 'MONO', sampleRate: '48kHz', match: 88, active: false },
    { id: 3, title: 'synth_sweep_01.wav', duration: '0.7s', type: 'STEREO', sampleRate: '48kHz', match: 85, active: false },
  ];

  return (
    <div className="flex-1 flex flex-col w-full h-full md:border-none">
      <div className="flex items-center justify-between p-5 border-b border-[#22222a]">
        <h2 className="font-bold text-sm tracking-wider uppercase text-gray-300">AI Recommendations</h2>
        <span className="text-[10px] font-bold bg-[#b500ff] text-white px-2 py-0.5 rounded tracking-wide shadow-[0_0_8px_rgba(181,0,255,0.6)]">3 MATCHES</span>
      </div>
      
      <div className="p-5 flex flex-col gap-4 overflow-y-auto">
        {recommendations.map(rec => (
          <div 
            key={rec.id} 
            className={`flex items-center p-3 rounded bg-[#1a1a20] shadow-sm border transition-shadow ${rec.active ? 'border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'border-[#2a2a35]'}`}
          >
            <div className={`w-10 h-10 rounded flex items-center justify-center mr-4 shrink-0 transition-colors cursor-pointer ${rec.active ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'bg-[#25252b] text-gray-400 hover:bg-[#2a2a35] hover:text-gray-200'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className={`font-bold text-[14px] leading-tight ${rec.active ? 'text-[#00f0ff]' : 'text-gray-200'}`}>{rec.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rec.active ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50' : 'bg-[#25252b] text-gray-500'}`}>
                  {rec.match}% MATCH
                </span>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{rec.duration}</span>
                <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                <span className={rec.active ? 'text-[#b500ff]' : ''}>{rec.type}</span>
                <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                <span>{rec.sampleRate}</span>
              </div>
            </div>
            
            <div className="ml-4 flex items-center shrink-0 w-[55px] justify-end">
              {rec.active ? (
                <span className="text-[10px] font-black text-[#00f0ff] tracking-wider drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">ACTIVE</span>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-[10px] px-3 font-bold border-[#2a2a35] text-gray-400 hover:border-[#b500ff] hover:text-[#b500ff] hover:bg-[#b500ff]/10">
                  SWAP
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-auto p-4 border-t border-[#22222a] text-center text-xs text-gray-600 italic">
        Click a track event to see alternatives
      </div>
    </div>
  );
}
