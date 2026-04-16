import { Track } from './types';

// ── 샘플 오디오 경로 정의 ──
const AMB_DIR = '/sample/AMB';
const CINE_DIR = '/sample/Cinematic';
const DLG_DIR = '/sample/DLG';
const FOLEY_DIR = '/sample/Foley';
const MUSIC_DIR = '/sample/Music';
const SFX_DIR = '/sample/SFX';

export const MOCK_TRACKS: Track[] = [
  {
    id: 'video',
    name: 'Video',
    type: 'video',
    color: '#3a3a45',
    io: 'samplevideo.mp4',
    videoSrc: '/sample/samplevideo.mp4',
    pan: 0, vol: 1, mute: false,
    clips: [
      {
        id: 'video-main', name: 'Original Video', startTime: 0, duration: 80,
        sourceOffset: 0, sourceDuration: 80, color: '#3a3a45'
      }
    ],
    subTracks: [],
  },
  {
    id: 'dlg',
    name: 'Dialogue',
    type: 'audio',
    color: '#ffc800',
    io: 'Stereo Mix',
    pan: 0, vol: 1, mute: false,
    clips: [],
    subTracks: [
      {
        id: 'dlg-sub-1', name: 'Crowd & Fans', type: 'audio', color: '#ffc800', io: 'Stereo Mix',
        pan: 0, vol: 1, mute: false,
        clips: [
          {
            id: 'dlg-1', name: 'Stadium Fans', startTime: 15, duration: 15,
            sourceOffset: 0, sourceDuration: 30, color: '#ffc800', audioSrc: `${DLG_DIR}/freesound_263680_Football stadium fans are not happy with the referee.ogg`,
          },
        ]
      },
      {
        id: 'dlg-sub-2', name: 'Bar Ambience', type: 'audio', color: '#ffc800', io: 'Stereo Mix',
        pan: 0, vol: 1, mute: false,
        clips: [
          {
            id: 'dlg-2', name: 'Bar Crowd', startTime: 45, duration: 15,
            sourceOffset: 0, sourceDuration: 30, color: '#ffc800', audioSrc: `${DLG_DIR}/freesound_394290_Bar Crowd in Belgrade.mp3`,
          },
        ]
      },
    ],
  },
  {
    id: 'music',
    name: 'Music',
    type: 'audio',
    color: '#00f0ff',
    io: 'Stereo Mix',
    pan: 0, vol: 1, mute: false,
    clips: [],
    subTracks: [
      {
        id: 'music-sub-1', name: 'Main Themes', type: 'audio', color: '#00f0ff', io: 'Stereo Mix',
        pan: 0, vol: 1, mute: false,
        clips: [
          {
            id: 'music-1', name: 'Silent Movie Theme', startTime: 0, duration: 25,
            sourceOffset: 0, sourceDuration: 40, color: '#00f0ff', audioSrc: `${MUSIC_DIR}/freesound_31297_Silent Movie - Sam Fox - Hurry Music.wav.mp3`,
          },
          {
            id: 'music-2', name: 'Violin Minuet', startTime: 28, duration: 22,
            sourceOffset: 0, sourceDuration: 45, color: '#00a8cc', audioSrc: `${MUSIC_DIR}/freesound_25481_violin minuet_boccherini (edit).wav.mp3`,
          },
          {
            id: 'music-3', name: 'News Theme', startTime: 55, duration: 20,
            sourceOffset: 0, sourceDuration: 30, color: '#00f0ff', audioSrc: `${MUSIC_DIR}/freesound_23977_newswav_plusdrums.wav.mp3`,
          },
        ]
      },
    ],
  },
  {
    id: 'amb',
    name: 'Ambience',
    type: 'audio',
    color: '#b500ff',
    io: 'Stereo Mix',
    pan: 0, vol: 1, mute: false,
    clips: [],
    subTracks: [
      {
        id: 'amb-sub-1', name: 'City Streets', type: 'audio', color: '#b500ff', io: 'Stereo Mix',
        pan: 0, vol: 0.6, mute: false,
        clips: [
          {
            id: 'amb-1', name: 'London Street Noise', startTime: 0, duration: 35,
            sourceOffset: 0, sourceDuration: 60, color: '#b500ff', audioSrc: `${AMB_DIR}/freesound_398159_Ambience_ London Street_ A.wav.mp3`,
          },
        ]
      },
      {
        id: 'amb-sub-4', name: 'Urban Background', type: 'audio', color: '#b500ff', io: 'Stereo Mix',
        pan: 0, vol: 0.6, mute: false,
        clips: [
          {
            id: 'amb-2', name: 'Cars Passing', startTime: 10, duration: 15,
            sourceOffset: 0, sourceDuration: 20, color: '#9400d3', audioSrc: `${AMB_DIR}/freesound_20049_cars pass by.wav.mp3`,
          }
        ]
      },
      {
        id: 'amb-sub-3', name: 'Social', type: 'audio', color: '#b500ff', io: 'Stereo Mix',
        pan: 0, vol: 0.5, mute: false,
        clips: [
          {
            id: 'amb-5', name: 'Dinner Party', startTime: 60, duration: 20,
            sourceOffset: 0, sourceDuration: 40, color: '#b500ff', audioSrc: `${AMB_DIR}/freesound_72848_Posh dinner party.wav.mp3`,
          }
        ]
      }
    ],
  },
  {
    id: 'sfx',
    name: 'SFX',
    type: 'audio',
    color: '#39ff14',
    io: 'Aux 5-6',
    pan: 0, vol: 1, mute: false,
    clips: [],
    subTracks: [
      {
        id: 'sfx-sub-1', name: 'Animals', type: 'audio', color: '#39ff14', io: 'Aux 5-6',
        pan: 0, vol: 1, mute: false,
        clips: [
          {
            id: 'sfx-1', name: 'Cow Moo 1', startTime: 5, duration: 3,
            sourceOffset: 0, sourceDuration: 5, color: '#39ff14', audioSrc: `${SFX_DIR}/freesound_177253_Cow moos.mp3`,
          },
          {
            id: 'sfx-2', name: 'Owl Hoot', startTime: 42, duration: 4,
            sourceOffset: 0, sourceDuration: 6, color: '#2ecc40', audioSrc: `${SFX_DIR}/freesound_465697_Owl Hoot.mp3`,
          },
          {
            id: 'sfx-3', name: 'Cat Meow', startTime: 65, duration: 2,
            sourceOffset: 0, sourceDuration: 3, color: '#39ff14', audioSrc: `${SFX_DIR}/freesound_18272_sound-meow3.wav.ogg`,
          },
        ]
      },
      {
        id: 'sfx-sub-2', name: 'Communications', type: 'audio', color: '#39ff14', io: 'Aux 5-6',
        pan: 0, vol: 1, mute: false,
        clips: [
          {
            id: 'sfx-4', name: 'Radio Chatter', startTime: 72, duration: 8,
            sourceOffset: 0, sourceDuration: 15, color: '#39ff14', audioSrc: `${SFX_DIR}/freesound_208436_Radio Chatter Soundscape.ogg`,
          },
        ]
      },
    ],
  },
  {
    id: 'foley',
    name: 'Foley',
    type: 'audio',
    color: '#d455ff',
    io: 'Input 1-2',
    pan: 0, vol: 1, mute: false,
    clips: [],
    subTracks: [
      {
        id: 'foley-sub-1', name: 'Actions', type: 'audio', color: '#d455ff', io: 'Input 1-2',
        pan: 0, vol: 1, mute: false,
        clips: [
          {
            id: 'foley-1', name: 'Gulps', startTime: 12, duration: 3,
            sourceOffset: 0, sourceDuration: 5, color: '#d455ff', audioSrc: `${FOLEY_DIR}/freesound_87565_gulps.wav.ogg`,
          },
          {
            id: 'foley-2', name: 'Gulps 2', startTime: 53, duration: 3,
            sourceOffset: 0, sourceDuration: 5, color: '#d455ff', audioSrc: `${FOLEY_DIR}/freesound_87565_gulps.wav.ogg`,
          }
        ]
      },
    ],
  },
];
