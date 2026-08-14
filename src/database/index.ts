import mongoose from "mongoose";
import { config } from "../config.js";

const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(config.databaseUri, {
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
        } as mongoose.ConnectOptions);
        console.log(`✅ MongoDB Connected`);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;
