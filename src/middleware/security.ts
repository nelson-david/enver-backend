import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { rateLimiter } from "hono-rate-limiter";
import { config } from "../config.js";

export function applySecurityMiddleware(app: Hono) {
    // 1. Strict Security Headers (OWASP recommendations)
    app.use(
        "*",
        secureHeaders({
            contentSecurityPolicy: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
            },
            xFrameOptions: "DENY",
            xContentTypeOptions: "nosniff",
            referrerPolicy: "strict-origin-when-cross-origin",
            strictTransportSecurity:
                "max-age=31536000; includeSubDomains; preload",
        }),
    );

    // 2. Strict CORS Configuration
    app.use(
        "*",
        cors({
            origin: (origin) => {
                // Allow requests with no origin (like server-to-server or mobile apps) in dev
                if (!origin && config.nodeEnv === "development") return "*";
                if (config.corsOrigins.includes(origin)) return origin;
                return null; // Block disallowed origins
            },
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
            exposeHeaders: ["Content-Length"],
            maxAge: 600, // Cache preflight requests for 10 minutes
            credentials: true,
        }),
    );

    // 3. Rate Limiting (Prevents Brute-Force & DDoS)
    const limiter = rateLimiter({
        windowMs: config.rateLimit.windowMs,
        limit: config.rateLimit.maxRequests,
        standardHeaders: "draft-6", // draft-6: RateLimit-* headers
        keyGenerator: (c) => {
            // Use Client IP (Check reverse proxy X-Forwarded-For header)
            // Note: Only trust x-forwarded-for if behind a trusted reverse proxy
            const forwardedFor = c.req.header("x-forwarded-for");
            if (forwardedFor) {
                // Take the first IP in the list (the original client IP)
                // If you don't trust the proxy, you should use c.env or conn.remote.address instead
                return forwardedFor.split(",")[0].trim();
            }
            return c.req.header("x-real-ip") || "anonymous";
        },
        handler: (c) => {
            return c.json(
                {
                    success: false,
                    error: "Too Many Requests",
                    message:
                        "You have exceeded the request limit. Please try again later.",
                },
                429,
            );
        },
    });

    app.use("/api/*", limiter);

    // 4. Request Body Payload Limit (Prevents Memory Exhaustion)
    app.use(
        "*",
        bodyLimit({
            maxSize: config.bodyLimitBytes,
            onError: (c) => {
                return c.json(
                    {
                        success: false,
                        error: "Payload Too Large",
                        message:
                            "Request payload exceeds the maximum allowed size of 2MB.",
                    },
                    413,
                );
            },
        }),
    );
}
