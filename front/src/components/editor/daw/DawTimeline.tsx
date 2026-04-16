import React from 'react';
import { TimelineCanvas } from './TimelineCanvas';

export function DawTimeline() {
  return (
    <div className="flex flex-col flex-1 bg-[#0a0a0c] overflow-hidden min-h-[300px]">
      <TimelineCanvas />
    </div>
  );
}
