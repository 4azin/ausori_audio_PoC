import { Track } from './types';

// ── 샘플 오디오 경로 ──
const AUDIO_1 = '/sample/sampleaudio1.mp3';
const AUDIO_2 = '/sample/sampleaudio2.mp3';
const AUDIO_3 = '/sample/sampleaudio3.mp3';

// ── 샘플 오디오 원본 길이 (초, 대략적 MOK 값) ──
// 실제로는 useAudioWaveform이 추출한 duration으로 나중에 갱신 가능
const AUDIO_1_DUR = 4.5;   // sampleaudio1.mp3 ~4.5초
const AUDIO_2_DUR = 8.5;   // sampleaudio2.mp3 ~8.5초
const AUDIO_3_DUR = 10.0;  // sampleaudio3.mp3 ~10초

// ── Mock 트랙/클립 데이터 ──
// 3개 샘플 오디오를 다양한 트랙에 배치하여 실제 DAW처럼 보이게 구성

export const MOCK_TRACKS: Track[] = [
  // ═══════════════════════════════════════════════
  //  Video Track
  // ═══════════════════════════════════════════════
  {
    id: 'video',
    name: 'Video',
    type: 'video',
    color: '#3a3a45',
    io: 'samplevideo.mp4',
    videoSrc: '/sample/samplevideo.mp4',
    clips: [],
    subTracks: [],
  },

  // ═══════════════════════════════════════════════
  //  DLG (Dialogue) — 대사 트랙
  // ═══════════════════════════════════════════════
  {
    id: 'dlg',
    name: 'DLG',
    type: 'audio',
    color: '#ffc800',
    io: 'Stereo Mix',
    clips: [],
    subTracks: [
      { id: 'dlg-sub-1', name: 'dlg_scene1', type: 'audio', color: '#ffc800', io: 'Stereo Mix', clips: [
      {
        id: 'dlg-1',
        name: 'dialogue_intro',
        startTime: 0.5,
        duration: 4.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#ffc800',
        audioSrc: AUDIO_1,
      },
      {
        id: 'dlg-2',
        name: 'dialogue_mid',
        startTime: 6.0,
        duration: 3.2,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#ffc800',
        audioSrc: AUDIO_2,
      },
      {
        id: 'dlg-3',
        name: 'dialogue_close',
        startTime: 10.5,
        duration: 5.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#ffc800',
        audioSrc: AUDIO_3,
      },
      {
        id: 'dlg-4',
        name: 'dialogue_outro',
        startTime: 17.0,
        duration: 3.5,
        sourceOffset: 0.5,
        sourceDuration: AUDIO_1_DUR,
        color: '#ffc800',
        audioSrc: AUDIO_1,
      },
      ] },
      { id: 'dlg-sub-2', name: 'dlg_scene2', type: 'audio', color: '#ffc800', io: 'Stereo Mix', clips: [] },
    ],
  },

  // ═══════════════════════════════════════════════
  //  Music — 배경음악 트랙
  // ═══════════════════════════════════════════════
  {
    id: 'music',
    name: 'Music',
    type: 'audio',
    color: '#00f0ff',
    io: 'Stereo Mix',
    clips: [
      {
        id: 'music-1',
        name: 'bgm_intro_pad',
        startTime: 0,
        duration: 8.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#00f0ff',
        audioSrc: AUDIO_3,
      },
      {
        id: 'music-2',
        name: 'bgm_main_loop',
        startTime: 8.5,
        duration: 8.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#00a8cc',
        audioSrc: AUDIO_2,
      },
      {
        id: 'music-3',
        name: 'bgm_bridge',
        startTime: 18.0,
        duration: 4.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#00f0ff',
        audioSrc: AUDIO_1,
      },
    ],
    subTracks: [
      { id: 'music-sub-1', name: 'bgm_main_loop', type: 'audio', color: '#00f0ff', io: 'Stereo Mix', clips: [] },
    ],
  },

  // ═══════════════════════════════════════════════
  //  AMB (Ambience) — 환경음 트랙
  // ═══════════════════════════════════════════════
  {
    id: 'amb',
    name: 'AMB',
    type: 'audio',
    color: '#b500ff',
    io: 'Stereo Mix',
    clips: [
      {
        id: 'amb-1',
        name: 'city_rain_loop',
        startTime: 0,
        duration: 8.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#b500ff',
        audioSrc: AUDIO_2,
      },
      {
        id: 'amb-2',
        name: 'wind_howl',
        startTime: 10.0,
        duration: 10.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#9400d3',
        audioSrc: AUDIO_3,
      },
    ],
    subTracks: [
      { id: 'amb-sub-1', name: 'neon_city_rain', type: 'audio', color: '#b500ff', io: 'Stereo Mix', clips: [] },
      { id: 'amb-sub-2', name: 'distant_traffic', type: 'audio', color: '#b500ff', io: 'Stereo Mix', clips: [] },
    ],
  },

  // ═══════════════════════════════════════════════
  //  Foley — 효과음/풋스텝 트랙
  // ═══════════════════════════════════════════════
  {
    id: 'foley',
    name: 'Foley',
    type: 'audio',
    color: '#d455ff',
    io: 'Input 1-2',
    clips: [
      {
        id: 'foley-1',
        name: 'footstep_01',
        startTime: 1.2,
        duration: 1.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#d455ff',
        audioSrc: AUDIO_1,
      },
      {
        id: 'foley-2',
        name: 'footstep_02',
        startTime: 3.0,
        duration: 1.5,
        sourceOffset: 1.0,
        sourceDuration: AUDIO_1_DUR,
        color: '#d455ff',
        audioSrc: AUDIO_1,
      },
      {
        id: 'foley-3',
        name: 'door_creak',
        startTime: 5.5,
        duration: 2.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#c44dff',
        audioSrc: AUDIO_2,
      },
      {
        id: 'foley-4',
        name: 'glass_break',
        startTime: 8.0,
        duration: 1.8,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#d455ff',
        audioSrc: AUDIO_3,
      },
      {
        id: 'foley-5',
        name: 'footstep_03',
        startTime: 10.5,
        duration: 1.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#d455ff',
        audioSrc: AUDIO_1,
      },
      {
        id: 'foley-6',
        name: 'cloth_rustle',
        startTime: 13.0,
        duration: 2.2,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#c44dff',
        audioSrc: AUDIO_2,
      },
      {
        id: 'foley-7',
        name: 'impact_thud',
        startTime: 16.5,
        duration: 1.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#d455ff',
        audioSrc: AUDIO_3,
      },
    ],
    subTracks: [
      { id: 'foley-sub-1', name: 'footsteps', type: 'audio', color: '#d455ff', io: 'Input 1-2', clips: [] },
    ],
  },

  // ═══════════════════════════════════════════════
  //  SFX — 특수효과음 트랙
  // ═══════════════════════════════════════════════
  {
    id: 'sfx',
    name: 'SFX',
    type: 'audio',
    color: '#39ff14',
    io: 'Aux 5-6',
    clips: [
      {
        id: 'sfx-1',
        name: 'whoosh_01',
        startTime: 2.0,
        duration: 1.2,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#39ff14',
        audioSrc: AUDIO_3,
      },
      {
        id: 'sfx-2',
        name: 'laser_shot',
        startTime: 4.5,
        duration: 2.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#2ecc40',
        audioSrc: AUDIO_1,
      },
      {
        id: 'sfx-3',
        name: 'explosion_rumble',
        startTime: 7.8,
        duration: 4.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#39ff14',
        audioSrc: AUDIO_2,
      },
      {
        id: 'sfx-4',
        name: 'glitch_stutter',
        startTime: 13.0,
        duration: 1.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#2ecc40',
        audioSrc: AUDIO_3,
      },
      {
        id: 'sfx-5',
        name: 'power_surge',
        startTime: 15.5,
        duration: 3.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#39ff14',
        audioSrc: AUDIO_1,
      },
      {
        id: 'sfx-6',
        name: 'ui_confirm',
        startTime: 19.5,
        duration: 0.8,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#2ecc40',
        audioSrc: AUDIO_2,
      },
    ],
    subTracks: [
      { id: 'sfx-sub-1', name: 'laser_shot', type: 'audio', color: '#39ff14', io: 'Aux 5-6', clips: [] },
      { id: 'sfx-sub-2', name: 'explosion', type: 'audio', color: '#39ff14', io: 'Aux 5-6', clips: [] },
    ],
  },

  // ═══════════════════════════════════════════════
  //  Cinematic — 시네마틱 사운드 트랙
  // ═══════════════════════════════════════════════
  {
    id: 'cinematic',
    name: 'Cinematic',
    type: 'audio',
    color: '#00f0ff',
    io: 'Aux 7-8',
    clips: [
      {
        id: 'cine-1',
        name: 'rise_tension',
        startTime: 0,
        duration: 4.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#00bcd4',
        audioSrc: AUDIO_1,
      },
      {
        id: 'cine-2',
        name: 'impact_boom',
        startTime: 5.0,
        duration: 2.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#00f0ff',
        audioSrc: AUDIO_3,
      },
      {
        id: 'cine-3',
        name: 'drone_sustain',
        startTime: 8.0,
        duration: 8.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_2_DUR,
        color: '#00bcd4',
        audioSrc: AUDIO_2,
      },
      {
        id: 'cine-4',
        name: 'sweep_transition',
        startTime: 17.0,
        duration: 4.5,
        sourceOffset: 0,
        sourceDuration: AUDIO_1_DUR,
        color: '#00f0ff',
        audioSrc: AUDIO_1,
      },
      {
        id: 'cine-5',
        name: 'tail_reverb',
        startTime: 22.5,
        duration: 5.0,
        sourceOffset: 0,
        sourceDuration: AUDIO_3_DUR,
        color: '#00bcd4',
        audioSrc: AUDIO_3,
      },
    ],
    subTracks: [
      { id: 'cine-sub-1', name: 'impact_boom', type: 'audio', color: '#00f0ff', io: 'Aux 7-8', clips: [] },
    ],
  },
];
