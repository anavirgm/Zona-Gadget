'use strict';

/**
 * Logger estructurado (JSON por línea) sin dependencias externas.
 * En producción los logs los consume el agregador (GCP Cloud Logging).
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] < configuredLevel) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  };

  const line = `${JSON.stringify(entry)}\n`;
  if (LEVELS[level] >= LEVELS.error) process.stderr.write(line);
  else process.stdout.write(line);
}

const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

module.exports = { logger };
