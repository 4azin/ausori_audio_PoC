import { projectModel } from "../../models";
import { s3Repository } from "../../config/s3";
import { jobRepository } from "../../config/redis";
import { notFoundError, badRequestError } from "../../middleware/customError";

/** 영상 업로드 → S3 저장 → AI 작업 큐 등록 */
export async function uploadVideo(
  projectId: number,
  userId: string,
  file: Express.Multer.File,
) {
  const project = await projectModel.findById(projectId);

  if (!project) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.userId !== userId) throw notFoundError("프로젝트를 찾을 수 없습니다");
  if (project.status !== "uploading" && project.status !== "failed") {
    throw badRequestError("현재 상태에서는 영상을 업로드할 수 없습니다");
  }

  /** S3 업로드 */
  const ext = file.originalname.split(".").pop() || "mp4";
  const s3Key = `videos/${projectId}/${crypto.randomUUID()}.${ext}`;

  await s3Repository.upload({
    key: s3Key,
    body: file.buffer,
    contentType: file.mimetype,
  });

  /** 프로젝트 상태 업데이트 */
  await projectModel.update(projectId, { status: "analyzing" });

  /** AI 작업 큐 등록 */
  const jobId = crypto.randomUUID();

  await jobRepository.enqueue({
    job_id: jobId,
    project_id: String(projectId),
    video_path: s3Key,
  });

  return { jobId, s3Key };
}
