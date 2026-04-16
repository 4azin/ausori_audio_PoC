'use client';

import React, { useState } from 'react';
import FileDropzone from '@/components/poc/FileDropzone';
import VideoProcessor from '@/components/poc/VideoProcessor';
import styles from '@/components/poc/poc.module.css';

export default function PocPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  return (
    <main className="min-h-screen bg-[#0a0a0c] py-12 px-4">
      <div className={styles.container}>
        <header className="mb-8 text-center">
          <h1 className={styles.title}>Audio/Video Merger PoC</h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            브라우저 내에서 직접 영상의 오디오를 제거하고 새로운 음성을 합성합니다.
            서버로 파일이 전송되지 않아 빠르고 안전하며, 500MB 이하의 영상까지 지원합니다.
          </p>
        </header>

        <section className={styles.dropzoneGroup}>
          <FileDropzone 
            label="영상 파일 (MP4, MKV 등)"
            accept="video/*"
            onFileSelect={setVideoFile}
            maxSizeMB={500}
          />
          <FileDropzone 
            label="음성 파일 (MP3, WAV 등)"
            accept="audio/*"
            onFileSelect={setAudioFile}
            maxSizeMB={50}
          />
        </section>

        <VideoProcessor 
          videoFile={videoFile}
          audioFile={audioFile}
        />

        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>© 2024 Autio Mok Project - Built with FFmpeg.wasm</p>
        </footer>
      </div>
    </main>
  );
}
