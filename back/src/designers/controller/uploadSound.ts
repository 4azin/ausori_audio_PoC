import { Request, Response } from "express";

import { uploadSound as uploadSoundService } from "../service";

/**
 * 사운드 업로드 컨트롤러
 *
 * multipart/form-data 요청 구조:
 *   - file 필드: 오디오 파일 → multer가 파싱 → req.file에 저장
 *   - 나머지 필드: 텍스트로 전달 → req.body에 저장
 *
 * 주의: multipart에서는 배열/숫자도 전부 문자열로 오기 때문에
 *       JSON.parse()나 Number()로 변환 필요
 */
export async function uploadSound(req: Request, res: Response) {
  const userId = req.session.userId!;
  const file = req.file!;  // upload() 미들웨어가 파싱한 파일 객체

  // multipart 텍스트 필드 → 적절한 타입으로 변환
  const meta = {
    originalPath: req.body.originalPath as string | undefined,
    majorId: Number(req.body.majorId),       // "1" → 1
    midId: Number(req.body.midId),
    subId: Number(req.body.subId),
    mood: req.body.mood ? JSON.parse(req.body.mood) : [],            // '["calm","dark"]' → ["calm","dark"]
    tags: req.body.tags ? JSON.parse(req.body.tags) : [],
    description: req.body.description as string | undefined,
    bpm: req.body.bpm ? Number(req.body.bpm) : undefined,
    instruments: req.body.instruments ? JSON.parse(req.body.instruments) : undefined,
  };

  const sound = await uploadSoundService(userId, file, meta);

  // API 스펙에 맞는 필드만 응답
  res.status(201).json({
    id: sound.id,
    fileName: sound.fileName,
    s3Key: sound.s3Key,
    originalPath: sound.originalPath,
    duration: sound.duration,
    format: sound.format,
    fileSize: sound.fileSize,
  });
}
