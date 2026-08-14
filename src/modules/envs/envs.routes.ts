import { Hono, Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
    EnvEnvironment,
    SecretShare,
    User,
    Project,
    ActivityLog,
} from "../../database/schema.js";
import { Types } from "mongoose";

const createSecretSchema = z.object({
    projectId: z
        .string()
        .regex(
            /^[a-zA-Z0-9-]+$/,
            "Project ID can only contain letters, numbers, and hyphens",
        )
        .min(1, "Project ID is required")
        .max(100, "Project ID is too long"),
    environment: z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT"]),
    ciphertext: z.string().min(1),
    iv: z.string().min(1),
    salt: z.string().min(1),
    shares: z
        .array(
            z.object({
                shareIndex: z.number(),
                shareData: z.string(),
            }),
        )
        .min(3, "At least 3 shares are required"),
});

const addMemberSchema = z
    .object({
        email: z.email().optional(),
        userId: z.string().optional(),
        role: z.string().default("member"),
    })
    .refine((data) => data.email || data.userId, {
        message: "Either email or userId must be provided",
    });

export const envRoutes = new Hono();

// Authentication helper
async function authenticateUser(c: Context) {
    const user = c.get("user");
    const authType = c.get("authType");
    const tokenScopes = c.get("tokenScopes") || [];

    if (!user) {
        return {
            error: c.json(
                {
                    success: false,
                    error: "Unauthorized: Missing or invalid authentication token",
                },
                401,
            ),
            user: null,
            authType: null,
            tokenScopes: [],
        };
    }

    return { user, authType, tokenScopes, error: null };
}

// 1. POST /api/env - Store/Encrypt Environment & Auto-Create Project if needed
envRoutes.post("/", zValidator("json", createSecretSchema), async (c) => {
    try {
        const body = c.req.valid("json");
        const { user, authType, tokenScopes, error } =
            await authenticateUser(c);
        if (error || !user) return error;

        // Enforce token scopes for write operations
        if (
            authType === "token" &&
            !tokenScopes.includes("write:secrets") &&
            !tokenScopes.includes("admin")
        ) {
            return c.json(
                {
                    success: false,
                    error: "Forbidden: Token does not have write permissions",
                },
                403,
            );
        }

        const userIdStr = user._id.toString();

        // Check if Project exists by projectId (NOT name)
        let project = await Project.findOne({ projectId: body.projectId });

        if (!project) {
            // Auto-create Project with proper schema structure
            project = await Project.create({
                projectId: body.projectId,
                ownerId: user._id,
                members: [{ userId: user._id, role: "owner" }],
            });

            // Log activity
            await ActivityLog.create({
                projectId: body.projectId,
                userId: user._id,
                action: "PROJECT_CREATED",
                details: `Project ${body.projectId} was created`,
            });
        } else {
            // Check if user is owner or admin
            const isOwner = project.ownerId.toString() === userIdStr;
            const member = project.members.find(
                (m) => m.userId.toString() === userIdStr,
            );
            const isAdmin = member && member.role === "admin";

            if (!isOwner && !isAdmin) {
                return c.json(
                    {
                        success: false,
                        error: "Forbidden: Admin privileges required to modify secrets",
                    },
                    403,
                );
            }
        }

        // Upsert Environment Variables
        const envDoc = await EnvEnvironment.findOneAndUpdate(
            { projectId: body.projectId, environment: body.environment },
            {
                userId: user._id,
                projectId: body.projectId,
                environment: body.environment,
                ciphertext: body.ciphertext,
                iv: body.iv,
                salt: body.salt,
            },
            { upsert: true, new: true },
        );

        // Replace Secret Shares
        await SecretShare.deleteMany({ projectId: body.projectId });

        const sharesToInsert = body.shares.map((s) => ({
            projectId: body.projectId,
            shareIndex: s.shareIndex,
            shareData: s.shareData,
        }));

        await SecretShare.insertMany(sharesToInsert);

        // Log activity
        await ActivityLog.create({
            projectId: body.projectId,
            userId: user._id,
            action: "ENVIRONMENT_UPDATED",
            details: `Environment ${body.environment} was updated`,
        });

        return c.json(
            {
                success: true,
                message: "Secret encrypted and saved successfully",
                data: {
                    projectId: envDoc.projectId,
                    environment: envDoc.environment,
                },
            },
            201,
        );
    } catch (error) {
        console.error("Error creating secret:", error);
        return c.json({ success: false, error: "Failed to store secret" }, 500);
    }
});

// 2. GET /api/env - List User's Environments
envRoutes.get("/", async (c) => {
    try {
        const { user, authType, tokenScopes, error } =
            await authenticateUser(c);
        if (error || !user) return error;

        // Enforce token scopes for read operations
        if (
            authType === "token" &&
            !tokenScopes.includes("read:secrets") &&
            !tokenScopes.includes("admin")
        ) {
            return c.json(
                {
                    success: false,
                    error: "Forbidden: Token does not have read permissions",
                },
                403,
            );
        }

        // Query projects where user is owner or listed in members array
        const userProjects = await Project.find({
            $or: [{ ownerId: user._id }, { "members.userId": user._id }],
        }).select("projectId");

        const projectIds = userProjects.map((p) => p.projectId);

        // Fetch environments for those projects
        const environments = await EnvEnvironment.find({
            projectId: { $in: projectIds },
        })
            .select("projectId environment createdAt updatedAt")
            .sort({ updatedAt: -1 })
            .lean();

        const shareCounts = await SecretShare.aggregate([
            { $match: { projectId: { $in: projectIds } } },
            { $group: { _id: "$projectId", totalShares: { $sum: 1 } } },
        ]);

        const shareCountMap = new Map<string, number>(
            shareCounts.map((item: { _id: string; totalShares: number }) => [
                item._id,
                item.totalShares,
            ]),
        );

        const formattedEnvs = environments.map((env) => ({
            id: env._id.toString(),
            projectId: env.projectId,
            environment: env.environment,
            sharesCount: shareCountMap.get(env.projectId) || 0,
            createdAt: env.createdAt,
            updatedAt: env.updatedAt,
        }));

        return c.json({ success: true, data: formattedEnvs }, 200);
    } catch (error) {
        console.error("Error fetching user envs:", error);
        return c.json(
            { success: false, error: "Failed to retrieve environments" },
            500,
        );
    }
});

// 4. GET /api/env/share/:projectId - Fetch Shared Payload for CLI Decryption
envRoutes.get("/share/:projectId", async (c) => {
    try {
        const { user, authType, tokenScopes, error } =
            await authenticateUser(c);
        if (error || !user) return error;

        // Enforce token scopes for read operations
        if (
            authType === "token" &&
            !tokenScopes.includes("read:secrets") &&
            !tokenScopes.includes("admin")
        ) {
            return c.json(
                {
                    success: false,
                    error: "Forbidden: Token does not have read permissions",
                },
                403,
            );
        }

        const projectId = c.req.param("projectId");
        const envInput = (
            c.req.query("environment") || "PRODUCTION"
        ).toUpperCase();

        if (!["PRODUCTION", "STAGING", "DEVELOPMENT"].includes(envInput)) {
            return c.json(
                {
                    success: false,
                    error: "Invalid environment. Must be PRODUCTION, STAGING, or DEVELOPMENT.",
                },
                400,
            );
        }

        const environment = envInput as
            | "PRODUCTION"
            | "STAGING"
            | "DEVELOPMENT";

        const project = await Project.findOne({ projectId });
        if (!project) {
            return c.json({ success: false, error: "Project not found" }, 404);
        }

        const userIdStr = user._id.toString();
        const isOwner = project.ownerId.toString() === userIdStr;
        const isMember = project.members.some(
            (m) => m.userId.toString() === userIdStr,
        );

        if (!isOwner && !isMember) {
            return c.json(
                {
                    success: false,
                    error: "Forbidden: You do not have access to this project",
                },
                403,
            );
        }

        const envDoc = await EnvEnvironment.findOne({
            projectId,
            environment,
        }).lean();

        if (!envDoc) {
            return c.json(
                {
                    success: false,
                    error: `No environment variables found for project '${projectId}' in '${environment}'`,
                },
                404,
            );
        }

        const shares = await SecretShare.find({ projectId })
            .select("shareIndex shareData -_id")
            .lean();

        if (!shares || shares.length === 0) {
            return c.json(
                {
                    success: false,
                    error: "Secret shares not found for this project",
                },
                404,
            );
        }

        return c.json(
            {
                success: true,
                data: {
                    projectId: envDoc.projectId,
                    environment: envDoc.environment,
                    ciphertext: envDoc.ciphertext,
                    iv: envDoc.iv,
                    salt: envDoc.salt,
                    shares,
                },
            },
            200,
        );
    } catch (error) {
        console.error("Error fetching shared secret:", error);
        return c.json(
            { success: false, error: "Failed to retrieve secret payload" },
            500,
        );
    }
});

// 5. DELETE /api/env/:projectId - Delete Environment and Project
envRoutes.delete("/:projectId", async (c) => {
    try {
        const { user, authType, tokenScopes, error } =
            await authenticateUser(c);
        if (error || !user) return error;

        // Enforce token scopes for write operations
        if (
            authType === "token" &&
            !tokenScopes.includes("write:secrets") &&
            !tokenScopes.includes("admin")
        ) {
            return c.json(
                {
                    success: false,
                    error: "Forbidden: Token does not have write permissions",
                },
                403,
            );
        }

        const projectId = c.req.param("projectId");
        const envInput = c.req.query("environment");

        const project = await Project.findOne({ projectId });
        if (!project) {
            return c.json({ success: false, error: "Project not found" }, 404);
        }

        const userIdStr = user._id.toString();
        const isOwner = project.ownerId.toString() === userIdStr;
        const member = project.members.find(
            (m) => m.userId.toString() === userIdStr,
        );
        const isAdmin = member && member.role === "admin";

        if (!isOwner && !isAdmin) {
            return c.json(
                {
                    success: false,
                    error: "Forbidden: Admin privileges required to delete secrets",
                },
                403,
            );
        }

        if (envInput) {
            // Delete specific environment
            const environment = envInput.toUpperCase() as
                | "PRODUCTION"
                | "STAGING"
                | "DEVELOPMENT";
            await EnvEnvironment.deleteOne({
                projectId,
                environment,
            });

            // Log activity
            await ActivityLog.create({
                projectId,
                userId: user._id,
                action: "ENVIRONMENT_DELETED",
                details: `Environment ${environment} was deleted`,
            });

            // Check if there are any other environments left for this project
            const remainingEnvs = await EnvEnvironment.countDocuments({
                projectId,
            });
            if (remainingEnvs === 0) {
                // If no environments left, delete the project and shares
                await Project.deleteOne({ projectId });
                await SecretShare.deleteMany({ projectId });
                await ActivityLog.deleteMany({ projectId });
            }
        } else {
            // Delete all environments, shares, and the project itself
            await EnvEnvironment.deleteMany({ projectId });
            await SecretShare.deleteMany({ projectId });
            await Project.deleteOne({ projectId });
            await ActivityLog.deleteMany({ projectId });
        }

        return c.json(
            { success: true, message: "Environment deleted successfully" },
            200,
        );
    } catch (error) {
        console.error("Error deleting environment:", error);
        return c.json(
            { success: false, error: "Failed to delete environment" },
            500,
        );
    }
});
