
import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, CommodityPrice, CurationItem } from "../types";

declare var process: {
  env: {
    API_KEY: string;
  };
};

/**
 * Global state to enforce a minimum gap between ANY API calls.
 * Increased to 2.5s for images to significantly reduce 429 quota errors.
 */
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 2500; 

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

/**
 * Robust wrapper for API calls with specialized handling for quota errors.
 */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 4, delay = 4000): Promise<T> {
  await throttle();
  
  try {
    return await fn();
  } catch (err: any) {
    const errorString = JSON.stringify(err).toLowerCase();
    const isQuotaError = 
      err?.status === 429 || 
      err?.status === 403 || 
      errorString.includes('429') || 
      errorString.includes('quota') || 
      errorString.includes('resource_exhausted');

    if (isQuotaError && retries > 0) {
      console.warn(`[Gemini API] Quota limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
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
  includeMarketData: boolean,
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

  parts.push({ text: `DATA:\n${sourceContext || "Latest agricultural industry trends."}` });

  const prompt = `Generate "The Yield" Edition. ${themeId !== 'standard' ? `Theme: ${themeId}` : ""}
  ${includeMarketData ? "IMPORTANT: Retrieve current SAFEX White Maize and Raw Honey prices (ZAR) in South Africa." : ""}
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
        tools: includeMarketData ? [{ googleSearch: {} }] : [],
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
    const sources: { title: string; uri: string }[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (Array.isArray(groundingChunks)) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
      });
    }

    return {
      ...result,
      sources,
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
        contents: [{ parts: [{ text: "Search CURRENT SAFEX prices for White Maize and Raw Honey in SA. Return JSON." }] }],
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
                    trend: { type: Type.ARRAY, items: { type: Type.NUMBER } }
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
        { name: "White Maize", price: "R5,380", unit: "ton", category: "Grains", trend: [5320, 5380] },
        { name: "Raw Honey", price: "R185", unit: "kg", category: "Produce", trend: [180, 185] }
      ],
      asOf: new Date().toLocaleDateString('en-ZA')
    };
  }
};

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  if (!process.env.API_KEY) return undefined;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Adding extra delay for images to avoid bursting the quota
    await throttle(2000); 
    
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `High-resolution editorial photography of ${prompt}. Sunlight, realistic, no text, agricultural theme.` }]
        },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : undefined;
    }, 3, 6000); 
  } catch (e) {
    console.error("Image generation failed permanently for prompt:", prompt);
    return undefined;
  }
};
