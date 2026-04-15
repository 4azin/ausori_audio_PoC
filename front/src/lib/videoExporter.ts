import type { Track } from '@/components/editor/daw/types';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export type ExportPhase = 'preparing' | 'mixing' | 'encoding';

export interface ExportOptions {
  tracks: Track[];
  soloTrackId: string | null;
  videoSrc: string;
}

// ── AudioBuffer → 16-bit PCM WAV Blob ──
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;

  const dataLength = length * numChannels * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                                      // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

// ── 비디오 길이 가져오기 ──
function getVideoDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = src;
    v.onloadedmetadata = () => resolve(v.duration);
    v.onerror = () => reject(new Error('비디오 메타데이터 로드 실패'));
  });
}

// ── 오디오 버퍼 fetch + decode ──
async function fetchAudioBuffer(
  ctx: BaseAudioContext,
  url: string,
  cache: Map<string, AudioBuffer>
): Promise<AudioBuffer> {
  const cached = cache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`오디오 로드 실패 (${res.status}): ${url}`);
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  cache.set(url, buf);
  return buf;
}

// ────────────────────────────────────────────────
// 메인 export 함수
// ────────────────────────────────────────────────
export async function exportVideo(
  { tracks, soloTrackId, videoSrc }: ExportOptions,
  onPhase: (phase: ExportPhase, progress?: number) => void
): Promise<void> {

  // ── Phase 1: 준비 (ffmpeg.wasm 로드 + 비디오 메타데이터) ──
  onPhase('preparing');

  const ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => {
    onPhase('encoding', Math.min(1, Math.max(0, progress)));
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  const videoDuration = await getVideoDuration(videoSrc);

  // 재생할 서브트랙 쌍 결정 (audioEngine 과 동일 로직)
  const playablePairs: Array<{ sub: Track; main: Track }> = [];
  for (const main of tracks) {
    if (main.type !== 'audio') continue;
    for (const sub of main.subTracks ?? []) {
      if (soloTrackId !== null) {
        if (sub.id === soloTrackId) playablePairs.push({ sub, main });
      } else {
        if (!main.mute && !sub.mute) playablePairs.push({ sub, main });
      }
    }
  }

  const audioUrls = new Set<string>();
  for (const { sub } of playablePairs) {
    for (const clip of sub.clips) {
      if (clip.audioSrc) audioUrls.add(clip.audioSrc);
    }
  }

  // ── Phase 2: 오디오 오프라인 믹싱 ──
  onPhase('mixing');

  const SAMPLE_RATE = 48000;
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(videoDuration * SAMPLE_RATE),
    SAMPLE_RATE
  );

  const bufferCache = new Map<string, AudioBuffer>();
  await Promise.all([...audioUrls].map((url) => fetchAudioBuffer(offlineCtx, url, bufferCache)));

  for (const { sub, main } of playablePairs) {
    for (const clip of sub.clips) {
      if (!clip.audioSrc) continue;
      if (clip.startTime >= videoDuration) continue;

      const buf = bufferCache.get(clip.audioSrc);
      if (!buf) continue;

      const effectiveDuration = Math.min(clip.duration, videoDuration - clip.startTime);

      const source = offlineCtx.createBufferSource();
      source.buffer = buf;

      const subGain = offlineCtx.createGain();
      subGain.gain.value = sub.vol;

      const mainGain = offlineCtx.createGain();
      mainGain.gain.value = main.vol;

      source.connect(subGain);
      subGain.connect(mainGain);
      mainGain.connect(offlineCtx.destination);

      source.start(clip.startTime, clip.sourceOffset, effectiveDuration);
    }
  }

  const mixedBuffer = await offlineCtx.startRendering();
  const wavBlob = audioBufferToWav(mixedBuffer);

  // ── Phase 3: ffmpeg 인코딩 ──
  onPhase('encoding', 0);

  // 파일을 ffmpeg 가상 FS에 쓰기
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoSrc));
  await ffmpeg.writeFile('mixed.wav', await fetchFile(wavBlob));

  // 비디오 원본 오디오 포함 여부
  const videoTrackData = tracks.find((t) => t.type === 'video');
  const includeVideoAudio =
    !!videoTrackData &&
    !videoTrackData.mute &&
    (soloTrackId === null || soloTrackId === videoTrackData.id);

  let ffmpegArgs: string[];

  if (includeVideoAudio && videoTrackData) {
    // 원본 영상 오디오(vol 적용) + DAW 믹싱 오디오를 amix로 합성
    const vol = Math.min(1, Math.max(0, videoTrackData.vol)).toFixed(4);
    ffmpegArgs = [
      '-i', 'input.mp4',
      '-i', 'mixed.wav',
      '-filter_complex',
      `[0:a]volume=${vol}[va];[va][1:a]amix=inputs=2:duration=first[outa]`,
      '-map', '0:v',
      '-map', '[outa]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      'output.mp4',
    ];
  } else {
    // DAW 믹싱 오디오만 사용 (원본 영상 오디오 제거)
    ffmpegArgs = [
      '-i', 'input.mp4',
      '-i', 'mixed.wav',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      'output.mp4',
    ];
  }

  await ffmpeg.exec(ffmpegArgs);
  onPhase('encoding', 1);

  // 결과 MP4 다운로드
  const outputData = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sonicflow_export.mp4';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
