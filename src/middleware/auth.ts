import { Context, Next } from "hono";
import { getAuth } from "@clerk/hono";
import crypto from "node:crypto";
import { User, ApiToken, IUser } from "../database/schema.js";

declare module "hono" {
    interface ContextVariableMap {
        user?: IUser;
        authType?: "token" | "clerk";
        tokenScopes?: string[];
        ipAddress?: string;
    }
}

export async function resolveAuthUser(c: Context, next: Next) {
    const authHeader = c.req.header("Authorization");
    let user: IUser | null = null;
    let authType: "token" | "clerk" | undefined = undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        if (token && token.startsWith("env_live_")) {
            const tokenHash = crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

            // Use timingSafeEqual if we were comparing strings directly,
            // but here we are querying the DB with the hash which is safe from timing attacks on the string comparison itself.
            const apiToken = await ApiToken.findOne({ tokenHash }).populate<{
                userId: IUser;
            }>("userId");

            if (apiToken) {
                if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
                    return c.json(
                        {
                            success: false,
                            error: "Authentication token has expired",
                        },
                        401,
                    );
                }

                authType = "token";

                // IP address validation for token-based authentication
                if (
                    apiToken.ipAddress &&
                    apiToken.ipAddress !== "unknown"
                ) {
                    const requestIp =
                        c.req.header("x-forwarded-for") ||
                        c.req.header("x-real-ip") ||
                        "unknown";
                    if (apiToken.ipAddress !== requestIp) {
                        return c.json(
                            {
                                success: false,
                                error: "Invalid IP address for this token",
                            },
                            403,
                        );
                    }
                }

                user = apiToken.userId;
                c.set("tokenScopes", apiToken.scopes);

                // Asynchronously update lastUsedAt
                ApiToken.updateOne(
                    { _id: apiToken._id },
                    { $set: { lastUsedAt: new Date() } },
                ).catch((err) =>
                    console.error("Error updating token lastUsedAt:", err),
                );
            }
        }
    }

    // Fall back to Clerk auth if no user resolved via API token
    if (!user) {
        try {
            const auth = getAuth(c);
            if (auth?.userId) {
                user = await User.findOne({ clerkId: auth.userId });
                if (user) {
                    authType = "clerk";
                }
            }
        } catch (e) {
            // Clerk might not be active on this route or token invalid
        }
    }

    if (user) {
        c.set("user", user);
        c.set("authType", authType);
    }

    await next();
}
