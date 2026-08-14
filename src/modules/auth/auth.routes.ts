import { Hono } from "hono";

export const authRoutes = new Hono();

// Fetch currently authenticated user profile
authRoutes.get("/me", async (c) => {
    const user = c.get("user");
    if (!user) {
        return c.json({ success: false, error: "Unauthorized: Access denied" }, 401);
    }

    return c.json({
        success: true,
        data: {
            id: user._id.toString(),
            clerkId: user.clerkId,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
        },
    }, 200);
});
