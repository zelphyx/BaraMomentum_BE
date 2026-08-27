import { Params } from 'nestjs-pino';

export const pinoConfig = (): Params => ({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.passwordHash',
        'req.body.token',
        'req.body.refreshToken',
        'req.body.secret',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.tokenHash',
        '*.refreshToken',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps: (req) => ({
      requestId: (req as { requestId?: string }).requestId,
    }),
  },
});