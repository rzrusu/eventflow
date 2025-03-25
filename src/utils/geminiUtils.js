import { getGenerativeModel } from "firebase/vertexai";
import { vertexAI } from "../../functions/firebase";

// Helper function to beautify text content with Gemini 2.0 Flash
export const beautifyContent = async (content) => {
  if (!content || content.trim() === '') {
    return '';
  }

  try {
    // Create a model instance with Gemini 2.0 Flash
    const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash", temperature: 0.1, maxOutputTokens: 1024 });

    // Define the prompt for text beautification
    const prompt = `
      Your task is to improve the following text by:
      - Fixing any grammatical or spelling errors
      - Making the writing more engaging and expressive
      - Improving coherence and flow
      - Making it easier to read
      
      Important instructions:
      - Maintain the original meaning and intent
      - Do not add fancy words or phrases that would be hard for non-bilingual readers to understand
      - Keep approximately the same length
      - Do not add new information that wasn't in the original
      - Return only the improved text without explanations
      
      Text to improve:
      ${content}
    `;

    // Call the model to generate improved text
    const result = await model.generateContent(prompt);

    const response = result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error beautifying content with Gemini:", error);
    throw new Error("Failed to beautify content. Please try again later.");
  }
}; 