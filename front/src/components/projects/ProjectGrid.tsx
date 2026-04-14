import { ProjectCard } from './ProjectCard';

export function ProjectGrid() {
  const projects = [
    { id: 1, title: '특화프로젝트', filesCount: 3 },
    { id: 2, title: '공통프로젝트', filesCount: 7 },
  ];

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-end items-center mb-8">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <button className="flex items-center gap-1 hover:text-white transition-colors bg-transparent border-none">
            Last modified
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          
          <div className="flex items-center gap-1 border-l border-border pl-4">
            <button className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="p-1.5 rounded bg-[#333] text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-10">
        {projects.map((proj) => (
          <ProjectCard key={proj.id} title={proj.title} filesCount={proj.filesCount} />
        ))}
      </div>
      
      {/* Education banner mock */}
      <div className="w-full mt-12 bg-[#3b416a] rounded-md p-3.5 text-sm text-[#e2e8fa] flex items-center gap-3 border border-transparent shadow shadow-[#3b416a]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
        This team is for Education users only. New users will be required to verify their Education status. <span className="underline cursor-pointer opacity-80 hover:opacity-100">Learn more...</span>
      </div>
    </div>
  );
}
