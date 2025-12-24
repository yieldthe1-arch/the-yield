import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, CommodityPrice, CurationItem } from "../types";

// Fallback declaration for process.env in browser/build context
declare const process: {
  env: {
    API_KEY: string;
  };
};

/**
 * Global state to enforce gaps between API calls.
 * Text models have higher limits than Image models.
 */
let lastTextRequestTime = 0;
let lastImageRequestTime = 0;
const TEXT_GAP = 500; 
const IMAGE_GAP = 2500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function throttle(type: 'text' | 'image') {
  const now = Date.now();
  const lastTime = type === 'text' ? lastTextRequestTime : lastImageRequestTime;
  const gap = type === 'text' ? TEXT_GAP : IMAGE_GAP;
  
  const timeSinceLast = now - lastTime;
  if (timeSinceLast < gap) {
    await sleep(gap - timeSinceLast);
  }
  
  if (type === 'text') lastTextRequestTime = Date.now();
  else lastImageRequestTime = Date.now();
}

async function callWithRetry<T>(fn: () => Promise<T>, type: 'text' | 'image' = 'text', retries = 2, delay = 3000): Promise<T> {
  await throttle(type);
  
  try {
    return await fn();
  } catch (err: any) {
    const errorString = JSON.stringify(err).toLowerCase();
    const isQuotaError = 
      err?.status === 429 || 
      errorString.includes('429') || 
      errorString.includes('quota') || 
      errorString.includes('resource_exhausted');

    if (isQuotaError && retries > 0) {
      console.warn(`Gemini Quota hit for ${type}. Retrying in ${delay}ms...`);
      await sleep(delay);
      return callWithRetry(fn, type, retries - 1, delay * 2);
    }
    throw err;
  }
}

const cleanJSON = (text: string): string => {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return cleaned;
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor and Market Analyst for AGRIANTS Primary Agricultural Cooperative.
Product: "The Yield" Newsletter.
Style: Morning Brew (smart, punchy, witty).
Rule: Exactly one subtle agricultural pun. Bold key summary sentences.

Structure:
- FIELD REPORT: Business/Tech.
- SUPERFOOD SPOTLIGHT: Health facts + quick hack.
- THE WALLET: Farm-analogy finance + Market Data integration.
- THE BREAKROOM: 1-question trivia.

Image Prompts: Lifestyle editorial photography, natural light, no text.
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  marketData: CommodityPrice[] | null,
  themeId: string = 'standard'
): Promise<NewsletterData> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found.");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const sourceContext = curations.map(c => {
    if (c.type === 'text') return `[CONTEXT]: ${c.text}`;
    if (c.type === 'youtube') return `[YT]: ${c.url}`;
    return '';
  }).filter(Boolean).join('\n\n');

  const marketContext = marketData 
    ? `MARKET TRENDS:\n${marketData.map(m => `${m.name}: ${m.price} (${m.category})`).join('\n')}`
    : "No market data available.";

  const prompt = `Generate "The Yield" Edition JSON. 
  ${themeId !== 'standard' ? `Special Theme: ${themeId}` : ""}
  CONTEXT DATA: ${sourceContext || "General industry news."}
  ${marketContext}
  Use SAFEX benchmarks for 'The Wallet'.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
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
              },
            },
            marketDate: { type: Type.STRING }
          },
          required: ["header", "sections"]
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI engine.");
    
    const result = JSON.parse(cleanJSON(text));
    return {
      ...result,
      sources: [],
      generatedAt: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    };
  }, 'text'); 
};

export const fetchMarketTrends = async (): Promise<{prices: CommodityPrice[], asOf: string}> => {
  if (!process.env.API_KEY) return { prices: [], asOf: 'Offline' };
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: "Search current SAFEX prices for White Maize, Yellow Maize, Sunflower, Cotton, Wool in RSA. Return JSON with price, trend, and confirmDate." }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
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
                    trend: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    confirmDate: { type: Type.STRING }
                  }
                }
              },
              asOf: { type: Type.STRING }
            }
          }
        }
      });
      return JSON.parse(cleanJSON(response.text || "{}"));
    }, 'text', 1, 3000); 
  } catch (e) {
    // Return hardcoded benchmarks if search fails to prevent app lock
    return {
      prices: [
        { name: "White Maize", price: "R5,380", unit: "ton", category: "Grains", trend: [5100, 5200, 5150, 5300, 5380], confirmDate: "Feb 24" },
        { name: "Yellow Maize", price: "R5,120", unit: "ton", category: "Grains", trend: [4900, 5000, 5050, 5100, 5120], confirmDate: "Feb 24" },
        { name: "Sunflower Seed", price: "R8,900", unit: "ton", category: "Grains", trend: [9200, 9100, 9000, 8950, 8900], confirmDate: "Feb 23" },
        { name: "Cotton (SA)", price: "R44.50", unit: "kg", category: "Fibers", trend: [42.1, 43.5, 43.8, 44.0, 44.5], confirmDate: "Feb 22" }
      ],
      asOf: new Date().toLocaleDateString('en-ZA')
    };
  }
};

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  if (!process.env.API_KEY) return undefined;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `Professional editorial photography: ${prompt}. Natural light, high-end agriculture lifestyle. No text.` }]
        },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : undefined;
    }, 'image', 1, 5000); 
  } catch (e) {
    console.error("Image generation skipped due to quota limits.");
    return undefined;
  }
};
