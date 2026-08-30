import { createParamDecorator, BadRequestException } from '@nestjs/common';

export const IfMatch = createParamDecorator(
  (headerName: string, ctx: { switchToHttp: () => { getRequest: () => { headers: Record<string, string | string[] | undefined> } } }) => {
    const value = ctx.switchToHttp().getRequest().headers[headerName ?? 'if-match'];
    if (!value) return undefined;
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return undefined;
    const version = parseInt(raw.replace(/"/g, ''), 10);
    if (isNaN(version)) throw new BadRequestException('If-Match must contain a version number');
    return version;
  },
);
