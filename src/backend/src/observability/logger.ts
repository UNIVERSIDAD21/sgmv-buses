import pino, { type DestinationStream, type LoggerOptions } from 'pino'

import { env } from '../config/env.js'

const loggerOptions: LoggerOptions = {
  base: {
    environment: env.NODE_ENV,
    service: 'sgmv-api',
  },
  redact: {
    censor: '[REDACTED]',
    paths: [
      'authorization',
      'cookie',
      'contrasena',
      'contrasenaHash',
      'password',
      'secret',
      'token',
      '*.authorization',
      '*.cookie',
      '*.contrasena',
      '*.contrasenaHash',
      '*.password',
      '*.secret',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
    ],
  },
}

export function createLogger(
  destination?: DestinationStream,
  level = (env.NODE_ENV === 'test' || process.env.VITEST) && process.env.SGMV_TEST_LOGS !== 'true'
    ? 'silent'
    : env.LOG_LEVEL,
) {
  const options = { ...loggerOptions, level }

  return destination ? pino(options, destination) : pino(options)
}

export const logger = createLogger()
