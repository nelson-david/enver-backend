import crypto from "node:crypto";

function generateRandomCustomId(): string {
    const timestamp = Date.now().toString(36); // Base36 encoded timestamp
    const randomHex = crypto.randomBytes(3).toString("hex"); // 6 random hex chars
    return `user_${timestamp}${randomHex}`; // e.g., user_m2x8k9a1f4b2
}

export { generateRandomCustomId };
