"""Gemini File API 영상 업로드 유틸.

영상 파일을 Gemini File API로 업로드하고, ACTIVE 상태가 될 때까지 대기한 뒤
generate_content에 전달할 수 있는 file 객체를 반환한다.
사용 후 delete_video()로 정리한다.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import time

from google import genai

import llm_client

# 업로드 누적 시간 (pipeline 에서 telemetry 용으로 조회)
_upload_total_sec: float = 0.0


def get_upload_total_sec() -> float:
    return _upload_total_sec


def reset_upload_total_sec() -> None:
    global _upload_total_sec
    _upload_total_sec = 0.0


def upload_video(client: genai.Client, video_path: str, *, poll_interval: float = 2.0) -> object:
    """영상을 Gemini File API로 업로드하고 처리 완료까지 대기.

    Returns:
        처리 완료된 file 객체 (contents 에 직접 전달 가능)
    Raises:
        RuntimeError: 파일 처리가 FAILED 상태로 끝난 경우
    """
    global _upload_total_sec
    file_size = os.path.getsize(video_path)

    with llm_client.start_span(
        "video_upload",
        metadata={"video_path": video_path, "file_size_bytes": file_size},
    ):
        print(f"[upload] 영상 업로드 중... {video_path} ({file_size / 1024:.0f}KB)")
        t0 = time.perf_counter()

        # 파일명에 비ASCII(한글 등)가 있으면 httpx 헤더 인코딩 에러 발생.
        # 임시 ASCII 파일명으로 복사 후 업로드.
        _, ext = os.path.splitext(video_path)
        needs_copy = False
        try:
            os.path.basename(video_path).encode("ascii")
        except UnicodeEncodeError:
            needs_copy = True

        if needs_copy:
            tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            tmp.close()
            shutil.copy2(video_path, tmp.name)
            upload_path = tmp.name
        else:
            upload_path = video_path

        try:
            video_file = client.files.upload(file=upload_path)
        finally:
            if needs_copy:
                os.unlink(upload_path)

        upload_sec = time.perf_counter() - t0
        print(f"[upload] 업로드 완료: {video_file.name} (state={video_file.state}, {upload_sec:.1f}s)")

        while video_file.state == "PROCESSING":
            time.sleep(poll_interval)
            video_file = client.files.get(name=video_file.name)

        total_sec = time.perf_counter() - t0
        _upload_total_sec += total_sec

        if video_file.state == "FAILED":
            raise RuntimeError(f"Gemini 파일 처리 실패: {video_file.name}")

        print(f"[upload] 처리 완료: {video_file.name} (state={video_file.state}, total={total_sec:.1f}s)")

    return video_file


def delete_video(client: genai.Client, video_file) -> None:
    """업로드된 파일을 삭제한다. 실패해도 예외를 던지지 않는다."""
    with llm_client.start_span(
        "video_cleanup",
        metadata={"gemini_file_name": video_file.name},
    ):
        try:
            client.files.delete(name=video_file.name)
            print(f"[upload] 삭제 완료: {video_file.name}")
        except Exception as e:
            print(f"[upload] 삭제 실패 (무시): {video_file.name} — {e}")
