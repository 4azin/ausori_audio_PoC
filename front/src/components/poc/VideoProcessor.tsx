'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import styles from './poc.module.css';

interface VideoProcessorProps {
  videoFile: File | null;
  audioFile: File | null;
}

export default function VideoProcessor({ videoFile, audioFile }: VideoProcessorProps) {
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('기다리는 중...');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const ffmpegRef = useRef(new FFmpeg());

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        setStatus('FFmpeg 라이브러리 로드 중...');
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        const ffmpeg = ffmpegRef.current;
        
        ffmpeg.on('log', ({ message }) => {
          console.log(message);
        });

        ffmpeg.on('progress', ({ progress }) => {
          setProgress(Math.round(progress * 100));
        });

        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        setLoaded(true);
        setStatus('준비 완료');
      } catch (err) {
        console.error('FFmpeg load error:', err);
        setError('FFmpeg 로드에 실패했습니다. 브라우저 설정을 확인해주세요.');
      }
    };

    loadFFmpeg();
  }, []);

  const processFiles = async () => {
    if (!videoFile || !audioFile) return;
    
    setProcessing(true);
    setProgress(0);
    setError(null);
    setResultUrl(null);
    setStatus('파일 처리 중...');

    try {
      const ffmpeg = ffmpegRef.current;
      
      // Write files to virtual FS
      setStatus('파일 업로드 중...');
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
      await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile));

      // FFmpeg command:
      // -i input.mp4 -i audio.mp3 -an -map 0:v -map 1:a -c:v copy -shortest output.mp4
      // -an: Remove original audio
      // -map 0:v: Take video from first input
      // -map 1:a: Take audio from second input
      // -c:v copy: Copy video stream without re-encoding (fast)
      // -shortest: Match duration of the shortest stream
      
      setStatus('병합 중...');
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-i', 'audio.mp3',
        '-an',
        '-map', '0:v',
        '-map', '1:a',
        '-c:v', 'copy',
        '-shortest',
        'output.mp4'
      ]);

      setStatus('결과 파일 생성 중...');
      const data = await ffmpeg.readFile('output.mp4');
      // any를 피하기 위해 Uint8Array로 캐스팅 후 Blob에 전달
      const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      setResultUrl(url);
      setStatus('병합 완료!');
    } catch (err) {
      console.error('Processing error:', err);
      setError('영상 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={styles.processorCard}>
      <div className={styles.statusText}>{status}</div>
      
      {processing && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.statusText}>{progress}% 처리됨</div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <button 
        className={styles.btnProcess}
        onClick={processFiles}
        disabled={!loaded || processing || !videoFile || !audioFile}
      >
        {!loaded ? '라이브러리 로딩 중...' : processing ? '처리 중...' : '영상/음성 병합하기'}
      </button>

      {resultUrl && (
        <div className={styles.resultArea}>
          <div className="text-green-400 font-bold">✨ 성공적으로 병합되었습니다!</div>
          <video src={resultUrl} controls className="w-full rounded-lg shadow-lg max-h-[300px]" />
          <a 
            href={resultUrl} 
            download="output.mp4" 
            className={styles.btnDownload}
          >
            📥 결과 영상 다운로드
          </a>
        </div>
      )}
    </div>
  );
}
