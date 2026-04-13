import multer from "multer";

import { badRequestError } from "./customError";

/** 허용 MIME 타입 프리셋 */
const MIME_PRESETS = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
} as const;

type PresetKey = keyof typeof MIME_PRESETS;

interface UploadOptions {
  /** 허용 MIME 프리셋 키 */
  allow: PresetKey;
  /** 최대 파일 크기 (bytes) — 기본 50MB */
  maxSize?: number;
}

/**
 * 재사용 가능한 single-file 업로드 미들웨어 팩토리
 *
 * @example
 *   router.post("/video", upload({ allow: "video", maxSize: 500_000_000 }), handler);
 *   router.post("/avatar", upload({ allow: "image" }), handler);
 */
export function upload({ allow, maxSize = 50 * 1024 * 1024 }: UploadOptions) {
  const allowed = MIME_PRESETS[allow];

  const storage = multer.memoryStorage();

  const instance = multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      if ((allowed as readonly string[]).includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(badRequestError(`허용되지 않는 파일 형식입니다 (${allowed.join(", ")})`));
      }
    },
  });

  return instance.single("file");
}
