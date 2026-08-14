import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import crypto from "node:crypto";
import { ApiToken } from "../../database/schema.js";

export const tokenRoutes = new Hono();

// Middleware to enforce user authentication and capture IP address
// This runs on all token routes to ensure tokens are bound to specific IPs
const authAndIpMiddleware = async (c: any, next: any) => {
    const user = c.get("user");
    if (!user) {
        return c.json(
            {
                success: false,
                error: "Unauthorized: Missing or invalid authentication",
            },
            401,
        );
    }

    // Capture the IP address from various headers
    const ipAddress =
        c.req.header("x-forwarded-for") ||
        c.req.header("x-real-ip") ||
        c.ip ||
        "unknown";

    c.set("user", user);
    c.set("ipAddress", ipAddress);
    await next();
};

// Schema for creating new API tokens - only name and TTL, IP and scopes handled automatically
const createTokenSchema = z.object({
    name: z
        .string()
        .min(1, "Token name is required")
        .max(100, "Token name is too long"),
    ttlDays: z.number().nullable().optional(),
    scopes: z
        .array(z.enum(["read:secrets", "write:secrets", "admin"]))
        .default(["read:secrets"]),
});

// Create a new API token - IP binding enforced automatically via middleware
// Scopes are validated and can be specified by the user
// IP address is automatically captured from request headers (X-Forwarded-For, X-Real-IP)
tokenRoutes.post(
    "/",
    zValidator("json", createTokenSchema),
    authAndIpMiddleware,
    async (c) => {
        try {
            const { name, ttlDays, scopes } = c.req.valid("json");
            const user = c.get("user")!;
            const ipAddress = c.get("ipAddress");

            // 1. Generate a cryptographically secure raw token
            const rawBytes = crypto.randomBytes(32).toString("hex");
            const rawToken = `env_live_${rawBytes}`;

            // 2. Hash the token with SHA-256 for secure DB storage
            const tokenHash = crypto
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");

            // 3. Compute display prefix (first 12 characters, e.g. "env_live_abc")
            const displayPrefix = rawToken.substring(0, 12);

            // 4. Calculate expiration date based on TTL
            let expiresAt: Date | null = null;
            if (ttlDays) {
                expiresAt = new Date(
                    Date.now() + ttlDays * 24 * 60 * 60 * 1000,
                );
            }

            // 5. Store API token record in MongoDB with IP binding
            const apiToken = await ApiToken.create({
                userId: user._id,
                name: name.trim(),
                tokenHash,
                displayPrefix,
                scopes,
                ipAddress,
            });

            return c.json(
                {
                    success: true,
                    data: {
                        id: apiToken._id.toString(),
                        name: apiToken.name,
                        rawToken,
                        displayPrefix: apiToken.displayPrefix,
                        scopes: apiToken.scopes,
                        expiresAt: apiToken.expiresAt,
                    },
                },
                201,
            );
        } catch (err: any) {
            console.error("Error creating API token:", err);
            return c.json(
                {
                    success: false,
                    error: err.message || "Failed to create token",
                },
                500,
            );
        }
    },
);

// Fetch all active tokens of the user
tokenRoutes.get("/", authAndIpMiddleware, async (c) => {
    try {
        const user = c.get("user")!;
        const tokens = await ApiToken.find({ userId: user._id }).sort({
            createdAt: -1,
        });

        const formattedTokens = tokens.map((token) => ({
            id: token._id.toString(),
            name: token.name,
            displayPrefix: token.displayPrefix,
            scopes: token.scopes,
            expiresAt: token.expiresAt,
            lastUsedAt: token.lastUsedAt,
            createdAt: token.createdAt,
            ipAddress: token.ipAddress,
        }));

        return c.json({ success: true, data: formattedTokens }, 200);
    } catch (err: any) {
        console.error("Error fetching API tokens:", err);
        return c.json(
            { success: false, error: err.message || "Failed to fetch tokens" },
            500,
        );
    }
});

// Revoke/Delete an API token
tokenRoutes.delete("/:id", authAndIpMiddleware, async (c) => {
    try {
        const id = c.req.param("id");
        const user = c.get("user")!;

        const result = await ApiToken.deleteOne({ _id: id, userId: user._id });
        if (result.deletedCount === 0) {
            return c.json(
                {
                    success: false,
                    error: "Token not found or unauthorized to delete",
                },
                404,
            );
        }

        return c.json(
            { success: true, message: "Token successfully revoked" },
            200,
        );
    } catch (err: any) {
        console.error("Error deleting API token:", err);
        return c.json(
            { success: false, error: err.message || "Failed to delete token" },
            500,
        );
    }
});
