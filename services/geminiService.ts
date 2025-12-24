
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
Style: Morning Brew style. Smart, slightly irreverent, high-value.
Tone: Professional but conversational. Avoid GPT-isms.
Rule: Include exactly one subtle agricultural pun per issue.
Imagery: Every section must include a high-quality 'imagePrompt'. These prompts should be extremely detailed, describing cinematic lighting, professional agricultural photography style, 8k resolution, and specific South African agricultural contexts.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business insights for farmers.
- [SUPERFOOD SPOTLIGHT]: Facts and recipes for niche health items.
- [THE WALLET]: Investing education + live market data. Use a farm analogy for finance.
- [THE BREAKROOM]: 1-question agricultural trivia.
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

  const themeContext = themeId !== 'standard' ? `Special Edition Context: This edition honors ${themeId.replace(/_/g, ' ')}. Please integrate historical facts and the spirit of this UN International Day into the narratives.` : "";

  const prompt = `Write today's edition of "The Yield". 
  ${themeContext}
  ${includeMarketData ? "Search Google for today's (latest reported) South African SAFEX prices (White Maize, Yellow Maize, Wheat, Sunflower Seeds, Soya Beans) and Raw Honey (ZAR). Ensure the 'The Wallet' section includes these exact live figures as reported today. Mention the date these prices were recorded." : "Use estimated benchmarks for grains (Maize, Wheat, Soya) and fibers (Cotton) based on recent trends."}`;
  
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
            marketDate: { type: Type.STRING, description: "The date the reported market prices were recorded." }
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
      contents: [{ parts: [{ text: "Search Google: CURRENT latest SAFEX prices for White Maize, Yellow Maize, Wheat, Sunflower Seeds, Soya Beans (ZAR/ton) as of today. Also latest SA Raw Honey prices. Return as JSON object with 'prices' (array) and 'asOf' (string date)." }] }],
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
  { name: "Cotton Lint", price: "R42.50", unit: "per lb", category: "Fibers", trend: [41, 42, 42.5] },
  { name: "Raw Honey", price: "R185", unit: "per kg", category: "Produce", trend: [175, 185] }
];

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    // Switching to Gemini 2.5 Flash Image for free tier compatibility
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Professional editorial agricultural photography for a high-end newsletter. Cinematic lighting, photorealistic, sharp focus. Scene: ${prompt}` }]
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
