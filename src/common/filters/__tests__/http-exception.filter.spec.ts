import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AppError } from '../../errors/app-error';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { requestId: 'req-123' };
    mockHost = {
      switchToHttp: () => ({ getResponse: () => mockResponse, getRequest: () => mockRequest }),
    } as any;
    process.env.NODE_ENV = 'test';
  });

  it('formats AppError with its code and status', () => {
    const err = new AppError('NOT_FOUND', 'Resource gone', 404);
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource gone',
        requestId: 'req-123',
      },
    });
  });

  it('formats NestJS BadRequestException as VALIDATION_ERROR', () => {
    const err = new BadRequestException('bad');
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bad',
        requestId: 'req-123',
      },
    });
  });

  it('formats NestJS NotFoundException as NOT_FOUND', () => {
    const err = new NotFoundException('missing');
    filter.catch(err, mockHost);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'NOT_FOUND' }) }),
    );
  });

  it('hides stack trace in production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('boom');
    filter.catch(err, mockHost);
    const call = mockResponse.json.mock.calls[0][0];
    expect(call.error.stack).toBeUndefined();
    expect(call.error.message).toBe('Internal server error');
    expect(call.error.code).toBe('INTERNAL_ERROR');
  });

  it('includes stack trace in development', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('boom');
    filter.catch(err, mockHost);
    const call = mockResponse.json.mock.calls[0][0];
    expect(call.error.stack).toBeDefined();
    expect(call.error.message).toBe('boom');
  });
});
