import { GoogleGenAI } from "@google/genai";

const AI_SYSTEM_INSTRUCTION = `
You are a friendly, medical AI assistant for "Aman AI".
Your goal is to explain Service 5: "Blood Test AI Analysis".
Keep answers short, simple, and reassuring.
Avoid complex jargon. If you must use a technical term, explain it immediately with a simple analogy.
Key concepts to know:
- Biomarkers: Signals in your blood that tell us about your health (like cholesterol, glucose, inflammation markers).
- AI Pattern Recognition: Unlike a human doctor who looks at one number at a time, our AI looks at thousands of combinations to spot hidden trends.
- Predictive Health: We try to spot issues (like metabolic drift or inflammation) years before they become diseases.
- Doctor Review: AI highlights the risks, but a human doctor always makes the final call.
`;

let aiClient: GoogleGenAI | null = null;

export const getAiClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

export const sendMessageToAssistant = async (message: string, history: {role: string, parts: {text: string}[]}[] = []) => {
  const client = getAiClient();
  
  try {
    const chat = client.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: AI_SYSTEM_INSTRUCTION,
      },
      history: history
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("I'm having trouble connecting right now. Please try again later.");
  }
};