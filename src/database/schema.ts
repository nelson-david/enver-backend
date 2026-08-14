import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
    clerkId: string;
    customId: string;
    email: string;
    name: string;
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        clerkId: { type: String, required: true, unique: true, index: true },
        customId: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        imageUrl: { type: String, required: false },
    },
    { timestamps: true },
);

export const User = model<IUser>("User", userSchema);

export interface IEnvEnvironment extends Document {
    userId: Types.ObjectId;
    projectId: string;
    environment: "PRODUCTION" | "STAGING" | "DEVELOPMENT";
    ciphertext: string; // Base64 encrypted secrets payload
    iv: string; // Base64 Initialization Vector
    salt: string; // Base64 Salt
    createdAt: Date;
    updatedAt: Date;
}

const envEnvironmentSchema = new Schema<IEnvEnvironment>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        projectId: { type: String, required: true, index: true },
        environment: {
            type: String,
            enum: ["PRODUCTION", "STAGING", "DEVELOPMENT"],
            required: true,
        },
        ciphertext: { type: String, required: true },
        iv: { type: String, required: true },
        salt: { type: String, required: true },
    },
    { timestamps: true },
);

// Compound index for fast lookup by project and environment scope
envEnvironmentSchema.index({ projectId: 1, environment: 1 });

export const EnvEnvironment = model<IEnvEnvironment>(
    "EnvEnvironment",
    envEnvironmentSchema,
);

export interface ISecretShare extends Document {
    projectId: string;
    shareIndex: number;
    shareData: string;
    createdAt: Date;
}

const secretShareSchema = new Schema<ISecretShare>(
    {
        projectId: { type: String, required: true, index: true },
        shareIndex: { type: Number, required: true },
        shareData: { type: String, required: true },
    },
    { timestamps: true },
);

export const SecretShare = model<ISecretShare>(
    "SecretShare",
    secretShareSchema,
);

export interface IProject extends Document {
    projectId: string;
    ownerId: Types.ObjectId;
    members: Array<{
        userId: Types.ObjectId;
        role: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
    {
        projectId: { type: String, required: true, unique: true },
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        members: [
            {
                userId: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                role: { type: String, required: true, default: "member" },
            },
        ],
    },
    { timestamps: true },
);

export const Project = model<IProject>("Project", projectSchema);

export interface IApiToken extends Document {
    userId: Types.ObjectId;
    name: string;
    tokenHash: string;
    displayPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
    ipAddress: string; // New field for IP binding
}

const apiTokenSchema = new Schema<IApiToken>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        tokenHash: { type: String, required: true, unique: true, index: true },
        displayPrefix: { type: String, required: true },
        scopes: {
            type: [String],
            enum: ["read:secrets", "write:secrets", "admin"],
            default: ["read:secrets"],
        },
        expiresAt: { type: Date, default: null },
        lastUsedAt: { type: Date, default: null },
        ipAddress: { type: String }, // Added IP address field
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

export const ApiToken = model<IApiToken>("ApiToken", apiTokenSchema);

export interface IActivityLog extends Document {
    projectId: string;
    userId: Types.ObjectId;
    action: string;
    details: string;
    createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
    {
        projectId: { type: String, required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        action: { type: String, required: true },
        details: { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

export const ActivityLog = model<IActivityLog>(
    "ActivityLog",
    activityLogSchema,
);
