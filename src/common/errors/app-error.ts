export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  HIGHLIGHT_LIMIT_EXCEEDED: 'HIGHLIGHT_LIMIT_EXCEEDED',
  MEDIA_IN_USE: 'MEDIA_IN_USE',
  LAST_SUPER_ADMIN: 'LAST_SUPER_ADMIN',
  IF_MATCH_REQUIRED: 'IF_MATCH_REQUIRED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly status: number;
  public readonly fields?: Record<string, string[]>;

  constructor(
    code: ErrorCodeType,
    message: string,
    status: number = 400,
    fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    Object.setPrototypeOf(this, AppError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
