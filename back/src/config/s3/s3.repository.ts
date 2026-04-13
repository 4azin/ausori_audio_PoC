import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { s3Client, S3_BUCKET } from "./client";
import { S3UploadParams, S3DownloadResult } from "./types";

/** S3 저장소 — 파일 업로드/다운로드/삭제/서명 URL */
export const s3Repository = {

  /** 파일 업로드 */
  async upload({ key, body, contentType }: S3UploadParams): Promise<string> {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    return key;
  },

  /** 파일 다운로드 */
  async download(key: string): Promise<S3DownloadResult> {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );

    return {
      body: response.Body as ReadableStream | null,
      contentType: response.ContentType,
    };
  },

  /** 파일 삭제 */
  async remove(key: string): Promise<void> {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
  },

  /** 서명된 URL 발급 (기본 15분) */
  async getSignedUrl(key: string, expiresIn = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  },
};
