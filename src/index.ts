import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { clerkMiddleware } from "@clerk/hono";
import { config } from "./config.js";
import { applySecurityMiddleware } from "./middleware/security.js";
import { performanceLogger } from "./middleware/performance.js";
import { handleGlobalErrors } from "./middleware/errorHandler.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { envRoutes } from "./modules/envs/envs.routes.js";
import { tokenRoutes } from "./modules/tokens/tokens.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { membersRoutes } from "./modules/members/members.routes.js";
import { activityRoutes } from "./modules/activity/activity.routes.js";
import { resolveAuthUser } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import connectDB from "./database/index.js";
import { projectRoutes } from "./modules/projects/projects.routes.js";

const app = new Hono();
await connectDB();

app.use("*", performanceLogger(500));
app.use("*", clerkMiddleware());
app.use("/api/*", resolveAuthUser);

// Apply rate limiting to all API routes (e.g., 100 requests per minute)
app.use("/api/*", rateLimiter({ windowMs: 60 * 1000, max: 100 }));

applySecurityMiddleware(app);
app.onError(handleGlobalErrors);

app.route("/api/v1/users", userRoutes);
app.route("/api/v1/envs", envRoutes);
app.route("/api/v1/tokens", tokenRoutes);
app.route("/api/v1/projects", projectRoutes);
app.route("/api/v1/projects", membersRoutes);
app.route("/api/v1/activity", activityRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/v1/auth", authRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

serve(
    {
        fetch: app.fetch,
        port: config.port,
    },
    () => {
        console.log(`🚀 Server running on http://localhost:${config.port}`);
    },
);
