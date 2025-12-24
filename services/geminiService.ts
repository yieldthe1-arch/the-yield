import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, GroundingChunk, CommodityPrice, CurationItem } from "../types";

// Ensure process is recognized by the compiler
declare var process: {
  env: {
    API_KEY: string;
  };
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor and Market Analyst for AGRIANTS Primary Agricultural Cooperative Limited.
Task: Produce "The Yield," a high-value, witty, and educational newsletter.
Style: Morning Brew / Tech Brew aesthetic. Smart, punchy, irreverent.
Tone: Professional but conversational. Avoid "GPT-isms" like "delve" or "tapestry".
Rule: Every issue must contain exactly one subtle agricultural pun.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business insights for farmers.
- [SUPERFOOD SPOTLIGHT]: Facts and recipes for niche health items.
- [THE WALLET]: Investing education + live market data. Explain a financial concept using a farm analogy.
- [THE BREAKROOM]: A 1-question trivia quiz about agriculture or food history.
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  includeMarketData: boolean,
  recognitionDay?: string
): Promise<NewsletterData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY environment variable is not defined.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [];
  curations.forEach(item => {
    if (item.type === 'text' && item.text) {
      parts.push({ text: `User Content: ${item.text}` });
    } else if (item.type === 'youtube' && item.url) {
      parts.push({ text: `YouTube Insights needed from: ${item.url}` });
    } else if (item.data && item.mimeType) {
      parts.push({
        inlineData: {
          data: item.data.split(',')[1],
          mimeType: item.mimeType
        }
      });
    }
  });

  const prompt = `Please write the latest edition of "The Yield" based on the provided content. 
  ${includeMarketData ? "Search for today's White Maize (SAFEX) and Raw Honey prices in South Africa and include them in the wallet section." : ""}
  Context: ${recognitionDay || 'General Edition'}`;
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      tools: includeMarketData ? [{ googleSearch: {} }] : [],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          header: {
            type: Type.OBJECT,
            properties: { 
              vibeCheck: { type: Type.STRING } 
            },
            required: ["vibeCheck"]
          },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["id", "title", "content", "imagePrompt"]
            }
          }
        },
        required: ["header", "sections"]
      }
    },
  });

  if (!response.text) {
    throw new Error("No text returned from the model.");
  }

  const result = JSON.parse(response.text);
  const sources: { title: string; uri: string }[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[];
  
  if (groundingChunks) {
    groundingChunks.forEach(chunk => {
      if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
    });
  }

  return {
    ...result,
    sources,
    generatedAt: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  };
};

export const fetchMarketTrends = async (): Promise<CommodityPrice[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return [];
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: "Current SAFEX White Maize and South African Raw Honey prices today." }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.STRING },
              unit: { type: Type.STRING },
              category: { type: Type.STRING },
              trend: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ["name", "price", "unit", "category", "trend"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Market fetch error:", e);
    return [];
  }
};

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: `A clean Morning Brew style illustration for a newsletter: ${prompt}` }] }],
      config: { 
        imageConfig: { 
          aspectRatio: "16:9" 
        } 
      }
    });
    
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation failed", e);
  }
  return undefined;
};
