// API 타입 정의 - Sync API 응답 모델
// SPEC-MTT-009: REQ-MTT-009-06, REQ-MTT-009-17

// @MX:NOTE: 백엔드 SyncResponse와 일치하는 타입 정의
export interface SyncResponse {
  status: string;
  total_files_scanned: number;
  files_processed: number;
  files_skipped: number;
  records_created: number;
  errors: Array<{
    file: string;
    error: string;
  }>;
  started_at: string | null;
  completed_at: string | null;
}

// @MX:NOTE: 백엔드 StatusResponse와 일치하는 타입 정의
export interface SyncStatusResponse {
  watchdog_active: boolean;
  watched_directory: string | null;
  last_sync_at: string | null;
  last_sync_result: {
    files_processed: number;
    errors: Array<{
      file: string;
      error: string;
    }>;
  } | null;
}
