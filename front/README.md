# SonicFlow AI — Front-end 기술 문서

브라우저 기반 AI 오디오·영상 편집기. DAW 타임라인 + 실시간 오디오 재생 + MP4 익스포트를 모두 클라이언트에서 처리한다.

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [Pages (라우트)](#3-pages-라우트)
4. [전역 상태 — useTimelineStore](#4-전역-상태--usetimelinestore)
5. [Custom Hooks](#5-custom-hooks)
6. [핵심 라이브러리 (src/lib)](#6-핵심-라이브러리-srclib)
7. [컴포넌트 구조](#7-컴포넌트-구조)
8. [Editor 구현 상세](#8-editor-구현-상세)
9. [오디오 재생 — 설계 & 최적화](#9-오디오-재생--설계--최적화)
10. [MP4 익스포트 — 설계 & 최적화](#10-mp4-익스포트--설계--최적화)
11. [개발 서버 실행](#11-개발-서버-실행)

---

## 1. 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) + React 18 |
| 언어 | TypeScript |
| 상태 관리 | Zustand |
| 캔버스 렌더링 | React Konva (HTML5 Canvas) |
| 오디오 | Web Audio API (AudioContext, OfflineAudioContext) |
| 영상 인코딩 | FFmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/util`) |
| 스타일 | Tailwind CSS |
| 빌드 최적화 | React Compiler (`reactCompiler: true`) |

---

## 2. 프로젝트 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── layout.tsx
│   ├── page.tsx            # → /login 리다이렉트
│   ├── login/
│   ├── projects/
│   ├── editor/
│   └── poc/
├── components/
│   ├── auth/               # 로그인 폼
│   ├── layout/             # TopNav
│   ├── projects/           # ProjectGrid, ProjectCard
│   ├── editor/             # 에디터 UI + DAW 컴포넌트
│   │   └── daw/
│   │       ├── layers/     # Konva 레이어 (Ruler, Grid, Playhead, Content)
│   │       └── tracks/     # Clip, Waveform, VideoFrameStrip
│   ├── poc/                # ffmpeg.wasm PoC 컴포넌트
│   └── ui/                 # Button, Input 공용 컴포넌트
├── hooks/                  # Custom React Hooks
├── stores/                 # Zustand 스토어
└── lib/                    # 순수 로직 (audioEngine, videoExporter, API)
    └── api/
        ├── client.ts
        ├── services/       # auth, projects, sounds API
        └── mock/           # 개발용 Mock 데이터
```

---

## 3. Pages (라우트)

| 경로 | 파일 | 역할 |
|------|------|------|
| `/` | `app/page.tsx` | `/login` 리다이렉트 |
| `/login` | `app/login/page.tsx` | 이메일/OAuth 로그인 |
| `/projects` | `app/projects/page.tsx` | 프로젝트 목록 |
| `/editor` | `app/editor/page.tsx` | 메인 DAW 에디터 |
| `/poc` | `app/poc/page.tsx` | ffmpeg.wasm 오디오 교체 PoC |

---

## 4. 전역 상태 — useTimelineStore

`src/stores/useTimelineStore.ts` — Zustand 스토어. 에디터 전체의 단일 진실 공급원(Single Source of Truth).

### State 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `tracks` | `Track[]` | 트랙 목록 (video + audio 메인 트랙, 각 메인 트랙은 `subTracks` 배열 보유) |
| `playheadTime` | `number` | 현재 재생 위치 (초) |
| `isPlaying` | `boolean` | 재생 중 여부 |
| `pixelsPerSecond` | `number` | 줌 레벨 (기본 66.67 px/s) |
| `scrollX` | `number` | 타임라인 수평 스크롤 오프셋 |
| `duration` | `number` | 타임라인 전체 길이 (초) |
| `soloTrackId` | `string \| null` | 현재 솔로 중인 서브트랙 ID |
| `trackHeight` | `number` | 트랙 행 높이 (px) |
| `expandedTrackIds` | `Record<string, boolean>` | 서브트랙 펼침 상태 |
| `videoSeekFn` | `((t: number) => void) \| null` | VideoPreview가 등록하는 시크 콜백 |
| `audioSeekFn` | `((t: number) => void) \| null` | useAudioEngine이 등록하는 시크 콜백 |

### 주요 Actions

```typescript
setPlayheadTime(time: number)         // 플레이헤드 이동
setIsPlaying(playing: boolean)         // 재생/정지
setPixelsPerSecond(pps: number)        // 줌 변경
setScrollX(x: number)                  // 수평 스크롤
setSoloTrack(trackId: string)          // 솔로 토글 (자동 언뮤트)
toggleTrackMute(trackId: string)       // 뮤트 토글 (서브트랙 동기화)
setTrackVol(trackId, vol)              // 볼륨 0~2 (1=0dB)
setTrackPan(trackId, pan)              // 팬 -1(L)~1(R)
moveClip(trackId, clipId, startTime)   // 클립 이동
trimClipLeft(trackId, clipId, delta)   // 좌측 트림 (sourceOffset 연동)
trimClipRight(trackId, clipId, newDuration) // 우측 트림
toggleTrackExpansion(trackId)          // 서브트랙 펼침/접힘
registerVideoSeek(fn)                  // VideoPreview 시크 콜백 등록
registerAudioSeek(fn)                  // AudioEngine 시크 콜백 등록
```

### 유틸리티

```typescript
getVisibleTracks(state): Track[]
// 펼쳐진 서브트랙 포함한 평탄화 목록 반환 (TrackHeaderList 등에서 사용)
```

---

## 5. Custom Hooks

### `useAudioEngine` — `src/hooks/useAudioEngine.ts`

오디오 재생 엔진을 스토어 상태에 연결하는 훅. `EditorPage`에서 딱 한 번만 호출한다.

```typescript
useAudioEngine(): void
```

**동작 방식:**
- `isPlaying` 변화 감지 → `audioEngine.play(tracks, soloTrackId, playheadTime)` 또는 `audioEngine.stopAll()` 호출
- `registerAudioSeek` 콜백 등록 → 수동 시크(타임라인 클릭, Transport 버튼)에서만 오디오 재시작 (RAF 틱에서는 호출 안 함)
- 언마운트 시 `audioEngine.destroy()` 호출

**Ref 패턴 사용 이유:**
```typescript
// isPlaying, tracks, soloTrackId, playheadTime 모두 ref로 감싸서 클로저 내부에서 최신값 참조
const isPlayingRef = useRef(isPlaying);
useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
```
→ useEffect 클로저가 stale closure가 되는 문제 방지.

---

### `useAudioWaveform` — `src/hooks/useAudioWaveform.ts`

오디오 파일 URL에서 파형 피크 데이터를 추출한다.

```typescript
useAudioWaveform({ src: string, samplesCount: number })
  → { waveform: number[], isLoading: boolean, error: string | null }
```

- Web Audio API `decodeAudioData`로 PCM 샘플 추출
- `extractPeaks(buffer, count)`: 오디오 버퍼를 `count`개 구간으로 나눠 절댓값 최댓값 → 0~1 정규화
- 전역 `Map` 캐시로 같은 URL 중복 추출 방지
- 동일 URL 동시 요청 시 Promise 재사용 (deduplicate)

---

### `useVideoFrames` — `src/hooks/useVideoFrames.ts`

영상에서 썸네일 프레임을 추출한다.

```typescript
useVideoFrames({ src, intervalSec, thumbWidth, thumbHeight })
  → { frames: HTMLImageElement[], duration: number, isLoading: boolean, error: string | null }
```

- 숨겨진 `<video>` 엘리먼트에 `currentTime`을 설정해 순차 시크 후 Canvas에 그려 `dataURL` 추출
- 추출된 dataURL을 `HTMLImageElement`로 변환 (Konva 호환)
- 줌 레벨에 따라 `intervalSec`을 동적으로 조정해 프레임 밀도 최적화

---

### `useTimelineWheel` — `src/hooks/useTimelineWheel.ts`

타임라인 마우스 휠 이벤트를 스크롤 또는 줌으로 변환한다.

```typescript
useTimelineWheel({ containerRef, keymap, canvasWidth }): void
```

- `resolveWheelAction(event, keymap)`: 수정키(Ctrl/Shift/Alt) 조합으로 액션 결정
- 기본 keymap: `Ctrl+Wheel` → 줌, `Wheel` → 수평 스크롤
- **포인터 앵커 줌**: 마우스 커서 위치를 기준점으로 `scrollX` 보정
  ```
  newScrollX = pointer_x_in_content * (newPps / oldPps) - pointer_x_on_screen
  ```

---

### `useSize` — `src/hooks/useSize.ts`

```typescript
useSize(ref: RefObject<HTMLElement>): { width: number, height: number }
```

`ResizeObserver`로 엘리먼트 크기 변화를 감지한다. Konva Stage 크기 동기화에 사용.

---

## 6. 핵심 라이브러리 (src/lib)

### `audioEngine` — `src/lib/audioEngine.ts`

Web Audio API 기반 싱글턴 오디오 재생 엔진.

```typescript
class AudioEngine {
  play(tracks, soloTrackId, playheadTime): Promise<void>
  stopAll(): void
  destroy(): void
}

export const audioEngine: AudioEngine  // 싱글턴
```

**신호 체인 (Signal Chain):**
```
AudioBufferSourceNode
  → GainNode (subGain, 서브트랙 개별 볼륨)
  → GainNode (mainGain, 메인 트랙 그룹 볼륨)
  → AudioContext.destination
```

**클립 스케줄링 계산:**
```typescript
const alreadyPlayed = playheadTime - clip.startTime;
const sourceOffset  = clip.sourceOffset + alreadyPlayed;
const playDuration  = clip.duration - alreadyPlayed;
const startAt       = audioCtx.currentTime + 0.05;  // 50ms 뒤 시작

source.start(startAt, sourceOffset, playDuration);
```

**세션 ID 패턴** — 비동기 버퍼 로드 중 stopAll()이 호출되면 이전 세션의 콜백을 무시:
```typescript
const sessionId = ++this.currentSession;
const buf = await this.fetchBuffer(url);
if (sessionId !== this.currentSession) return;  // stale → 무시
```

---

### `videoExporter` — `src/lib/videoExporter.ts`

DAW 오디오 믹싱 + ffmpeg.wasm 인코딩으로 MP4 파일을 생성한다.

```typescript
export type ExportPhase = 'preparing' | 'mixing' | 'encoding';

exportVideo(options: ExportOptions, onPhase: (phase, progress?) => void): Promise<void>
```

**내부 유틸:**
```typescript
audioBufferToWav(buffer: AudioBuffer): Blob   // AudioBuffer → 16-bit PCM WAV
getVideoDuration(src: string): Promise<number>
fetchAudioBuffer(ctx, url, cache): Promise<AudioBuffer>
```

---

### API 레이어 — `src/lib/api/`

```typescript
// client.ts — 공통 fetch 래퍼
apiClient<T>(path, options): Promise<T>
// NEXT_PUBLIC_API_BASE_URL 기반, credentials: 'include', JSON 응답 파싱

// services/auth.api.ts
authApi.login(req)          → User
authApi.logout()            → null
authApi.getMe()             → User

// services/projects.api.ts
projectsApi.getProjects(page, limit)  → { projects, ...pagination }
projectsApi.createProject(title)      → Project
projectsApi.loadProject(id)           → ProjectLoadResponse
projectsApi.saveProject(id, data)     → { id, version, createdAt }

// services/sounds.api.ts
soundsApi.getSounds(query)   → { sounds, ...pagination }
soundsApi.getCategories()    → SoundCategoryNode[]
```

`NEXT_PUBLIC_USE_MOCK_API=true` 환경 변수로 전체 API를 Mock 데이터로 대체 가능.

---

## 7. 컴포넌트 구조

### Editor 레이아웃

```
EditorPage
├── ExportOverlay (exporting 중에만 렌더)
├── EditorTopBar (Save / Export 버튼)
└── main
    ├── [Left]  DawTimeline
    │             ├── TrackHeaderList  (좌측 믹서 채널)
    │             └── TimelineCanvas   (Konva Stage)
    │                   ├── RulerLayer
    │                   ├── GridLayer
    │                   ├── TrackContentLayer
    │                   │     ├── VideoFrameStrip
    │                   │     ├── TrackOverview
    │                   │     └── AudioClip (+ WaveformDisplay)
    │                   └── PlayheadLayer
    └── [Right] VideoPreview
                AiRecommendations
    └── [Bottom] TransportBar
```

### DAW 컴포넌트 상세

| 컴포넌트 | 역할 |
|----------|------|
| `TimelineCanvas` | Konva Stage 오케스트레이터. 마우스 클릭/휠로 플레이헤드 이동 및 줌/스크롤 처리 |
| `TrackHeader` | 트랙 믹서 채널 UI. S/M 버튼, 볼륨(dB 표시), 팬(L/R/C) 슬라이더 |
| `AudioClip` | 드래그 이동 + 좌우 트림 핸들. 드래그 중 로컬 상태로 라이브 피드백, 마우스업 시 스토어 커밋 |
| `WaveformDisplay` | 파형을 위아래 대칭 폴리곤으로 렌더. 트림/소스 오프셋을 반영한 가시 범위 계산 |
| `VideoFrameStrip` | 줌 레벨 기반 동적 프레임 간격 조정. 로딩 중 회색 placeholder 표시 |
| `PlayheadLayer` | 드래그 가능한 빨간 수직선. 드래그 중 `setPlayheadTime` + `videoSeekFn` + `audioSeekFn` 호출 |
| `RulerLayer` | 줌에 따라 눈금 간격 자동 조정 (0.5s ~ 600s). Konva Text로 MM:SS 레이블 |

---

## 8. Editor 구현 상세

### 데이터 모델 (Track / Clip)

```typescript
interface Clip {
  id: string;
  startTime: number;     // 타임라인 상 시작 위치 (초)
  duration: number;      // 클립 재생 길이 (초)
  sourceOffset: number;  // 원본 오디오 파일 내 시작 오프셋 (초, 좌측 트림 값)
  audioSrc?: string;     // 오디오 파일 URL
}

interface Track {
  id: string;
  type: 'video' | 'audio';
  name: string;
  vol: number;           // 0~2 (1 = 0dB)
  pan: number;           // -1(L) ~ 1(R)
  mute: boolean;
  subTracks?: Track[];   // 메인 트랙만 보유 (그룹 구조)
  clips: Clip[];
}
```

**트랙 계층 구조:**
- **메인 트랙** (DLG, Music, AMB): 그룹 볼륨 조절. `vol`이 그룹 전체 게인 배율.
- **서브트랙**: 실제 클립 보유. `vol`이 개별 채널 게인.
- 신호 체인: `서브트랙 vol → 메인트랙 vol → output`

### 시크(Seek) 처리 흐름

플레이헤드 이동은 세 군데(트랜스포트 버튼, 타임라인 클릭, 플레이헤드 드래그)에서 발생하며 비디오와 오디오를 동기화한다:

```
사용자 입력 (클릭/드래그/버튼)
  │
  ├─ setPlayheadTime(time)       ← store 업데이트
  ├─ videoSeekFn?.(time)         ← <video>.currentTime 직접 조작
  └─ audioSeekFn?.(time)         ← 오디오 재시작 (재생 중일 때만)
```

RAF(requestAnimationFrame) 루프에서 발생하는 `setPlayheadTime` 호출은 `videoSeekFn`/`audioSeekFn`을 호출하지 **않는다** → 재생 중 불필요한 오디오 재시작 방지.

---

## 9. 오디오 재생 — 설계 & 최적화

### 구현 방식

Web Audio API의 `AudioContext`를 사용한 정밀 스케줄링 방식을 채택했다. HTML5 `<audio>` 태그 방식 대비 여러 클립을 샘플 정확도로 동기화할 수 있다.

### 핵심 최적화 1 — 오디오 버퍼 캐싱

```typescript
private bufferCache = new Map<string, AudioBuffer>();
private loadingMap  = new Map<string, Promise<AudioBuffer>>();

async fetchBuffer(url: string): Promise<AudioBuffer> {
  if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
  if (this.loadingMap.has(url))  return this.loadingMap.get(url)!;  // 중복 fetch 방지
  
  const promise = fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => this.getCtx().decodeAudioData(ab));
  
  this.loadingMap.set(url, promise);
  const buf = await promise;
  this.bufferCache.set(url, buf);
  this.loadingMap.delete(url);
  return buf;
}
```

- 같은 파일은 최초 1회만 fetch + decode
- 동시 다발 요청 시 Promise 재사용으로 중복 네트워크 요청 제거

### 핵심 최적화 2 — 세션 ID 패턴 (Race Condition 방지)

```typescript
private currentSession = 0;

async play(...) {
  const sessionId = ++this.currentSession;   // play() 호출마다 새 ID
  
  const buf = await this.fetchBuffer(url);   // 비동기 구간
  if (sessionId !== this.currentSession) return;  // stopAll()이 호출됐으면 무시
  
  // 실제 재생 예약
}

stopAll() {
  ++this.currentSession;   // 진행 중인 모든 play() 비동기 체인 무효화
  this.activeSources.forEach(s => s.stop());
}
```

빠르게 재생/정지/재생을 반복할 때 이전 `play()` 호출의 콜백이 늦게 도착해 소스가 중복 스케줄되는 버그를 방지한다.

### 핵심 최적화 3 — audioSeekFn 분리

`audioSeekFn`은 사용자 수동 시크에서만 호출된다:

```typescript
// TransportBar.tsx / TimelineCanvas.tsx (수동 시크) → audioSeekFn 호출 O
const seekTo = (time: number) => {
  setPlayheadTime(time);
  videoSeekFn?.(time);
  audioSeekFn?.(time);   // ← 오디오 재시작
};

// VideoPreview.tsx RAF 루프 (자동 틱) → audioSeekFn 호출 X
const tick = () => {
  setPlayheadTime(video.currentTime);   // ← audioSeekFn 없음
  rafRef.current = requestAnimationFrame(tick);
};
```

→ 재생 중 RAF가 60fps로 `setPlayheadTime`을 호출해도 오디오 엔진은 재시작하지 않는다.

### 특장점 요약

| 특성 | 내용 |
|------|------|
| 샘플 정확도 | `source.start(startAt, sourceOffset, duration)` API로 ms 이하 정밀도 |
| 다중 트랙 믹싱 | 트랙 수에 무관하게 단일 `AudioContext`에서 GainNode 체인으로 처리 |
| 중복 로딩 없음 | URL 기반 캐시 + Promise deduplicate |
| 경쟁 조건 없음 | 세션 ID로 stale 비동기 작업 무효화 |
| 메모리 안전 | 언마운트 시 `AudioContext.close()` |

---

## 10. MP4 익스포트 — 설계 & 최적화

### 구현 방식

ffmpeg.wasm (`@ffmpeg/ffmpeg`) 기반 클라이언트 사이드 인코딩. 서버로 파일이 전송되지 않는다.

### 파이프라인 3단계

```
Phase 1: preparing
  └─ ffmpeg.wasm 로드 (CDN, ~30MB, SharedArrayBuffer 필요)
  └─ 비디오 메타데이터 (duration) 추출
  └─ solo/mute 상태 기반 재생 대상 트랙 필터링

Phase 2: mixing
  └─ OfflineAudioContext (48kHz, 스테레오) 생성
  └─ 클립 병렬 로드 (Promise.all)
  └─ 클립별 GainNode 체인 스케줄링 (subGain → mainGain → destination)
  └─ offlineCtx.startRendering() → AudioBuffer
  └─ AudioBuffer → 16-bit PCM WAV Blob 변환 (audioBufferToWav)

Phase 3: encoding
  └─ input.mp4, mixed.wav → ffmpeg 가상 파일시스템에 쓰기
  └─ ffmpeg 명령 실행 → output.mp4
  └─ Blob URL로 다운로드
```

### OfflineAudioContext — 실시간보다 빠른 믹싱

```typescript
const offlineCtx = new OfflineAudioContext(
  2,                              // 스테레오
  Math.ceil(duration * 48000),   // 전체 샘플 수
  48000                           // 48kHz
);

// 클립 스케줄 후
const mixedBuffer = await offlineCtx.startRendering();
// → 영상 길이와 무관하게 CPU 속도로 렌더링 (보통 수십 ms)
```

MediaRecorder 방식(실시간 캡처)과 달리 5분 영상도 수 초 내 믹싱 완료.

### ffmpeg 명령 — 비디오 재인코딩 없음

```bash
# 케이스 1: 원본 영상 오디오 + DAW 오디오 합성
ffmpeg -i input.mp4 -i mixed.wav \
  -filter_complex "[0:a]volume=0.8[va];[va][1:a]amix=inputs=2:duration=first[outa]" \
  -map 0:v -map [outa] \
  -c:v copy \        # ← 비디오 스트림 재인코딩 없이 복사
  -c:a aac \
  -shortest output.mp4

# 케이스 2: DAW 오디오만 (원본 영상 오디오 제거 또는 뮤트 상태)
ffmpeg -i input.mp4 -i mixed.wav \
  -map 0:v -map 1:a \
  -c:v copy -c:a aac \
  -shortest output.mp4
```

`-c:v copy`로 비디오 스트림을 재인코딩하지 않아 인코딩 시간과 화질 손실이 없다.

### COOP/COEP 헤더 — SharedArrayBuffer 활성화

ffmpeg.wasm은 멀티스레드 WebAssembly를 위해 `SharedArrayBuffer`가 필요하다. `next.config.ts`에 헤더 설정:

```typescript
// next.config.ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'  },
    ],
  }];
}
```

### 특장점 요약

| 특성 | 내용 |
|------|------|
| 서버리스 | 모든 처리가 브라우저에서 완결 |
| 빠른 믹싱 | OfflineAudioContext — 실시간 캡처 대비 수십~수백 배 빠름 |
| 무손실 비디오 | `-c:v copy` — 비디오 재인코딩 없음 |
| MP4 출력 | MediaRecorder(WebM 전용)와 달리 범용 MP4 |
| Solo/Mute 반영 | 익스포트 시점의 트랙 상태 그대로 오디오 믹싱 |
| 원본 오디오 혼합 | 비디오 트랙 vol/mute 상태에 따라 원본 오디오 amix 처리 |

### MediaRecorder 방식 vs ffmpeg.wasm 방식 비교

| | MediaRecorder (구) | ffmpeg.wasm (현) |
|---|---|---|
| 출력 포맷 | WebM | MP4 |
| 처리 시간 | 영상 길이만큼 | 영상 길이와 무관 (수 초) |
| 오디오 믹싱 | 실시간 AudioContext | OfflineAudioContext (비실시간) |
| 비디오 처리 | captureStream() 실시간 캡처 | 원본 파일 직접 처리 |
| 화질 | captureStream 손실 가능 | 원본 그대로 (-c:v copy) |

---

## 11. 개발 서버 실행

```bash
cd front
npm install
npm run dev
```

`http://localhost:3000` 접속.

환경 변수 (`.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_USE_MOCK_API=true   # true 시 API 호출 없이 Mock 데이터 사용
```
