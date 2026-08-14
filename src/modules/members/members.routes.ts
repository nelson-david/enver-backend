import { Hono } from "hono";
import { Project, User, IProject, ActivityLog } from "../../database/schema.js";
import { Types } from "mongoose";

export const membersRoutes = new Hono();

// Helper to check if a user has admin/owner privileges on a project
const isAdmin = (project: IProject, userId: string | Types.ObjectId) => {
    const targetIdStr = userId.toString();

    if (project.ownerId?.toString() === targetIdStr) return true;

    return project.members.some(
        (m) =>
            m.userId?.toString() === targetIdStr &&
            (m.role === "admin" || m.role === "owner"),
    );
};

// GET /api/v1/projects/:projectId/members
// Gets all members of a project
membersRoutes.get("/:projectId/members", async (c) => {
    const user = c.get("user");
    if (!user || !user._id) {
        return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const projectId = c.req.param("projectId");

    const project = await Project.findOne({ projectId }).populate({
        path: "members.userId",
        select: "name email imageUrl",
        model: User,
    });

    if (!project) {
        return c.json({ success: false, error: "Project not found" }, 404);
    }

    // Check if user is a member or owner
    const isMember = project.members.some(
        (m) =>
            m.userId &&
            (m.userId as any)._id.toString() === user._id.toString(),
    );
    const isOwner = project.ownerId?.toString() === user._id.toString();

    if (!isMember && !isOwner) {
        return c.json(
            {
                success: false,
                error: "Forbidden: You do not have access to this project",
            },
            403,
        );
    }

    const formattedMembers = project.members.map((m: any) => ({
        id: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        imageUrl: m.userId.imageUrl,
        role: m.role,
        isOwner: project.ownerId?.toString() === m.userId._id.toString(),
    }));

    return c.json({
        success: true,
        data: formattedMembers,
    });
});

// POST /api/v1/projects/:projectId/members
// Adds a user to a project
membersRoutes.post("/:projectId/members", async (c) => {
    const user = c.get("user");
    if (!user || !user._id) {
        return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const projectId = c.req.param("projectId");
    const body = await c.req.json().catch(() => null);

    if (!body || !body.email || !body.role) {
        return c.json(
            { success: false, error: "Email and role are required" },
            400,
        );
    }

    const { email, role } = body;

    const project = await Project.findOne({ projectId });
    if (!project) {
        return c.json({ success: false, error: "Project not found" }, 404);
    }

    // Verify the requester is an owner or admin
    if (!isAdmin(project, user._id)) {
        return c.json(
            { success: false, error: "Forbidden: Admin privileges required" },
            403,
        );
    }

    // Look up the user by email
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
        return c.json(
            { success: false, error: "User must sign up first" },
            400,
        );
    }

    // Check if user is already a member
    const isAlreadyMember = project.members.some(
        (m) => m.userId?.toString() === targetUser._id.toString(),
    );

    if (isAlreadyMember) {
        return c.json(
            {
                success: false,
                error: "User is already a member of this project",
            },
            400,
        );
    }

    // Add the user to the project
    project.members.push({
        userId: targetUser._id as Types.ObjectId,
        role,
    });

    await project.save();

    // Log activity
    await ActivityLog.create({
        projectId: project.projectId,
        userId: user._id,
        action: "MEMBER_ADDED",
        details: `Added ${targetUser.email} as ${role}`,
    });

    return c.json({
        success: true,
        message: "Member added successfully",
        data: {
            projectId: project.projectId,
            membersCount: project.members.length,
        },
    });
});

// DELETE /api/v1/projects/:projectId/members/:email
// Removes a user from a project
membersRoutes.delete("/:projectId/members/:email", async (c) => {
    const user = c.get("user");
    if (!user || !user._id) {
        return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const projectId = c.req.param("projectId");
    const email = decodeURIComponent(c.req.param("email"));

    const project = await Project.findOne({ projectId });
    if (!project) {
        return c.json({ success: false, error: "Project not found" }, 404);
    }

    // Verify the requester is an owner or admin
    if (!isAdmin(project, user._id)) {
        return c.json(
            { success: false, error: "Forbidden: Admin privileges required" },
            403,
        );
    }

    // Look up the user to remove by email
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
        return c.json({ success: false, error: "User not found" }, 404);
    }

    // Prevent removing the owner
    if (project.ownerId?.toString() === targetUser._id.toString()) {
        return c.json(
            { success: false, error: "Cannot remove the project owner" },
            400,
        );
    }

    const initialLength = project.members.length;

    // Remove the user from the members array
    project.members = project.members.filter(
        (m) => m.userId?.toString() !== targetUser._id.toString(),
    );

    if (project.members.length === initialLength) {
        return c.json(
            { success: false, error: "User is not a member of this project" },
            404,
        );
    }

    await project.save();

    // Log activity
    await ActivityLog.create({
        projectId: project.projectId,
        userId: user._id,
        action: "MEMBER_REMOVED",
        details: `Removed ${targetUser.email} from project`,
    });

    return c.json({
        success: true,
        message: "Member removed successfully",
        data: {
            projectId: project.projectId,
            membersCount: project.members.length,
        },
    });
});
