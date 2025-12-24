
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
Style: Morning Brew style (smart, witty, educational, slightly irreverent).
Tone: Professional but conversational. Avoid "GPT-isms" like "delve" or "tapestry."
Rule: Include exactly one subtle agricultural pun per issue.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business insights for farmers.
- [SUPERFOOD SPOTLIGHT]: Facts and recipes for niche health items.
- [THE WALLET]: Investing education + live market data found via search. Use a farm analogy for finance.
- [THE BREAKROOM]: A 1-question agricultural or food history trivia.

Imagery Instruction:
Every section MUST include a highly specific 'imagePrompt'.
- Prompt for cinematic, editorial photography.
- Specify lighting (e.g., 'golden hour', 'soft studio lighting').
- Mention the subject clearly (e.g., 'A macro shot of organic South African Raw Honey being drizzled').
- Explicitly state 'Avoid any text, words, or letters in the image.'
- Style: 'Clean, professional editorial photography, high resolution, photorealistic.'
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  includeMarketData: boolean,
  themeId: string = 'standard'
): Promise<NewsletterData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not configured.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [];
  
  curations.forEach(item => {
    if (item.type === 'text' && item.text) {
      parts.push({ text: `Source Context: ${item.text}` });
    } else if (item.type === 'youtube' && item.url) {
      parts.push({ text: `Analyze insights from this video: ${item.url}` });
    } else if ((item.type === 'image' || item.type === 'audio' || item.type === 'video') && item.data && item.mimeType) {
      parts.push({
        inlineData: {
          data: item.data,
          mimeType: item.mimeType
        }
      });
      parts.push({ text: `Extract agricultural insights from this ${item.type} attachment.` });
    }
  });

  const themeContext = themeId !== 'standard' ? `Special Edition Context: This edition honors ${themeId.replace(/_/g, ' ')}. Please integrate the spirit of this event into the narratives.` : "";

  const prompt = `Write today's edition of "The Yield". 
  ${themeContext}
  ${includeMarketData ? "Search Google for today's (latest reported) South African SAFEX prices (White Maize, Yellow Maize, Wheat, Sunflower Seeds, Soya Beans) and Raw Honey (ZAR). Ensure the 'The Wallet' section includes these exact figures and the DATE they were recorded." : "Use estimated benchmarks for South African grains."}`;
  
  parts.push({ text: prompt });

  const executeRequest = async (useSearch: boolean) => {
    return await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        tools: useSearch ? [{ googleSearch: {} }] : [],
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
            },
            marketDate: { type: Type.STRING, description: "The date the reported market prices were recorded (e.g., 'March 10, 2025')." }
          },
          required: ["header", "sections"]
        }
      },
    });
  };

  try {
    let response = await executeRequest(includeMarketData);
    return processResponse(response);
  } catch (e: any) {
    if (e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED') {
      console.warn("Search limit reached, falling back to standard generation.");
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

export const fetchMarketTrends = async (): Promise<{prices: CommodityPrice[], asOf: string}> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { prices: getFallbackMarketData(), asOf: "Recent Benchmarks" };
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: "Search Google: CURRENT latest SAFEX prices for White Maize, Yellow Maize, Wheat, Sunflower Seeds, Soya Beans (ZAR/ton) as of today. Also latest South African Raw Honey prices. Return as JSON with 'prices' (array) and 'asOf' (date string)." }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prices: {
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
            },
            asOf: { type: Type.STRING }
          },
          required: ["prices", "asOf"]
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}");
    return {
      prices: data.prices && data.prices.length > 0 ? data.prices : getFallbackMarketData(),
      asOf: data.asOf || new Date().toLocaleDateString()
    };
  } catch (e: any) {
    return { prices: getFallbackMarketData(), asOf: "Recent Benchmarks" };
  }
};

const getFallbackMarketData = (): CommodityPrice[] => [
  { name: "White Maize", price: "R5,420", unit: "per ton", category: "Grains", trend: [5200, 5350, 5420] },
  { name: "Yellow Maize", price: "R5,150", unit: "per ton", category: "Grains", trend: [5100, 5120, 5150] },
  { name: "Wheat", price: "R6,890", unit: "per ton", category: "Grains", trend: [6700, 6800, 6890] },
  { name: "Soya Beans", price: "R9,200", unit: "per ton", category: "Grains", trend: [8900, 9100, 9200] },
  { name: "Sunflower", price: "R8,400", unit: "per ton", category: "Oilseeds", trend: [8200, 8300, 8400] },
  { name: "Raw Honey", price: "R185", unit: "per kg", category: "Produce", trend: [175, 185] }
];

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    // gemini-2.5-flash-image is part of the "free tier" (nano banana) models
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `${prompt}. Clean editorial photography style. High detail. photorealistic. NO TEXT IN IMAGE.` }]
      },
      config: { 
        imageConfig: { 
          aspectRatio: "16:9"
        }
      }
    });
    
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts;
      if (parts) {
        // Iterate through parts to find the image part as per guidelines
        for (const part of parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    }
  } catch (e) {
    console.error("Flash Image generation failed:", e);
  }
  return undefined;
};
