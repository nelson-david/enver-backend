import { Context } from "hono";

export function handleGlobalErrors(err: Error, c: Context) {
    console.error("Unhandled Server Error:", err);

    const response = {
        success: false,
        message:
            process.env.NODE_ENV === "production"
                ? "An unexpected internal server error occurred."
                : err.message,
    };

    return c.json(response, 500);
}
