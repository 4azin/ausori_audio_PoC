import { ApiErrorResponse, ApiResponse } from "@/types/api/common";

/**
 * 프론트엔드 공통 Fetch API 클라이언트
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const apiClient = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // 세션 기반 Cookie 인증을 위해 필수 지정
  });

  let data;
  try {
    data = await response.json();
  } catch (error) {
    // JSON 파싱 실패 (서버 에러 등)
    throw new Error(`API 통신 실패: ${response.statusText}`);
  }

  // 성공 응답이 아닌 경우
  if (!response.ok || data.success === false) {
    const errorData = data as ApiErrorResponse;
    const errorMessage = errorData.error?.message || "알 수 없는 에러가 발생했습니다.";
    const errorCode = errorData.error?.code || response.status.toString();
    
    // 에러 발생 시 공통 로깅 처리 (추후 글로벌 토스트 등 연동 가능)
    console.error(`[API Error] ${errorCode}: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  // 성공 시 data 객체를 리턴
  const successData = data as ApiResponse<T>;
  return successData.data;
};
