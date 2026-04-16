export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: null;
}

export interface ApiErrorResponse {
  success: boolean;
  data?: null;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
}
