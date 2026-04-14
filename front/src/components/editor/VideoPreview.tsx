import React from 'react';

export function VideoPreview() {
  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden shrink-0 flex items-center justify-center">
      {/* Dummy Video Display (Image placeholder approximation) */}
      <div className="absolute inset-0 bg-[#000000]">
        <div className="w-full h-full opacity-60 flex items-center justify-center font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#b500ff]">
           [Video Placeholder: Cyber City]
        </div>
      </div>
      
      {/* Timecode overlay */}
      <div className="absolute bottom-6 right-6 bg-black/80 backdrop-blur-sm px-4 py-2 font-mono font-bold text-xl text-[#00f0ff] tracking-wider rounded shadow-[0_0_15px_rgba(0,240,255,0.2)] border border-[#00f0ff]/40">
        00:01:23:15
      </div>
    </div>
  );
}
