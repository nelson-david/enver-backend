import { Hono } from "hono";
import { ActivityLog, Project, User } from "../../database/schema.js";

export const activityRoutes = new Hono();

// GET /api/v1/activity/:projectId
// Gets activity logs for a project
activityRoutes.get("/:projectId", async (c) => {
    const user = c.get("user");
    if (!user || !user._id) {
        return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const projectId = c.req.param("projectId");

    const project = await Project.findOne({ projectId });
    if (!project) {
        return c.json({ success: false, error: "Project not found" }, 404);
    }

    // Check if user is a member or owner
    const isMember = project.members.some(
        (m) => m.userId?.toString() === user._id.toString()
    );
    const isOwner = project.ownerId?.toString() === user._id.toString();

    if (!isMember && !isOwner) {
        return c.json(
            { success: false, error: "Forbidden: You do not have access to this project" },
            403,
        );
    }

    const logs = await ActivityLog.find({ projectId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate({
            path: "userId",
            select: "name email imageUrl",
            model: User,
        })
        .lean();

    const formattedLogs = logs.map((log: any) => ({
        id: log._id,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
        user: log.userId ? {
            name: log.userId.name,
            email: log.userId.email,
            imageUrl: log.userId.imageUrl,
        } : null,
    }));

    return c.json({
        success: true,
        data: formattedLogs,
    });
});
