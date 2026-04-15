import { v4 as uuidv4 } from "uuid";

import { projectModel } from "../../models";
import { s3Repository } from "../../config/s3";
import { jobRepository } from "../../jobs";
import { notFoundError, badRequestError } from "../../middleware/customError";

/** 영상 업로드 → S3 저장 → AI 작업 큐 등록 */
export async function uploadVideo(
  projectId: number,
  userId: number,
  file: Express.Multer.File,
) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.status !== "uploading" && project.status !== "failed") {
    throw badRequestError("현재 상태에서는 영상을 업로드할 수 없습니다");
  }

  const ext = file.originalname.split(".").pop() || "mp4";
  const s3Key = `videos/${projectId}/${uuidv4()}.${ext}`;

  await s3Repository.upload({
    key: s3Key,
    body: file.buffer,
    contentType: file.mimetype,
  });

  await projectModel.update(projectId, { status: "analyzing" });

  const jobId = uuidv4();

  await jobRepository.enqueue({
    jobId,
    projectId,
    userId,
    videoPath: s3Key,
    videoMeta: {
      mimeType: file.mimetype,
      fileSize: file.size,
      // durationSeconds 는 업로드 시점에 모름 — AI 워커가 ffmpeg probe 로 채움
    },
    requestedAt: new Date().toISOString(),
  });
  await jobRepository.linkProjectJob(projectId, jobId);

  return { jobId, s3Key };
}
