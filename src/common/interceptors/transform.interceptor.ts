import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PaginationMeta {
  page?: number;
  limit?: number;
  totalItems?: number;
  totalPages?: number;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ data: unknown; meta: Record<string, unknown> }> {
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? null;

    return next.handle().pipe(
      map((value: unknown) => {
        if (value === null || value === undefined) {
          return { data: null, meta: { requestId } };
        }

        if (
          typeof value === 'object' &&
          value !== null &&
          'items' in value &&
          Array.isArray((value as { items: unknown[] }).items)
        ) {
          const v = value as { items: unknown[] } & Record<string, unknown>;
          const { items, ...rest } = v;
          return { data: { items }, meta: { requestId, ...rest } };
        }

        return { data: value, meta: { requestId } };
      }),
    );
  }
}
