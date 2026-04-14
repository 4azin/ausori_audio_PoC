import { TopNav } from '@/components/layout/TopNav';
import { ProjectGrid } from '@/components/projects/ProjectGrid';

export default function ProjectsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#1c1c1c]">
      <TopNav />
      <main className="flex-1 px-8 py-10 max-w-[1400px] mx-auto w-full">
        <ProjectGrid />
      </main>
      
      {/* Help icon at bottom right */}
      <div className="fixed bottom-6 right-6 w-9 h-9 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-full flex items-center justify-center cursor-pointer text-gray-400 border border-border shadow-lg transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <path d="M12 17h.01"/>
        </svg>
      </div>
    </div>
  );
}
