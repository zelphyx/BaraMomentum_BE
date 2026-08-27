import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestMetaInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export const RequestMeta = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestMetaInfo => {
    const req = ctx.switchToHttp().getRequest();
    const headers = req.headers ?? {};
    return {
      ip: req.ip ?? headers['x-forwarded-for'] ?? null,
      userAgent: headers['user-agent'] ?? null,
      requestId: headers['x-request-id'] ?? null,
    };
  },
);