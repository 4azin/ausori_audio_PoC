'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useRouter } from 'next/navigation';

export function ProjectUploadModal() {
  const { isUploadModalOpen, closeUploadModal } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('영상을 분석하는 중입니다...');
  const router = useRouter();

  // Reset state when modal closes
  useEffect(() => {
    if (!isUploadModalOpen) {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
        setStatusText('영상을 분석하는 중입니다...');
      }, 300); // Wait for fade-out animation
    }
  }, [isUploadModalOpen]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Check if there's a file (though we ignore it for simulation)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsUploading(true);
    }
  }, []);

  useEffect(() => {
    if (isUploading) {
      const duration = 5000; // 5 seconds
      const interval = 50;
      const step = (interval / duration) * 100;

      const timer = setInterval(() => {
        setProgress((prev) => {
          const next = prev + step;
          if (next >= 100) {
            clearInterval(timer);
            return 100;
          }
          
          // Change status text based on progress
          if (next > 70) setStatusText('최종 결과 생성 중...');
          else if (next > 35) setStatusText('특징 추출 및 분석 중...');
          
          return next;
        });
      }, interval);

      // Navigate after completion
      const completionTimer = setTimeout(() => {
        closeUploadModal();
        // Short delay to allow modal to start closing before navigation
        setTimeout(() => {
            router.push('/editor');
        }, 300);
      }, duration + 500);

      return () => {
        clearInterval(timer);
        clearTimeout(completionTimer);
      };
    }
  }, [isUploading, closeUploadModal, router]);

  if (!isUploadModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300"
      onClick={closeUploadModal}
    >
      <div 
        className="relative w-full max-w-lg bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 transform scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#446bdf] to-transparent opacity-50" />

        {/* Close Button */}
        <button 
          onClick={closeUploadModal}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-all duration-200 z-10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="p-10">
          {!isUploading ? (
            <div className="text-center space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">새 프로젝트 생성</h2>
                <p className="text-gray-400 text-sm">작업을 시작할 영상 파일을 업로드 해주세요.</p>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-2xl p-14 transition-all duration-500 group
                  ${isDragging 
                    ? 'border-[#446bdf] bg-[#446bdf]/10 scale-[1.02] shadow-[0_0_30px_rgba(68,107,223,0.15)]' 
                    : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}
                `}
              >
                <div className="flex flex-col items-center gap-6">
                  <div className={`
                    w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500
                    ${isDragging ? 'bg-[#446bdf] text-white rotate-12 scale-110' : 'bg-[#252528] text-gray-400 group-hover:text-gray-300'}
                  `}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-semibold text-lg">파일을 이리로 드래그하세요</p>
                    <p className="text-sm text-gray-500 px-4">MP4, MOV, AVI 등 영상 파일 (최대 500MB)</p>
                  </div>
                  
                  <button className="mt-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg border border-white/10 transition-colors cursor-pointer">
                    파일 선택하기
                  </button>
                </div>
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setIsUploading(true);
                    }
                  }} 
                  accept="video/*"
                />
              </div>

              <p className="text-[11px] text-gray-600 uppercase tracking-widest font-bold">
                Supported formats: MP4, MOV, AVI, WEBM
              </p>
            </div>
          ) : (
            <div className="py-10 text-center space-y-10">
              <div className="space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                    {/* Pulsing background */}
                    <div className="absolute inset-0 bg-[#446bdf]/20 rounded-full animate-ping duration-[2000ms]"></div>
                    
                    {/* Main spinning outer ring */}
                    <div className="absolute inset-0 border-[3px] border-[#446bdf]/10 rounded-full shadow-[0_0_20px_rgba(68,107,223,0.1)]"></div>
                    <div className="absolute inset-0 border-[3px] border-[#446bdf] border-t-transparent rounded-full animate-spin duration-1000"></div>
                    
                    {/* Inner spinning ring (opposite direction) */}
                    <div className="absolute inset-4 border-[2px] border-[#446bdf]/40 border-b-transparent rounded-full animate-spin duration-[1500ms] [animation-direction:reverse]"></div>
                    
                    <div className="absolute inset-0 flex items-center justify-center text-[#446bdf]">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                            <path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>
                        </svg>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-white tracking-tight animate-pulse">{statusText}</h3>
                    <p className="text-gray-400 text-sm max-w-[280px] mx-auto">AI가 영상의 구도를 분석하고 오디오 트랙을 추출하고 있습니다.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-sm mx-auto">
                <div className="relative h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                        className="h-full bg-gradient-to-r from-[#446bdf] via-[#6384e6] to-[#446bdf] transition-all duration-300 ease-out shadow-[0_0_15px_rgba(68,107,223,0.6)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-[#446bdf] uppercase tracking-[0.2em]">Analyzing...</span>
                    <span className="text-sm font-mono font-bold text-white">{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
