import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { RequestIdInterceptor } from '../request-id.interceptor';
import { TransformInterceptor } from '../transform.interceptor';

describe('RequestIdInterceptor', () => {
  let interceptor: RequestIdInterceptor;

  beforeEach(() => {
    interceptor = new RequestIdInterceptor();
  });

  function createMockContext(initialReq: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => initialReq,
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
  }

  it('attaches a generated requestId to request if missing', async () => {
    const req: any = {};
    const mockContext = createMockContext(req);
    const handler: CallHandler = { handle: () => of(null) };

    await lastValueFrom(interceptor.intercept(mockContext, handler));

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses incoming X-Request-Id header', async () => {
    const req: any = { headers: { 'x-request-id': 'incoming-id' } };
    const mockContext = createMockContext(req);
    const handler: CallHandler = { handle: () => of(null) };

    await lastValueFrom(interceptor.intercept(mockContext, handler));

    expect(req.requestId).toBe('incoming-id');
  });
});

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps data into { data, meta: { requestId } }', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'r1' }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of({ foo: 'bar' }) };

    const result = await lastValueFrom(interceptor.intercept(mockContext, handler));
    expect(result).toEqual({ data: { foo: 'bar' }, meta: { requestId: 'r1' } });
  });

  it('merges pagination meta if provided', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'r1' }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = {
      handle: () => of({ items: [], page: 1, limit: 10, totalItems: 0, totalPages: 0 }),
    };

    const result = await lastValueFrom(interceptor.intercept(mockContext, handler));
    expect(result).toEqual({
      data: { items: [] },
      meta: { requestId: 'r1', page: 1, limit: 10, totalItems: 0, totalPages: 0 },
    });
  });
});