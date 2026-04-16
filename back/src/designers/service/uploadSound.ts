import { soundAssetModel, soundDesignerModel } from "../../models";
import { notFoundError, badRequestError } from "../../middleware/customError";

/**
 * 사운드 에셋 업로드
 *
 * 흐름:
 *   1. userId로 sound_designers 조회 → designer.id 획득
 *   2. S3 저장 경로(s3Key) 생성 — "sounds/{designerId}/{timestamp}_{파일명}"
 *   3. sound_assets 테이블에 메타데이터 INSERT
 *
 * file: multer가 메모리에 저장한 파일 객체
 *   - file.originalname: 원본 파일명
 *   - file.size: 바이트 단위 크기
 *   - file.buffer: 파일 바이너리 데이터 (S3 업로드에 사용)
 *
 * meta: multipart/form-data에서 추출한 텍스트 필드들
 *   - majorId/midId/subId: 카테고리 분류 ID
 *   - tags, mood: 검색용 태그 배열
 */
export async function uploadSound(
  userId: number,
  file: Express.Multer.File,
  meta: {
    originalPath?: string;
    majorId: number;
    midId: number;
    subId: number;
    mood: string[];
    tags: string[];
    description?: string;
    bpm?: number;
    instruments?: string[];
  },
) {
  const designer = await soundDesignerModel.findByUserId(userId);
  if (!designer) throw notFoundError("디자이너 정보를 찾을 수 없습니다");

  if (!file) throw badRequestError("파일이 필요합니다");

  // 파일 확장자 추출: "rain_heavy.wav" → "wav"
  const ext = file.originalname.split(".").pop() ?? "";
  const format = ext.toLowerCase();

  // S3 저장 경로 — timestamp로 파일명 충돌 방지
  const s3Key = `sounds/${designer.id}/${Date.now()}_${file.originalname}`;

  // TODO: 실제 S3 업로드 (aws-sdk로 file.buffer를 S3에 PUT)
  // TODO: 오디오 메타 추출 (ffprobe 등으로 duration, channels, sampleRate 파싱)
  // 현재는 placeholder 값 사용
  const sound = await soundAssetModel.create({
    designerId: designer.id,
    fileName: file.originalname,
    s3Key,
    originalPath: meta.originalPath,
    majorId: meta.majorId,
    midId: meta.midId,
    subId: meta.subId,
    mood: meta.mood,
    tags: meta.tags,
    description: meta.description,
    bpm: meta.bpm,
    instruments: meta.instruments,
    duration: 0,       // TODO: 실제 오디오 길이
    format,
    channels: 2,       // TODO: 실제 채널 수
    sampleRate: 48000,  // TODO: 실제 샘플레이트
    fileSize: file.size,
  });

  return sound;
}
