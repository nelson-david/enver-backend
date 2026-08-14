import { Context, Next } from "hono";

interface RateLimitStore {
    count: number;
    resetTime: number;
}

const store = new Map<string, RateLimitStore>();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(
    () => {
        const now = Date.now();
        for (const [key, value] of store.entries()) {
            if (now > value.resetTime) {
                store.delete(key);
            }
        }
    },
    5 * 60 * 1000,
);

export const rateLimiter = (options: { windowMs: number; max: number }) => {
    return async (c: Context, next: Next) => {
        // Get IP address or fallback to a generic key
        // In a real production environment behind a proxy (like Railway/Render),
        // you'd want to check headers like 'x-forwarded-for'
        const ip =
            c.req.header("x-forwarded-for") ||
            c.req.header("x-real-ip") ||
            "unknown-ip";

        // If authenticated via token, we can also rate limit by user ID
        const user = c.get("user");
        const key = user ? `user:${user._id}` : `ip:${ip}`;

        const now = Date.now();
        const record = store.get(key);

        if (!record) {
            store.set(key, {
                count: 1,
                resetTime: now + options.windowMs,
            });
            c.header("X-RateLimit-Limit", options.max.toString());
            c.header("X-RateLimit-Remaining", (options.max - 1).toString());
            return next();
        }

        if (now > record.resetTime) {
            // Reset window
            record.count = 1;
            record.resetTime = now + options.windowMs;
            c.header("X-RateLimit-Limit", options.max.toString());
            c.header("X-RateLimit-Remaining", (options.max - 1).toString());
            return next();
        }

        if (record.count >= options.max) {
            c.header("X-RateLimit-Limit", options.max.toString());
            c.header("X-RateLimit-Remaining", "0");
            c.header(
                "Retry-After",
                Math.ceil((record.resetTime - now) / 1000).toString(),
            );

            return c.json(
                {
                    success: false,
                    error: "Too many requests, please try again later.",
                },
                429,
            );
        }

        record.count += 1;
        c.header("X-RateLimit-Limit", options.max.toString());
        c.header(
            "X-RateLimit-Remaining",
            (options.max - record.count).toString(),
        );

        return next();
    };
};
