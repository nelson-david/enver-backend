import "dotenv/config";

export const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",

    corsOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : ["http://localhost:3000", "https://enver-os.vercel.app"],

    rateLimit: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
    },

    bodyLimitBytes: 2 * 1024 * 1024,
    databaseUri: process.env.DATABASE_URI || "mongodb://localhost:27017/enver",
};
