/**
 * Logger mínimo para el worker (evita sumar dependencia de pino/winston).
 * Formato: `[ISO] LEVEL msg key=value key=value`
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const currentLevel: LogLevel = (process.env.WORKER_LOG_LEVEL as LogLevel) || 'info'

function format(level: LogLevel, msg: string, ctx?: Record<string, unknown>): string {
  const parts = [new Date().toISOString(), level.toUpperCase().padEnd(5), msg]
  if (ctx && Object.keys(ctx).length > 0) {
    parts.push(Object.entries(ctx).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' '))
  }
  return parts.join(' ')
}

function log(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return
  const line = format(level, msg, ctx)
  if (level === 'error') console.error(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
}
