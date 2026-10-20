import pino from "pino";
import type { Log } from "./log.js";

export function createLog(options: { level: string; pretty: boolean }): Log {
  const logger = pino({
    level: options.level,
    ...(options.pretty && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    }),
  });
  return (level, message, data = {}) => logger[level](data, message);
}
