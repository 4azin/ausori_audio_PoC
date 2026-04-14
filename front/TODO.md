# DAW 타임라인 개발 태스크 정리

> **프로젝트:** SonicFlow AI — 웹 기반 오디오 에디터  
> **최종 업데이트:** 2026-04-13

---

## ✅ 완료된 태스크

### Phase 1: 상태 관리 구조 설정
- [x] Zustand 설치 및 도입
- [x] Timeline Zustand Store 생성 (`src/stores/useTimelineStore.ts`)
- [x] 트랙/클립 타입 정의 (`daw/types.ts`)
- [x] Mock 데이터 구조화 (`daw/mockData.ts`)

### Phase 2: Layer 컴포넌트 분리
- [x] `layers/RulerLayer.tsx` — 눈금자 레이어
- [x] `layers/GridLayer.tsx` — 배경 그리드 레이어
- [x] `layers/PlayheadLayer.tsx` — 플레이헤드 레이어

### Phase 3: TrackContent + AudioClip 분리
- [x] `layers/TrackContentLayer.tsx` — 트랙 클립 컨테이너
- [x] `tracks/AudioClip.tsx` — 개별 오디오 클립
- [x] `tracks/VideoFrameStrip.tsx` — 비디오 프레임 스트립
- [x] `TimelineCanvas.tsx` 리팩토링 (모놀리식 204줄 → 모듈러 ~100줄 오케스트레이터)

### Phase 4: 플레이헤드 인터랙션
- [x] 룰러/그리드 빈 영역 클릭 시 플레이헤드 이동
- [x] 플레이헤드 드래그 지원 (x축 제한, 범위 클램프)
- [x] 투명 히트 영역(16px)으로 쉬운 조작

### Phase 5: VideoFrameStrip 실제 구현
- [x] `useVideoFrames()` 훅 (`src/hooks/useVideoFrames.ts`)
  - `<video>` + Canvas로 프레임 캡처
  - 점진적 프레임 로딩 + `HTMLImageElement` 변환
- [x] Konva `<Image>`로 프레임 시퀀스 렌더링
- [x] 뷰포트 밖 프레임 스킵 (가상화)
- [x] Mock 데이터에 `/sample/samplevideo.mp4` 연동

### Phase 6: 줌/스크롤
- [x] 마우스 휠 → 수평 스크롤
- [x] Ctrl + 휠 → 줌 인/아웃 (마우스 포인터 기준점 고정)
- [x] `useTimelineWheel` 훅 (`src/hooks/useTimelineWheel.ts`)
- [x] 단축키 설정 분리 (`timelineKeymap.ts`) — 한 파일에서 관리, 나중에 변경 용이

### Phase 8-1: 웨이브폼 추출 + 클립 배치
- [x] `useAudioWaveform` 훅 (`src/hooks/useAudioWaveform.ts`)
  - Web Audio API (`AudioContext` + `decodeAudioData`) 기반 피크 추출
  - 전역 캐시 (`Map`)로 동일 파일 재요청 방지
- [x] `AudioClip` 재작성 — 거울형 채워진 웨이브폼 (Konva Line polygon)
- [x] `Clip` 타입에 `audioSrc`, `sourceOffset`, `sourceDuration` 필드 추가
- [x] Mock 데이터: 3개 샘플 오디오(`sampleaudio1~3.mp3`)로 6트랙 27클립 배치

### Phase 8-2: 클립 드래그 이동 + 트림
- [x] 클립 좌우 드래그 이동 (`moveClip` 액션)
- [x] 호버 시 양쪽 끝에 리사이즈 핸들 표시
- [x] 왼쪽 핸들 드래그 → 왼쪽 트림 (`trimClipLeft` — `sourceOffset` 증가, `startTime` 이동)
- [x] 오른쪽 핸들 드래그 → 오른쪽 트림 (`trimClipRight` — `duration` 변경)
- [x] 트림 = 잘라내기 (속도 변경 아님, `sourceOffset~sourceOffset+duration` 구간 재생)
- [x] PlayheadLayer 투명 오버레이 제거 — 클립 이벤트 차단 문제 해결

---

## 📁 현재 파일 구조

```
src/
├── stores/
│   └── useTimelineStore.ts          # Zustand — 전역 타임라인 상태 + 클립 조작 액션
├── hooks/
│   ├── useSize.ts                   # DOM 요소 크기 관찰
│   ├── useVideoFrames.ts            # 비디오 프레임 추출 (video + Canvas)
│   ├── useAudioWaveform.ts          # 오디오 웨이브폼 피크 추출 (Web Audio API)
│   └── useTimelineWheel.ts          # 휠 스크롤/줌 처리 (keymap 기반)
└── components/editor/daw/
    ├── TimelineCanvas.tsx           # 오케스트레이터 (Stage 배치, 이벤트 연결)
    ├── TrackHeaderList.tsx           # 트랙 헤더 목록
    ├── TrackHeader.tsx              # 개별 트랙 헤더 (이름, 볼륨, 팬)
    ├── DawTimeline.tsx              # 최상위 래퍼
    ├── types.ts                     # Clip, Track, TimelineState 타입
    ├── mockData.ts                  # Mock 트랙/클립 데이터 (27클립)
    ├── timelineKeymap.ts            # 단축키/입력 매핑 설정
    ├── layers/
    │   ├── RulerLayer.tsx           # 눈금자 (시간 레이블 + 틱)
    │   ├── GridLayer.tsx            # 배경 격자선
    │   ├── PlayheadLayer.tsx        # 플레이헤드 (수직선 + 드래그)
    │   └── TrackContentLayer.tsx    # 트랙 콘텐츠 컨테이너 (가상화 포함)
    └── tracks/
        ├── AudioClip.tsx            # 오디오 클립 (웨이브폼 + 드래그 + 트림)
        └── VideoFrameStrip.tsx      # 비디오 프레임 스트립 (썸네일 시퀀스)
```

---

## 🔲 남은 태스크

### 1. 재생 연동 (Phase 4 잔여)

> **목표:** 재생 버튼을 누르면 플레이헤드가 실시간으로 움직이며, 정지 시 현재 위치에 멈추기

**상세 구현 내용:**
- `requestAnimationFrame` 루프를 통해 `playheadTime`을 매 프레임 업데이트
- `useRef`로 애니메이션 프레임 ID를 관리하여 정지 시 `cancelAnimationFrame` 호출
- `isPlaying` 상태와 연동 — Transport 컨트롤(하단 재생/정지 버튼)에서 `setIsPlaying(true/false)` 호출
- **주의:** `requestAnimationFrame` 콜백 내에서 `useTimelineStore.getState()`를 직접 호출해야 stale closure 문제를 피할 수 있음
- 재생 중 플레이헤드가 뷰포트 밖으로 나가면 `scrollX`를 자동 이동하는 "Auto-scroll" 기능 추가 고려

**관련 파일:**
- `src/stores/useTimelineStore.ts` — `isPlaying`, `playheadTime`
- `src/components/editor/daw/TimelineCanvas.tsx` — 애니메이션 루프 추가
- Transport 바 컴포넌트 (하단 재생/정지/녹음 버튼)

---

### 2. VideoFrameStrip 줌 레벨별 LOD (Phase 5 잔여)

> **목표:** 줌 아웃 시 저해상도 썸네일, 줌 인 시 고해상도 썸네일을 보여주기

**상세 구현 내용:**
- `useVideoFrames` 훅에 LOD 레벨 파라미터 추가 (예: `low`, `mid`, `high`)
- 각 레벨별로 다른 `intervalSec`과 `thumbWidth`를 사용
- 줌 레벨(`pixelsPerSecond`)에 따라 적절한 LOD 자동 선택
- 고해상도 프레임은 Lazy 로딩하여 저해상도가 먼저 표시된 후 교체
- 캐시 키에 LOD 레벨 포함 (`src-low`, `src-high` 등)

**관련 파일:**
- `src/hooks/useVideoFrames.ts`
- `src/components/editor/daw/tracks/VideoFrameStrip.tsx`

---

### 3. 가상화 최적화 (Phase 6 잔여)

> **목표:** 대규모 프로젝트(수백 개 클립)에서도 60fps 유지

**상세 구현 내용:**
- 현재 `TrackContentLayer`에서 뷰포트 밖 클립을 `.filter()`로 제외하고 있음 — 이미 기본 가상화 적용 중
- **추가 개선:** `AudioClip` 내부 웨이브폼 포인트 수를 줌 레벨에 비례하여 조절 (과도한 폴리곤 방지)
- Konva `<Group>` 레벨에서 `clipFunc`을 사용하여 클리핑 적용 (뷰포트 밖 부분 렌더링 차단)
- `React.memo`로 불필요한 리렌더 방지 (clip props가 변경되지 않으면 스킵)
- 프레임 디바운싱 — 줌/스크롤 중에는 저품질 렌더링, 멈추면 고품질로 전환

**관련 파일:**
- `src/components/editor/daw/layers/TrackContentLayer.tsx`
- `src/components/editor/daw/tracks/AudioClip.tsx`
- `src/components/editor/daw/tracks/VideoFrameStrip.tsx`

---

### 4. SelectionLayer — 범위 선택 (Phase 7)

> **목표:** 타임라인 위에서 구간을 드래그하여 선택 영역을 만들고, 루프 구간이나 편집 범위로 활용

**상세 구현 내용:**
- `layers/SelectionLayer.tsx` 신규 생성 — 반투명 사각형으로 선택 구간 표시
- Zustand Store에 `selectionStart`, `selectionEnd` 상태 추가
- Alt + 드래그 (또는 커스텀 키)로 선택 영역 생성 → `timelineKeymap.ts`에 바인딩 추가
- 선택 구간 내 클립 자동 하이라이트 (다중 클립 선택)
- 루프 모드: 재생이 `selectionEnd`에 도달하면 `selectionStart`로 롤백
- 선택 구간에서 Delete 키 → 해당 구간의 클립들을 삭제 또는 잘라내기

**관련 파일:**
- `src/components/editor/daw/layers/SelectionLayer.tsx` (신규)
- `src/stores/useTimelineStore.ts` — 선택 상태 추가
- `src/components/editor/daw/timelineKeymap.ts` — 키 바인딩 추가
- `src/components/editor/daw/TimelineCanvas.tsx` — Layer 추가 배치

---

### 5. 트랙 간 클립 이동 (Phase 8 확장)

> **목표:** 클립을 드래그하여 다른 트랙으로 이동 (예: SFX 트랙의 클립을 Foley 트랙으로)

**상세 구현 내용:**
- 현재 클립 드래그는 y축이 고정되어 있음 → y축 드래그 허용으로 변경
- 드래그 중 y 좌표로 대상 트랙 계산: `targetTrackIndex = Math.floor(mouseY / trackHeight)`
- `moveClipToTrack(fromTrackId, toTrackId, clipId, newStartTime)` 액션 추가
- 드래그 중 대상 트랙에 시각적 하이라이트 (드롭 가능 영역 표시)
- 드롭 시 원본 트랙에서 제거 + 대상 트랙에 삽입
- **제약:** 비디오 트랙↔오디오 트랙 간 이동은 불허

**관련 파일:**
- `src/components/editor/daw/tracks/AudioClip.tsx` — y축 드래그 허용
- `src/stores/useTimelineStore.ts` — `moveClipToTrack` 액션
- `src/components/editor/daw/layers/TrackContentLayer.tsx` — 드롭 대상 하이라이트

---

### 6. 클립 Split/Trim 도구 (Phase 8 확장)

> **목표:** 플레이헤드 위치에서 클립을 두 개로 분할, 또는 선택 구간으로 잘라내기

**상세 구현 내용:**
- **Split:** 클립을 선택한 후 단축키(예: `S`)를 누르면 플레이헤드 위치에서 두 개의 클립으로 분할
  - 원본 클립의 `duration`을 줄이고, 새 클립을 생성하여 뒤쪽 부분에 배치
  - 새 클립의 `sourceOffset = 원본.sourceOffset + (splitTime - 원본.startTime)`
- **Trim to Selection:** 선택 구간(Phase 7)이 있으면, 클립에서 선택 영역 외 부분을 제거
- `splitClip(trackId, clipId, splitTime)` 액션 추가
- Split 결과로 생성되는 새 클립에 고유 ID 부여 (`uuid` 또는 `nanoid`)

**관련 파일:**
- `src/stores/useTimelineStore.ts` — `splitClip` 액션
- `src/components/editor/daw/timelineKeymap.ts` — Split 단축키 바인딩
- `src/components/editor/daw/types.ts` — ID 생성 유틸리티

---

### 7. 실제 오디오 재생 연결

> **목표:** Web Audio API로 클립의 실제 오디오를 재생, 각 트랙의 볼륨/팬 컨트롤 반영

**상세 구현 내용:**
- `AudioContext` + `AudioBufferSourceNode`를 사용하여 각 클립별 오디오 재생
- `clip.audioSrc`로 오디오 로드 → `decodeAudioData`로 버퍼 생성 (캐시 재활용 가능)
- 재생 시 `sourceNode.start(0, clip.sourceOffset, clip.duration)` → 트림 구간만 재생
- 각 트랙별 `GainNode`(볼륨)와 `StereoPannerNode`(팬) 연결
- 기존 `TrackHeader`의 볼륨/팬 슬라이더와 연동
- Mute/Solo 기능: `GainNode.gain.value = 0` (Mute), 다른 트랙 모두 Mute (Solo)
- `playheadTime` 기준으로 현재 재생 중인 클립만 활성화

**데이터 흐름:**
```
clip.audioSrc → fetch → decodeAudioData → AudioBuffer → AudioBufferSourceNode
  ↓ connect
TrackGainNode → TrackPanNode → MasterGainNode → AudioContext.destination
```

**관련 파일:**
- `src/hooks/useAudioPlayback.ts` (신규) — 오디오 재생 엔진
- `src/stores/useTimelineStore.ts` — 재생 상태 관리
- `src/components/editor/daw/TrackHeader.tsx` — 볼륨/팬 실시간 연동

---

### 8. 오디오 내보내기 (Export)

> **목표:** 편집 결과를 하나의 오디오/비디오 파일로 렌더링하여 다운로드

**상세 구현 내용:**
- `OfflineAudioContext`를 사용하여 모든 트랙을 믹스다운
- 각 클립을 타임라인 위치(`startTime`)에 맞게 버퍼에 배치
- 볼륨/팬 반영하여 최종 스테레오 PCM 생성
- PCM → WAV 인코딩 (또는 ffmpeg.wasm으로 MP3/AAC 인코딩)
- ffmpeg.wasm이 이미 프로젝트에 포함되어 있으므로, 비디오 + 믹싱된 오디오 합성도 가능
- 진행률 표시 UI

**관련 파일:**
- `src/hooks/useAudioExport.ts` (신규)
- 기존 ffmpeg.wasm 설정 활용
- Export 버튼 (헤더의 EXPORT 버튼 연결)

---

## 📊 Clip 데이터 구조 참고

나중에 실제 오디오 재생/내보내기에 연결할 때 참고할 트림 정보 구조:

```
┌─ 원본 오디오 파일 (audioSrc) ──────────────────────────────────────┐
│                                                                     │
│  0          sourceOffset     sourceOffset+duration    sourceDuration │
│  ├──────────┤├──────────────────┤                      ├────────────┤
│             ↑ 트림 시작         ↑ 트림 끝                           │
│             │← 실제 재생 구간 →│                                    │
│                                                                     │
│  타임라인 위치: startTime                                           │
│  startTime에서 sourceOffset~sourceOffset+duration 구간 재생         │
└─────────────────────────────────────────────────────────────────────┘
```

| 필드 | 설명 | 변경 시점 |
|------|------|-----------|
| `startTime` | 타임라인 위 시작 위치 (초) | 드래그 이동, 왼쪽 트림 |
| `duration` | 보이는 클립 길이 (초) | 왼쪽/오른쪽 트림 |
| `sourceOffset` | 원본 오디오 내 재생 시작점 (초) | 왼쪽 트림 |
| `sourceDuration` | 원본 오디오 전체 길이 (초) | 불변 (원본 파일 길이) |
