/** S3 업로드 파라미터 */
export interface S3UploadParams {
  key: string;
  body: Buffer | ReadableStream;
  contentType: string;
}

/** S3 다운로드 결과 */
export interface S3DownloadResult {
  body: ReadableStream | null;
  contentType: string | undefined;
}
