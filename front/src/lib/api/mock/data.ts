import { User, DesignerProfile } from "@/types/api/user";
import { Project, ProjectLoadResponse } from "@/types/api/project";
import { SoundAsset, SoundCategoryNode } from "@/types/api/sound";

// 목업 지연 함수
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 사용자 파트 Mock
export const mockUser: User = {
  id: 1,
  email: "user@gmail.com",
  name: "테스트유저",
  profileImageUrl: "",
  role: "user",
  plan: "free",
  monthlyUsageCount: 2,
};

export const mockDesignerProfile: DesignerProfile = {
  id: 1,
  displayName: "사운드 스튜디오 목업",
  bio: "목업 디자이너입니다.",
  revenueShareRate: 0.7,
  soundCount: 15,
  totalDownloads: 100,
};

// 프로젝트 파트 Mock
export const mockProjects: Project[] = [
  {
    id: 1,
    title: "내 첫번째 영상",
    thumbnailUrl: "",
    status: "ready",
    durationSeconds: 120,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "두번째 작업물",
    thumbnailUrl: "",
    status: "analyzing",
    durationSeconds: 60,
    createdAt: new Date().toISOString(),
  },
];

export const mockProjectLoadData = (id: number): ProjectLoadResponse => ({
  id,
  title: "목업 에디터 내용",
  thumbnailUrl: "",
  status: "ready",
  durationSeconds: 120,
  createdAt: new Date().toISOString(),
  snapshot: {
    version: 1,
    trackGroups: [
      {
        id: 1,
        type: "ambience",
        volume: 80,
        isMuted: false,
        isSolo: false,
        order: 1,
        tracks: [
          {
            id: 1,
            name: "Ambience Tracks",
            volume: 100,
            pan: 0,
            isMuted: false,
            isSolo: false,
            order: 1,
            events: [
              {
                id: 1,
                soundAssetId: 101,
                startTime: 0,
                endTime: 15.5,
                offset: 0,
                volumeOverride: 80,
                fadeIn: 0.5,
                fadeOut: 1.0,
                isUserEdited: false,
              },
            ],
          },
        ],
      },
    ],
  },
  soundAssets: {
    "101": {
      id: 101,
      fileName: "mock_sound_01.mp3",
      category: { major: "ambience", mid: "weather" },
      duration: 30,
      format: "mp3",
      s3Key: "mock/s3/path/01.mp3",
      channels: 2,
      sampleRate: 48000,
    },
  },
});

// 효과음 파트 Mock
export const mockSoundAssets: SoundAsset[] = [
  {
    id: 1,
    fileName: "rain_heavy.wav",
    category: { major: "ambience", mid: "weather", sub: "rain" },
    duration: 15.0,
    format: "wav",
  },
  {
    id: 2,
    fileName: "bird_singing.mp3",
    category: { major: "ambience", mid: "nature", sub: "bird" },
    duration: 10.0,
    format: "mp3",
  },
];

export const mockCategories: SoundCategoryNode[] = [
  {
    id: 1,
    name: "ambience",
    children: [
      {
        id: 11,
        name: "weather",
        children: [{ id: 111, name: "rain" }],
      },
    ],
  },
];
