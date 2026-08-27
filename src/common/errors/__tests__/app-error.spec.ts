import { AppError, ErrorCode } from '../app-error';

describe('AppError', () => {
  it('extends Error', () => {
    const err = new AppError('VALIDATION_ERROR', 'Invalid input');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Invalid input');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
    expect(err.fields).toBeUndefined();
  });

  it('accepts custom status code', () => {
    const err = new AppError('NOT_FOUND', 'Resource missing', 404);
    expect(err.status).toBe(404);
  });

  it('accepts field errors', () => {
    const err = new AppError('VALIDATION_ERROR', 'Invalid', 400, {
      title: ['title is required'],
    });
    expect(err.fields).toEqual({ title: ['title is required'] });
  });

  it('includes stack trace', () => {
    const err = new AppError('INTERNAL_ERROR', 'oops', 500);
    expect(err.stack).toBeDefined();
  });

  it('exports common error codes', () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCode.UNAUTHENTICATED).toBe('UNAUTHENTICATED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCode.CONFLICT).toBe('CONFLICT');
    expect(ErrorCode.VERSION_CONFLICT).toBe('VERSION_CONFLICT');
    expect(ErrorCode.PAYLOAD_TOO_LARGE).toBe('PAYLOAD_TOO_LARGE');
    expect(ErrorCode.UNPROCESSABLE_ENTITY).toBe('UNPROCESSABLE_ENTITY');
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.HIGHLIGHT_LIMIT_EXCEEDED).toBe('HIGHLIGHT_LIMIT_EXCEEDED');
    expect(ErrorCode.MEDIA_IN_USE).toBe('MEDIA_IN_USE');
    expect(ErrorCode.LAST_SUPER_ADMIN).toBe('LAST_SUPER_ADMIN');
    expect(ErrorCode.IF_MATCH_REQUIRED).toBe('IF_MATCH_REQUIRED');
  });
});
