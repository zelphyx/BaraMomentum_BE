import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ErrorCode } from '../errors/app-error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? null;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let fields: Record<string, string[]> | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      fields = exception.fields;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        const rawMsg = b.message;
        if (Array.isArray(rawMsg)) {
          message = 'Validation failed';
          fields = this.extractValidationFields(rawMsg as string[]);
        } else if (typeof rawMsg === 'string') {
          message = rawMsg;
        } else {
          message = exception.message;
        }
      }
      code = this.mapHttpStatusToCode(status);
    } else if (exception instanceof Error) {
      message = process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message;
      this.logger.error(exception.stack ?? exception.message);
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    const errorBody: Record<string, unknown> = { code, message, requestId };
    if (fields) errorBody.fields = fields;
    const isKnownError = exception instanceof AppError || exception instanceof HttpException;
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error && !isKnownError) {
      errorBody.stack = exception.stack;
    }

    response.status(status).json({ error: errorBody });
  }

  private mapHttpStatusToCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.VALIDATION_ERROR;
      case 401:
        return ErrorCode.UNAUTHENTICATED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 413:
        return ErrorCode.PAYLOAD_TOO_LARGE;
      case 422:
        return ErrorCode.UNPROCESSABLE_ENTITY;
      case 429:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private extractValidationFields(messages: string[]): Record<string, string[]> {
    const fields: Record<string, string[]> = {};
    const fieldRegex = /^([a-zA-Z0-9_]+)\s/;
    for (const msg of messages) {
      const match = msg.match(fieldRegex);
      const field = match?.[1];
      if (field) {
        if (!fields[field]) fields[field] = [];
        fields[field]!.push(msg);
      } else {
        if (!fields._general) fields._general = [];
        fields._general.push(msg);
      }
    }
    return fields;
  }
}
