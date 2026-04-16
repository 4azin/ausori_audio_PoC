"""Gemini File API 영상 업로드 유틸.

영상 파일을 Gemini File API로 업로드하고, ACTIVE 상태가 될 때까지 대기한 뒤
generate_content에 전달할 수 있는 file 객체를 반환한다.
사용 후 delete_video()로 정리한다.
"""

from __future__ import annotations

import time

from google import genai


def upload_video(client: genai.Client, video_path: str, *, poll_interval: float = 2.0) -> object:
    """영상을 Gemini File API로 업로드하고 처리 완료까지 대기.

    Returns:
        처리 완료된 file 객체 (contents 에 직접 전달 가능)
    Raises:
        RuntimeError: 파일 처리가 FAILED 상태로 끝난 경우
    """
    print(f"[upload] 영상 업로드 중... {video_path}")
    video_file = client.files.upload(file=video_path)
    print(f"[upload] 업로드 완료: {video_file.name} (state={video_file.state})")

    while video_file.state == "PROCESSING":
        time.sleep(poll_interval)
        video_file = client.files.get(name=video_file.name)

    if video_file.state == "FAILED":
        raise RuntimeError(f"Gemini 파일 처리 실패: {video_file.name}")

    print(f"[upload] 처리 완료: {video_file.name} (state={video_file.state})")
    return video_file


def delete_video(client: genai.Client, video_file) -> None:
    """업로드된 파일을 삭제한다. 실패해도 예외를 던지지 않는다."""
    try:
        client.files.delete(name=video_file.name)
        print(f"[upload] 삭제 완료: {video_file.name}")
    except Exception as e:
        print(f"[upload] 삭제 실패 (무시): {video_file.name} — {e}")
