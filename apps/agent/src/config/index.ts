import { z } from "zod";
import 'dotenv/config';

// Schema
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    ZAI_API_KEY: z.string(),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

// Parse env
const parseEnv = () => {
    try {
        const env = envSchema.parse(process.env);
        return {
            server: {
                environment: env.NODE_ENV,
            },
            zai: {
                apiKey: env.ZAI_API_KEY,
            },
            logging: {
                level: env.LOG_LEVEL,
            },
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join('\n');

            console.error('Invalid environment variables:\n', issues);
            process.exit(1);
        }
        throw error;
    }
};

// Export validated config
export const config = parseEnv();

// Export inferred type for use elsewhere
export type Config = typeof config;

// Helper to check environment
export const isDevelopment = config.server.environment === 'development';
export const isProduction = config.server.environment === 'production';
export const isTest = config.server.environment === 'test';
