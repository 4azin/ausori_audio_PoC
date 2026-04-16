interface ProjectCardProps {
  title: string;
  filesCount: number;
}

import Link from 'next/link';

export function ProjectCard({ title, filesCount }: ProjectCardProps) {
  return (
    <Link href="/editor" className="flex flex-col gap-3 group cursor-pointer w-[300px]">
      <div className="bg-[#242424] rounded-2xl p-4 border border-border group-hover:border-gray-500 transition-colors h-[210px] flex flex-col justify-center">
        {/* Thumbnails grid */}
        <div className="grid grid-cols-2 gap-3 h-full">
          <div className="bg-[#3a3a3a] rounded-xl shadow-sm w-full h-full relative overflow-hidden flex items-center justify-center">
            {/* Mock content representation */}
            <div className="w-16 h-10 bg-[#4f4f4f] rounded-md"></div>
          </div>
          <div className="bg-[#w] bg-[#3a3a3a] rounded-xl shadow-sm w-full h-full relative overflow-hidden flex items-center justify-center">
             <div className="w-16 h-10 bg-[#4f4f4f] rounded-md"></div>
          </div>
          <div className="bg-[#3a3a3a] rounded-xl shadow-sm w-full h-full relative overflow-hidden flex items-center justify-center">
             <div className="w-16 h-10 bg-[#4f4f4f] rounded-md"></div>
          </div>
          <div className="bg-[#2c2c2c] rounded-xl shadow-sm w-full h-full border border-dashed border-gray-600 flex items-center justify-center text-xs text-gray-500">
             + More
          </div>
        </div>
      </div>
      <div className="px-1 mt-1">
        <h3 className="text-[15px] font-medium text-[#f0f0f0]">{title}</h3>
        <p className="text-xs text-gray-400 mt-1">{filesCount} files</p>
      </div>
    </Link>
  );
}
