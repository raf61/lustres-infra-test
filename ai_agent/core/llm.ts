import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AI_AGENT_CONFIG } from "./config";

let instance: ChatGoogleGenerativeAI | null = null;

export const getLLM = (): ChatGoogleGenerativeAI => {
    if (instance) return instance;

    // Carrega do .env via config centralizada
    const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GOOGLE_API_KEY) {
        throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY in environment variables");
    }

    instance = new ChatGoogleGenerativeAI({
        apiKey: GOOGLE_API_KEY,
        model: "gemini-2.5-flash",
        temperature: AI_AGENT_CONFIG.TEMPERATURE,
        maxOutputTokens: 2048,
    });

    return instance;
};
