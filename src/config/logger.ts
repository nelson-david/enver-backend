import winston from "winston";
import LokiTransport from "winston-loki";

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
        ),
    }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
];

// If Grafana Loki env variables are set, add LokiTransport
if (
    process.env.LOKI_URL &&
    process.env.LOKI_USER_ID &&
    process.env.LOKI_TOKEN
) {
    console.log("[LOGGER] 🚀 Grafana Loki transport enabled!");
    transports.push(
        new LokiTransport({
            host: process.env.LOKI_URL,
            basicAuth: `${process.env.LOKI_USER_ID}:${process.env.LOKI_TOKEN}`,
            labels: {
                app: "enver-server",
                env: process.env.NODE_ENV || "development",
            },
            json: true,
            replaceTimestamp: true,
            onConnectionError: (err) =>
                console.error("[LOGGER] Loki Connection Error:", err),
        }),
    );
} else {
    console.log(
        "[LOGGER] Grafana Loki transport disabled (missing env credentials).",
    );
}

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
    ),
    transports,
});

export default logger;
