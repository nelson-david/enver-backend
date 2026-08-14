import { Hono, Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Project } from "../../database/schema.js";

const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    environment: z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT"]).optional(),
});

export const projectRoutes = new Hono();

// POST /api/v1/projects
projectRoutes.post("/", zValidator("json", createProjectSchema), async (c) => {
    try {
        const user = c.get("user");
        if (!user) {
            return c.json(
                {
                    success: false,
                    error: "Unauthorized: Missing or invalid authentication token",
                },
                401,
            );
        }

        // Now TypeScript knows body is { name: string; environment?: ... }
        const body = c.req.valid("json");
        const projectId = body.name.toLowerCase().trim().replace(/\s+/g, "-");

        let project = await Project.findOne({ projectId });

        if (!project) {
            project = await Project.create({
                projectId,
                ownerId: user._id,
                members: [{ userId: user._id, role: "owner" }],
            });
        }

        return c.json(
            {
                success: true,
                message: "Project workspace initialized successfully",
                data: {
                    id: project.projectId,
                    name: project.projectId,
                },
            },
            201,
        );
    } catch (error) {
        console.error("Error creating project:", error);
        return c.json(
            { success: false, error: "Failed to initialize project" },
            500,
        );
    }
});
