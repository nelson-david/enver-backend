import { MiddlewareHandler } from "hono";
import logger from "../config/logger.js";

export const performanceLogger = (slowThresholdMs = 500): MiddlewareHandler => {
    return async (c, next) => {
        const start = performance.now();
        const method = c.req.method;
        const path = c.req.path;

        await next();

        const duration = performance.now() - start;
        const formattedDuration = duration.toFixed(2);

        c.header(
            "Server-Timing",
            `total;dur=${formattedDuration};desc="Execution Time"`,
        );

        const status = c.res.status;
        const logMessage = `⏱️  [${method}] ${path} - ${status} - ${formattedDuration}ms`;

        if (duration > slowThresholdMs) {
            console.warn(`⚠️  SLOW REQUEST DETECTED: ${logMessage}`);
            logger.warn(`⚠️  SLOW REQUEST DETECTED: ${logMessage}`);
        } else {
            console.info(logMessage);
            logger.info(logMessage);
        }
    };
};
