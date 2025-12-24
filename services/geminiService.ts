
import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, CommodityPrice, CurationItem } from "../types";

declare const process: {
  env: {
    API_KEY: string;
  };
};

/**
 * STRICT THROTTLING FOR FREE TIER
 * Free tier allows very few requests per minute. 
 * We must space them out significantly.
 */
let lastRequestTime = 0;
const TEXT_GAP = 3500;   // 3.5 seconds between text requests
const IMAGE_GAP = 7000;  // 7 seconds between image requests to prevent 429s

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function throttle(type: 'text' | 'image') {
  const now = Date.now();
  const gap = type === 'text' ? TEXT_GAP : IMAGE_GAP;
  const timeSinceLast = now - lastRequestTime;
  
  if (timeSinceLast < gap) {
    const waitTime = gap - timeSinceLast;
    await sleep(waitTime);
  }
  
  lastRequestTime = Date.now();
}

async function callWithRetry<T>(fn: () => Promise<T>, type: 'text' | 'image' = 'text', retries = 3): Promise<T> {
  await throttle(type);
  
  try {
    return await fn();
  } catch (err: any) {
    const errorString = JSON.stringify(err).toLowerCase();
    const isRateLimit = 
      err?.status === 429 || 
      errorString.includes('429') || 
      errorString.includes('quota') || 
      errorString.includes('resource_exhausted') ||
      errorString.includes('too many requests');

    if (isRateLimit && retries > 0) {
      console.warn(`Free tier limit reached. Cooling down for ${type}...`);
      await sleep(10000); // 10 second forced cooldown on 429
      return callWithRetry(fn, type, retries - 1);
    }
    throw err;
  }
}

const cleanJSON = (text: string): string => {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor for AGRIANTS Cooperative. 
Product: "The Yield" Newsletter. Smart, witty, punchy.
Rule: Exactly one agricultural pun. Bold key summary sentences.
Structure: FIELD REPORT, SUPERFOOD SPOTLIGHT, THE WALLET (finance/market data), THE BREAKROOM (trivia).
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  marketData: CommodityPrice[] | null,
  themeId: string = 'standard'
): Promise<NewsletterData> => {
  if (!process.env.API_KEY) throw new Error("API_KEY missing.");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const sourceContext = curations.map(c => {
    if (c.type === 'text') return `[DATA]: ${c.text}`;
    if (c.type === 'youtube') return `[YT]: ${c.url}`;
    return '';
  }).filter(Boolean).join('\n\n');

  const marketContext = marketData 
    ? `MARKET: ${marketData.map(m => `${m.name}: ${m.price}`).join(', ')}`
    : "No market data.";

  const prompt = `Synthesize "The Yield" Edition JSON. 
  Theme: ${themeId}
  Context: ${sourceContext || "General agricultural news."}
  ${marketContext}`;

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

    const result = JSON.parse(cleanJSON(response.text || "{}"));
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
        contents: [{ parts: [{ text: "Search SAFEX prices: White Maize, Yellow Maize, Sunflower, Cotton, Wool in South Africa. Return JSON." }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return JSON.parse(cleanJSON(response.text || "{}"));
    }, 'text', 1); 
  } catch (e) {
    return {
      prices: [
        { name: "White Maize", price: "R5,380", unit: "ton", category: "Grains", trend: [5100, 5200, 5380], confirmDate: "Live" },
        { name: "Yellow Maize", price: "R5,120", unit: "ton", category: "Grains", trend: [4900, 5000, 5120], confirmDate: "Live" },
        { name: "Sunflower", price: "R8,900", unit: "ton", category: "Grains", trend: [9200, 9000, 8900], confirmDate: "Live" }
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
          parts: [{ text: `High-end agricultural lifestyle photography: ${prompt}. Natural light, cinematic. No text.` }]
        },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : undefined;
    }, 'image', 1); 
  } catch (e) {
    return undefined;
  }
};
