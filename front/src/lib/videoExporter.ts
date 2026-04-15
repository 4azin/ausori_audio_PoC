import type { Track } from '@/components/editor/daw/types';

export type ExportPhase = 'preparing' | 'mixing' | 'recording';

export interface ExportOptions {
  tracks: Track[];
  soloTrackId: string | null;
  videoSrc: string;
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
async function fetchBuffer(
  ctx: BaseAudioContext,
  url: string,
  cache: Map<string, AudioBuffer>
): Promise<AudioBuffer> {
  const cached = cache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`오디오 로드 실패 (${res.status}): ${url}`);
  const ab = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(ab);
  cache.set(url, buf);
  return buf;
}

// ── 화면 밖에 숨긴 video 엘리먼트 생성 ──
function createHiddenVideo(src: string, muted: boolean): HTMLVideoElement {
  const v = document.createElement('video');
  v.src = src;
  v.muted = muted;
  v.preload = 'auto';
  v.playsInline = true;
  Object.assign(v.style, {
    position: 'fixed',
    top: '-9999px',
    left: '-9999px',
    width: '1px',
    height: '1px',
    pointerEvents: 'none',
    opacity: '0',
  });
  document.body.appendChild(v);
  return v;
}

// ── 비디오 재생 준비 대기 ──
function waitForCanPlay(v: HTMLVideoElement): Promise<void> {
  if (v.readyState >= 3) return Promise.resolve();
  return new Promise((resolve, reject) => {
    v.oncanplaythrough = () => resolve();
    v.onerror = () => reject(new Error('비디오 로드 오류'));
    v.load();
  });
}

// ────────────────────────────────────────────────
// 메인 export 함수
// ────────────────────────────────────────────────
export async function exportVideo(
  { tracks, soloTrackId, videoSrc }: ExportOptions,
  onPhase: (phase: ExportPhase, progress?: number) => void
): Promise<void> {

  // ── Phase 1: 준비 ──
  onPhase('preparing');

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

  // 필요한 오디오 URL 수집
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
    2, // 스테레오
    Math.ceil(videoDuration * SAMPLE_RATE),
    SAMPLE_RATE
  );

  // 버퍼 사전 로드 (병렬)
  const bufferCache = new Map<string, AudioBuffer>();
  await Promise.all(
    [...audioUrls].map((url) => fetchBuffer(offlineCtx, url, bufferCache))
  );

  // 클립 스케줄링
  for (const { sub, main } of playablePairs) {
    for (const clip of sub.clips) {
      if (!clip.audioSrc) continue;
      if (clip.startTime >= videoDuration) continue; // 영상 밖 클립

      const buf = bufferCache.get(clip.audioSrc);
      if (!buf) continue;

      // 영상 길이를 넘지 않도록 클램핑
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

  // 오프라인 렌더링 (실시간보다 훨씬 빠름)
  const mixedBuffer = await offlineCtx.startRendering();

  // ── Phase 3: 영상 캡처 & 녹화 ──
  onPhase('recording', 0);

  // 영상 프레임 캡처용 video (음소거)
  const videoFrameEl = createHiddenVideo(videoSrc, true);
  await waitForCanPlay(videoFrameEl);

  const captureStreamFn =
    (videoFrameEl as any).captureStream?.bind(videoFrameEl) ??
    (videoFrameEl as any).mozCaptureStream?.bind(videoFrameEl);

  if (!captureStreamFn) {
    document.body.removeChild(videoFrameEl);
    throw new Error('captureStream() 이 이 브라우저에서 지원되지 않습니다.');
  }

  const capturedStream: MediaStream = captureStreamFn();

  // 오디오 출력 AudioContext 설정
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const audioDest = audioCtx.createMediaStreamDestination();

  // DAW 믹싱된 오디오 소스
  const mixedSource = audioCtx.createBufferSource();
  mixedSource.buffer = mixedBuffer;
  mixedSource.connect(audioDest);

  // 비디오 원본 오디오 (비디오 트랙이 mute가 아니고 solo도 아닐 때)
  const videoTrackData = tracks.find((t) => t.type === 'video');
  const includeVideoAudio =
    !!videoTrackData &&
    !videoTrackData.mute &&
    (soloTrackId === null || soloTrackId === videoTrackData.id);

  let videoAudioEl: HTMLVideoElement | null = null;
  if (includeVideoAudio && videoTrackData) {
    videoAudioEl = createHiddenVideo(videoSrc, false);
    await waitForCanPlay(videoAudioEl);
    const videoAudioSrc = audioCtx.createMediaElementSource(videoAudioEl);
    const videoGain = audioCtx.createGain();
    videoGain.gain.value = Math.min(1, Math.max(0, videoTrackData.vol));
    videoAudioSrc.connect(videoGain);
    videoGain.connect(audioDest);
  }

  // 최종 스트림: 비디오 트랙 + 믹싱된 오디오 트랙
  const videoTracks = capturedStream.getVideoTracks();
  const audioTracks = audioDest.stream.getAudioTracks();
  const combinedStream = new MediaStream([...videoTracks, ...audioTracks]);

  // MediaRecorder 설정
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : '';

  const recorder = new MediaRecorder(
    combinedStream,
    mimeType ? { mimeType } : undefined
  );

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(250);

  // 오디오와 비디오 동기화 시작
  // AudioContext 기준으로 300ms 뒤에 시작을 예약
  const startAt = audioCtx.currentTime + 0.3;
  mixedSource.start(startAt);

  // 예약 시각까지 대기한 뒤 비디오 재생
  const waitMs = Math.max(0, (startAt - audioCtx.currentTime) * 1000);
  await new Promise<void>((r) => setTimeout(r, waitMs));

  videoFrameEl.play();
  if (videoAudioEl) videoAudioEl.play();

  // 진행률 업데이트
  const progressInterval = setInterval(() => {
    if (videoFrameEl.duration) {
      onPhase('recording', videoFrameEl.currentTime / videoFrameEl.duration);
    }
  }, 300);

  // 영상 종료 대기 (안전 타임아웃 포함)
  await new Promise<void>((resolve) => {
    videoFrameEl.addEventListener('ended', () => resolve(), { once: true });
    setTimeout(() => resolve(), (videoDuration + 5) * 1000);
  });

  clearInterval(progressInterval);
  onPhase('recording', 1);
  recorder.stop();
  await recordingDone;

  // 정리
  document.body.removeChild(videoFrameEl);
  if (videoAudioEl) document.body.removeChild(videoAudioEl);
  audioCtx.close();

  // 파일 다운로드
  const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sonicflow_export.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
