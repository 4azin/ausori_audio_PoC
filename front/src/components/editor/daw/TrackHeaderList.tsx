import React from 'react';
import { TrackHeader } from './TrackHeader';
import { useTimelineStore } from '@/stores/useTimelineStore';

export function TrackHeaderList() {
  const tracks = useTimelineStore((s) => s.tracks);
  const expandedTrackIds = useTimelineStore((s) => s.expandedTrackIds);
  const toggleTrackExpansion = useTimelineStore((s) => s.toggleTrackExpansion);

  return (
    <div data-track-header className="w-[280px] bg-[#121215] border-r border-[#22222a] flex flex-col shrink-0 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.6)]">
      {tracks.map((track) => {
        const isExpanded = !!expandedTrackIds[track.id];
        const hasSubTracks = track.subTracks && track.subTracks.length > 0;

        return (
          <React.Fragment key={track.id}>
            {/* 메인 카테고리 트랙 */}
            <TrackHeader
              track={track}
              isExpanded={isExpanded}
              onToggleExpand={hasSubTracks ? () => toggleTrackExpansion(track.id) : undefined}
            />

            {/* 펼쳐졌을 경우 서브 트랙들 렌더링 */}
            {isExpanded && hasSubTracks && track.subTracks!.map(subTrack => (
              <TrackHeader
                key={subTrack.id}
                track={subTrack}
                isSubTrack={true}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
}
