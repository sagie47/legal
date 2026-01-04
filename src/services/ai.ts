import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const getSimpleCompletion = async (prompt: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (err: any) {
    const error = err as Error;
    console.error(`[AI] Gemini API Error: ${error.message}`, {
      name: error.name,
      cause: error.cause,
    });
    throw new Error('Failed to get completion from Gemini API.');
  }
};
