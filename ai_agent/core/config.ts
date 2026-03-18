import dotenv from "dotenv";

dotenv.config();

export const AI_AGENT_CONFIG = {
    // Model Settings
    MODEL: process.env.AI_AGENT_MODEL || "llama-3.3-70b-versatile",
    TEMPERATURE: Number(process.env.AI_AGENT_TEMPERATURE || 0),
    // Keys
    GOOGLE_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,

    // Graph Settings
    SUMMARY_TRIGGER_COUNT: Number(process.env.AI_AGENT_SUMMARY_TRIGGER || 20),
    HISTORY_KEEP_COUNT: Number(process.env.AI_AGENT_HISTORY_KEEP || 5),
    ROUTER_MESSAGES_TO_ANALYZE: Number(process.env.AI_AGENT_ROUTER_MESSAGES || 3),

    // Queue Settings
    QUEUE_NAME: "ai-agent-input",
};
