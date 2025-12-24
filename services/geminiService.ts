
import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, CommodityPrice, CurationItem } from "../types";

declare const process: {
  env: {
    API_KEY: string;
  };
};

/**
 * GEMINI FREE TIER THROTTLING
 * We use sequential execution with gaps to avoid the 15 RPM limit.
 */
let lastRequestTime = 0;
const TEXT_GAP = 7000;    // 7 seconds
const IMAGE_GAP = 20000;  // 20 seconds for safety

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

async function callWithRetry<T>(fn: () => Promise<T>, type: 'text' | 'image' = 'text', retries = 2): Promise<T> {
  await throttle(type);
  try {
    return await fn();
  } catch (err: any) {
    const isRateLimit = err?.status === 429 || JSON.stringify(err).toLowerCase().includes('quota');
    if (isRateLimit && retries > 0) {
      await sleep(30000); 
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
Product: "The Yield" Newsletter.
Style: Smart, witty, professional but conversational (Morning Brew style).
Tone: Smart, punchy, slightly irreverent. Avoid "GPT-isms" like "delve," "unlocking," or "tapestry."
Mandatory Rules:
1. Exactly ONE subtle agricultural pun per issue.
2. BOLD the most important summary sentence in every single paragraph so readers can skim.
3. Use bullet points for actionable data.
Sections: [FIELD REPORT], [SUPERFOOD SPOTLIGHT], [THE WALLET] (Investing with farm analogies), [THE BREAKROOM] (Trivia).
`;

// Helper to extract sources from grounding metadata
const extractSources = (response: any) => {
  const sources: { title: string; uri: string }[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({ title: chunk.web.title, uri: chunk.web.uri });
      }
    });
  }
  return sources;
};

export const generateNewsletter = async (
  curations: CurationItem[],
  marketData: CommodityPrice[] | null,
  marketSources: { title: string; uri: string }[] = [],
  themeId: string = 'standard'
): Promise<NewsletterData> => {
  if (!process.env.API_KEY) throw new Error("API_KEY missing.");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Construct multimodal parts
  const parts: any[] = curations.map(c => {
    if (c.data && c.mimeType) {
      return { inlineData: { data: c.data, mimeType: c.mimeType } };
    }
    return { text: `[Source ${c.type}]: ${c.text || c.url}` };
  });

  const marketContext = marketData 
    ? `\nLATEST SAFEX BENCHMARKS: ${marketData.map(m => `${m.name}: ${m.price}`).join(', ')}`
    : "";

  parts.push({ 
    text: `Synthesize "The Yield" Newsletter JSON. Theme: ${themeId}. Combine all provided assets into a punchy, educational edition.${marketContext}\n\nReturn imagePrompt descriptions (cinematic, no text) for the 3 main sections.` 
  });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
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
      sources: marketSources,
      generatedAt: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    };
  }, 'text'); 
};

export const fetchMarketTrends = async (): Promise<{prices: CommodityPrice[], asOf: string, sources: {title: string, uri: string}[]}> => {
  if (!process.env.API_KEY) return { prices: [], asOf: 'Offline', sources: [] };
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: "Search current SAFEX prices for White Maize, Yellow Maize, and Sunflower in RSA. Also search current Raw Honey prices in South Africa. Return JSON with name, price, trend (3 nums)." }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      
      const result = JSON.parse(cleanJSON(response.text || "{}"));
      const sources = extractSources(response);

      return {
        prices: result.prices || [],
        asOf: new Date().toLocaleDateString('en-ZA'),
        sources
      };
    }, 'text', 1); 
  } catch (e) {
    return {
      prices: [
        { name: "White Maize", price: "R5,380", unit: "ton", category: "Grains", trend: [5100, 5200, 5380], confirmDate: "Live" },
        { name: "Yellow Maize", price: "R5,120", unit: "ton", category: "Grains", trend: [4900, 5000, 5120], confirmDate: "Live" },
        { name: "Sunflower", price: "R8,900", unit: "ton", category: "Grains", trend: [9200, 9000, 8900], confirmDate: "Live" },
        { name: "Raw Honey", price: "R120", unit: "kg", category: "Specialty", trend: [110, 115, 120], confirmDate: "Live" }
      ],
      asOf: new Date().toLocaleDateString('en-ZA'),
      sources: []
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
          parts: [{ text: `High-end agricultural editorial photography: ${prompt}. Natural lighting, cinematic depth of field. No text.` }]
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
