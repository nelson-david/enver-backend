import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { EnvEnvironment, SecretShare, User } from "../../database/schema.js";
import { getAuth } from "@clerk/hono";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
});

export const userRoutes = new Hono();

const createUserSchema = z.object({
    clerkId: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    imageUrl: z.string().optional(),
});

// Check if user exists by clerkId
userRoutes.get("/by-clerk/:clerkId", async (c) => {
    const clerkId = c.req.param("clerkId");
    try {
        const user = await User.findOne({ clerkId });
        if (!user) {
            return c.json({ exists: false, user: null }, 200);
        }
        return c.json({ exists: true, user }, 200);
    } catch (err: any) {
        return c.json({ error: err.message || "Database query failed" }, 500);
    }
});

// Create or update user in MongoDB
userRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
    const { clerkId, email, name, imageUrl } = c.req.valid("json");
    try {
        let user = await User.findOne({ clerkId });
        if (user) {
            user.name = name;
            user.email = email;
            if (imageUrl) user.imageUrl = imageUrl;
            await user.save();
        } else {
            user = await User.create({ clerkId, email, name, imageUrl });
        }
        return c.json({ success: true, user }, 201);
    } catch (err: any) {
        console.error("Error saving user profile:", err);
        return c.json({ error: err.message || "Failed to save user" }, 500);
    }
});

// Get user profile by MongoDB ID or clerkId
userRoutes.get("/:id", async (c) => {
    const id = c.req.param("id");
    try {
        const user =
            (await User.findById(id)) || (await User.findOne({ clerkId: id }));
        if (!user) {
            return c.json({ error: "User not found" }, 404);
        }
        return c.json({ success: true, user });
    } catch (err: any) {
        return c.json({ error: err.message || "Failed to fetch user" }, 500);
    }
});

/**
 * DELETE /api/v1/users/me
 * Permanently deletes user profile, encrypted environments, secret shares, and Clerk identity
 */
userRoutes.delete("/me", async (c) => {
    try {
        const auth = getAuth(c);
        if (!auth?.userId) {
            return c.json(
                {
                    success: false,
                    error: "Unauthorized: Missing or invalid authentication token",
                },
                401,
            );
        }

        // 1. Locate user in MongoDB
        const user = await User.findOne({ clerkId: auth.userId });
        if (!user) {
            return c.json(
                { success: false, error: "User profile not found in database" },
                404,
            );
        }

        // 2. Fetch all project IDs owned by this user to clean up SSS shares
        const userEnvs = await EnvEnvironment.find({ userId: user._id })
            .select("projectId")
            .lean();
        const projectIds = Array.from(
            new Set(userEnvs.map((e) => e.projectId)),
        );

        // 3. Cascade delete user data from MongoDB
        await Promise.all([
            // Delete all user environment documents
            EnvEnvironment.deleteMany({ userId: user._id }),

            // Delete all secret shares linked to user's projects
            projectIds.length > 0
                ? SecretShare.deleteMany({ projectId: { $in: projectIds } })
                : Promise.resolve(),

            // Delete user document
            User.deleteOne({ _id: user._id }),
        ]);

        // 4. Delete user account from Clerk Identity
        try {
            await clerkClient.users.deleteUser(auth.userId);
        } catch (clerkErr) {
            console.error("Failed to delete user from Clerk:", clerkErr);
            // Continue since DB data has already been purged
        }

        return c.json(
            {
                success: true,
                message:
                    "Account and all associated encrypted secrets permanently deleted.",
            },
            200,
        );
    } catch (error) {
        console.error("Error deleting user account:", error);
        return c.json(
            { success: false, error: "Failed to process account deletion" },
            500,
        );
    }
});
