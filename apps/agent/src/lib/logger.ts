
import pino from "pino";
import { config, isDevelopment } from "../config/index.js";

export const logger = pino({
    level: config.logging.level,
    ...(isDevelopment && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    }),
})