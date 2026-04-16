'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface WaveformData {
  /** 정규화된 피크 값 배열 (0~1 범위). 화면 너비에 맞게 다운샘플링됨 */
  peaks: number[];
  /** 원본 오디오 길이 (초) */
  duration: number;
}

interface UseAudioWaveformOptions {
  /** 오디오 파일 URL */
  src: string;
  /** 추출할 피크 샘플 수. 기본 200 */
  samplesCount?: number;
}

interface UseAudioWaveformResult {
  waveform: WaveformData | null;
  isLoading: boolean;
  error: string | null;
}

// ── 전역 캐시 (동일 src 재요청 방지) ──
const waveformCache = new Map<string, WaveformData>();

/**
 * 오디오 파일에서 웨이브폼 피크 데이터를 추출하는 훅
 *
 * Web Audio API (AudioContext + decodeAudioData)를 사용하여
 * 오디오를 디코딩하고, PCM 데이터를 다운샘플링하여 피크 배열을 생성합니다.
 */
export function useAudioWaveform({
  src,
  samplesCount = 200,
}: UseAudioWaveformOptions): UseAudioWaveformResult {
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const extract = useCallback(async () => {
    if (!src) return;

    // 캐시 확인
    const cached = waveformCache.get(src);
    if (cached) {
      setWaveform(cached);
      return;
    }

    abortRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      // 1. 오디오 파일 fetch
      const response = await fetch(src);
      if (!response.ok) throw new Error(`오디오 로드 실패: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      if (abortRef.current) return;

      // 2. AudioContext로 디코딩
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      await audioContext.close();

      if (abortRef.current) return;

      // 3. 피크 추출 (모든 채널의 절대값 최대)
      const peaks = extractPeaks(audioBuffer, samplesCount);

      const data: WaveformData = {
        peaks,
        duration: audioBuffer.duration,
      };

      // 캐시 저장
      waveformCache.set(src, data);
      setWaveform(data);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : '웨이브폼 추출 실패');
      }
    } finally {
      setIsLoading(false);
    }
  }, [src, samplesCount]);

  useEffect(() => {
    extract();
    return () => {
      abortRef.current = true;
    };
  }, [extract]);

  return { waveform, isLoading, error };
}

/**
 * AudioBuffer에서 다운샘플링된 피크 배열을 생성
 * 각 피크 = 해당 구간 내 모든 채널의 |샘플| 최대값
 */
function extractPeaks(audioBuffer: AudioBuffer, samplesCount: number): number[] {
  const channelCount = audioBuffer.numberOfChannels;
  const totalLength = audioBuffer.length;
  const blockSize = Math.floor(totalLength / samplesCount);

  // 모든 채널 데이터 가져오기
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  const peaks: number[] = [];
  let globalMax = 0;

  for (let i = 0; i < samplesCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalLength);
    let blockMax = 0;

    for (let j = start; j < end; j++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const absVal = Math.abs(channels[ch][j]);
        if (absVal > blockMax) blockMax = absVal;
      }
    }

    peaks.push(blockMax);
    if (blockMax > globalMax) globalMax = blockMax;
  }

  // 정규화 (0~1)
  if (globalMax > 0) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] /= globalMax;
    }
  }

  return peaks;
}

/**
 * 캐시 비우기 (필요 시 호출)
 */
export function clearWaveformCache() {
  waveformCache.clear();
}
