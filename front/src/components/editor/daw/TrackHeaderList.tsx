import React, { useState } from 'react';
import { TrackHeader, TrackInfo } from './TrackHeader';

export function TrackHeaderList() {
  const [expandedTracks, setExpandedTracks] = useState<Record<string | number, boolean>>({});

  const toggleExpand = (id: string | number) => {
    setExpandedTracks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const tracks: TrackInfo[] = [
    { id: 0, name: 'Video', io: '비디오 분석 후 추가 예정', type: 'video' },
    {
      id: 1, name: 'DLG', io: 'Stereo Mix', type: 'audio',
      subTracks: [
        { id: '1-1', name: 'dlg_scene1', io: 'Stereo Mix', type: 'audio' },
        { id: '1-2', name: 'dlg_scene2', io: 'Stereo Mix', type: 'audio' }
      ]
    },
    {
      id: 2, name: 'Music', io: 'Stereo Mix', type: 'audio',
      subTracks: [
        { id: '2-1', name: 'bgm_main_loop', io: 'Stereo Mix', type: 'audio' }
      ]
    },
    {
      id: 3, name: 'AMB', io: 'Stereo Mix', type: 'audio',
      subTracks: [
        { id: '3-1', name: 'neon_city_rain', io: 'Stereo Mix', type: 'audio' },
        { id: '3-2', name: 'distant_traffic', io: 'Stereo Mix', type: 'audio' }
      ]
    },
    {
      id: 4, name: 'Foley', io: 'Input 1-2', type: 'audio',
      subTracks: [
        { id: '4-1', name: 'footsteps', io: 'Input 1-2', type: 'audio' }
      ]
    },
    {
      id: 5, name: 'SFX', io: 'Aux 5-6', type: 'audio',
      subTracks: [
        { id: '5-1', name: 'laser_shot', io: 'Aux 5-6', type: 'audio' },
        { id: '5-2', name: 'explosion', io: 'Aux 5-6', type: 'audio' }
      ]
    },
    {
      id: 6, name: 'Cinematic', io: 'Aux 7-8', type: 'audio',
      subTracks: [
        { id: '6-1', name: 'impact_boom', io: 'Aux 7-8', type: 'audio' }
      ]
    },
  ];

  return (
    <div className="w-[280px] bg-[#121215] border-r border-[#22222a] flex flex-col shrink-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.6)]">
      {tracks.map((track) => (
        <React.Fragment key={track.id}>
          <TrackHeader
            track={track}
            isExpanded={expandedTracks[track.id]}
            onToggleExpand={() => toggleExpand(track.id)}
          />
          {expandedTracks[track.id] && (
            <>
              {track.subTracks && track.subTracks.map(subTrack => (
                <TrackHeader
                  key={subTrack.id}
                  track={subTrack}
                  isSubTrack={true}
                />
              ))}
              {/* Add Sub-track Button */}
              <div className="h-24 border-b border-[#22222a] bg-[#0a0a0c] pl-6 flex items-center group cursor-pointer hover:bg-[#121215] transition-colors">
                <div className="flex items-center gap-3 text-gray-500 group-hover:text-[#00f0ff] transition-colors">
                  <div className="w-8 h-8 rounded-full border border-dashed border-gray-700 flex items-center justify-center group-hover:border-[#00f0ff] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">Add Track</span>
                </div>
              </div>
            </>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
