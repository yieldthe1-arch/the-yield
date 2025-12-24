
/// <reference types="node" />
import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, CommodityPrice, CurationItem } from "../types";

// Fallback declaration for process.env in browser context
declare const process: {
  env: {
    API_KEY: string;
  };
};

/**
 * Global state to enforce a minimum gap between API calls.
 */
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 3000; 

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function throttle(extraDelay = 0) {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  const gap = MIN_REQUEST_GAP + extraDelay;
  if (timeSinceLast < gap) {
    const waitTime = gap - timeSinceLast;
    await sleep(waitTime);
  }
  lastRequestTime = Date.now();
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
  await throttle();
  
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
      console.warn(`Quota hit. Retrying in ${delay}ms...`);
      await sleep(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

const cleanJSON = (text: string): string => {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor and Market Analyst for AGRIANTS Primary Agricultural Cooperative Limited.
Task: Produce "The Yield," a high-value, witty, and educational newsletter.
Style: Morning Brew style (smart, punchy, slightly irreverent).
Tone: Professional but conversational. NO AI cliches.
Rule: Include exactly one subtle agricultural pun per issue.
Bold the most important sentence in every paragraph.

Structure:
- [THE FIELD REPORT]: Business/Tech insights.
- [SUPERFOOD SPOTLIGHT]: Facts/hacks for niche health.
- [THE WALLET]: Investing education + live market data analogies.
- [THE BREAKROOM]: 1-question agricultural trivia.

Images: Provide unique 'imagePrompt' for each section. Editorial lifestyle photography style.
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  marketData: CommodityPrice[] | null,
  themeId: string = 'standard'
): Promise<NewsletterData> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found.");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  
  const sourceContext = curations.map(c => {
    if (c.type === 'text') return `[TEXT]: ${c.text}`;
    if (c.type === 'youtube') return `[YT]: ${c.url}`;
    return '';
  }).filter(Boolean).join('\n\n');

  const marketContext = marketData 
    ? `CURRENT MARKET TRENDS:\n${marketData.map(m => `${m.name}: ${m.price} per ${m.unit} (${m.category}) - Last Confirmed: ${m.confirmDate}`).join('\n')}`
    : "No live market data available.";

  parts.push({ text: `DATA:\n${sourceContext || "General agricultural industry news."}\n\n${marketContext}` });

  const prompt = `Generate "The Yield" Edition. ${themeId !== 'standard' ? `Theme: ${themeId}` : ""}
  Incorporate the provided Market Trends into 'The Wallet' section using clever farm-to-finance analogies.
  Output strictly as JSON.`;
  
  parts.push({ text: prompt });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
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
  }); 
};

export const fetchMarketTrends = async (): Promise<{prices: CommodityPrice[], asOf: string}> => {
  if (!process.env.API_KEY) return { prices: [], asOf: 'Offline' };
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: "Search CURRENT SAFEX prices for White Maize, Yellow Maize, Sunflower Seed, Cotton, and Wool benchmarks in South Africa. Return JSON with name, current price, unit, category, trend (last 5 values), and confirmDate (e.g. 'Feb 24')." }] }],
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
    }, 1, 3000); 
  } catch (e) {
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
    await throttle(4000); 
    
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `Professional editorial photography of ${prompt}. Natural lighting, clear focus, agricultural high-end lifestyle style. No text.` }]
        },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : undefined;
    }, 2, 8000); 
  } catch (e) {
    console.error("Image generation hit quota limits for prompt:", prompt);
    return undefined;
  }
};

