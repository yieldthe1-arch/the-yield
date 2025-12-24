import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, GroundingChunk, CommodityPrice, CurationItem } from "../types";

declare var process: {
  env: {
    API_KEY: string;
  };
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor and Market Analyst for AGRIANTS Primary Agricultural Cooperative Limited.
Task: Produce "The Yield," a smart, punchy newsletter.
Style: Morning Brew. smart, slightly irreverent.
Tone: Professional but conversational. Avoid GPT-isms.
Rule: Include exactly one subtle agricultural pun per issue.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business insights for farmers.
- [SUPERFOOD SPOTLIGHT]: Facts and recipes for niche health items.
- [THE WALLET]: Investing education + live market data. Use a farm analogy for finance.
- [THE BREAKROOM]: 1-question agricultural trivia.
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  includeMarketData: boolean
): Promise<NewsletterData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not configured.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [];
  curations.forEach(item => {
    if (item.type === 'text' && item.text) {
      parts.push({ text: `Source Content: ${item.text}` });
    } else if (item.type === 'youtube' && item.url) {
      parts.push({ text: `Analyze insights from this video: ${item.url}` });
    }
  });

  const prompt = `Write today's edition of "The Yield". 
  ${includeMarketData ? "Use Google Search for today's South African White Maize (SAFEX) price per ton and Raw Honey price per kg (ZAR)." : "Use these benchmarks: White Maize R5420/t, Honey R185/kg."}`;
  
  parts.push({ text: prompt });

  const executeRequest = async (useSearch: boolean) => {
    return await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        tools: useSearch ? [{ googleSearch: {} }] : [],
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            header: {
              type: Type.OBJECT,
              properties: { vibeCheck: { type: Type.STRING } },
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
  };

  try {
    // Attempt with search first if requested
    let response = await executeRequest(includeMarketData);
    return processResponse(response);
  } catch (e: any) {
    // If search fails due to quota (429), retry without search automatically
    if (includeMarketData && (e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED')) {
      console.warn("Search quota hit during generation, falling back to static data.");
      let fallbackResponse = await executeRequest(false);
      return processResponse(fallbackResponse);
    }
    throw e;
  }
};

const processResponse = (response: any): NewsletterData => {
  if (!response.text) throw new Error("Model failed to generate content.");
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
  if (!apiKey) return getFallbackMarketData();
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: "Search Google: Current SAFEX White Maize price ZAR per ton and SA Raw Honey price ZAR per kg. Return ONLY a JSON array." }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
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
    
    const data = JSON.parse(response.text || "[]");
    return data.length > 0 ? data : getFallbackMarketData();
  } catch (e: any) {
    console.error("Market search failed:", e);
    // Return fallback instead of throwing to keep UI clean
    return getFallbackMarketData();
  }
};

const getFallbackMarketData = (): CommodityPrice[] => [
  { name: "White Maize", price: "R5,420", unit: "per ton", category: "Commodities", trend: [5200, 5350, 5400, 5380, 5420] },
  { name: "Raw Honey", price: "R185", unit: "per kg", category: "Commodities", trend: [175, 180, 182, 184, 185] }
];

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: `A professional, minimalist agricultural illustration: ${prompt}` }] }],
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation skipped.");
  }
  return undefined;
};
