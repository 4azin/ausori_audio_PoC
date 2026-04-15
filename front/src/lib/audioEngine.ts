import type { Track } from '@/components/editor/daw/types';

interface ActiveSource {
  source: AudioBufferSourceNode;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sessionId = 0;
  private activeSources: ActiveSource[] = [];
  private bufferCache = new Map<string, AudioBuffer>();
  private loadingMap = new Map<string, Promise<AudioBuffer>>();

  // ── AudioContext 초기화 ──
  private async getCtx(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  // ── 오디오 버퍼 로드 (캐시) ──
  private fetchBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return Promise.resolve(cached);

    let p = this.loadingMap.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
          return r.arrayBuffer();
        })
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => {
          this.bufferCache.set(url, buf);
          this.loadingMap.delete(url);
          return buf;
        })
        .catch((err) => {
          this.loadingMap.delete(url);
          throw err;
        });
      this.loadingMap.set(url, p);
    }
    return p;
  }

  // ── 모든 재생 중인 소스 정지 ──
  stopAll() {
    this.sessionId++;
    for (const { source } of this.activeSources) {
      try {
        source.stop(0);
      } catch {
        // 이미 정지된 소스는 무시
      }
    }
    this.activeSources = [];
  }

  // ── 재생 시작 ──
  async play(
    tracks: Track[],
    soloTrackId: string | null,
    playheadTime: number
  ): Promise<void> {
    const ctx = await this.getCtx();
    this.stopAll();
    const session = ++this.sessionId;
    const now = ctx.currentTime;

    for (const main of tracks) {
      if (main.type !== 'audio') continue;

      const subs = main.subTracks ?? [];
      for (const sub of subs) {
        // 솔로 모드: 해당 서브 트랙만 재생
        if (soloTrackId !== null) {
          if (sub.id !== soloTrackId) continue;
        } else {
          // 일반 모드: 뮤트 체크
          if (main.mute || sub.mute) continue;
        }

        for (const clip of sub.clips) {
          if (!clip.audioSrc) continue;

          const clipEnd = clip.startTime + clip.duration;
          if (clipEnd <= playheadTime) continue; // 이미 지나간 클립

          // 클립 중간에서 시작하는 경우 오프셋 계산
          const alreadyPlayed = Math.max(0, playheadTime - clip.startTime);
          const sourceOffset = clip.sourceOffset + alreadyPlayed;
          const playDuration = clip.duration - alreadyPlayed;

          // AudioContext 기준 시작 시각 (미래 클립은 딜레이)
          const startAt = now + Math.max(0, clip.startTime - playheadTime);

          // 클로저 변수 캡처
          const srcUrl = clip.audioSrc;
          const subVol = sub.vol;
          const mainVol = main.vol;

          this.fetchBuffer(ctx, srcUrl)
            .then((buffer) => {
              if (session !== this.sessionId) return; // 세션 변경 시 무시

              const source = ctx.createBufferSource();
              source.buffer = buffer;

              // 서브 트랙 게인 (개별 볼륨)
              const subGain = ctx.createGain();
              subGain.gain.value = subVol;

              // 메인 트랙 게인 (그룹 볼륨 오버레이)
              const mainGain = ctx.createGain();
              mainGain.gain.value = mainVol;

              source.connect(subGain);
              subGain.connect(mainGain);
              mainGain.connect(ctx.destination);

              source.start(startAt, sourceOffset, playDuration);
              this.activeSources.push({ source });
            })
            .catch((err) =>
              console.warn('[AudioEngine] 로드 실패:', srcUrl, err)
            );
        }
      }
    }
  }

  // ── 소멸 ──
  destroy() {
    this.stopAll();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const audioEngine = new AudioEngine();
