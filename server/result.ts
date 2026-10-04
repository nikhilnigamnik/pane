import { ERROR_MESSAGES } from '@/config/messages';
import type { ApiErrorCode, Result } from '@/types/api';

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function fail<T>(code: ApiErrorCode): Result<T> {
  return { success: false, error: { code, message: ERROR_MESSAGES[code] } };
}

export function errorCode(error: unknown): string | null {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return null;
}
