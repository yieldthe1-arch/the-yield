
import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, GroundingChunk, CommodityPrice, CurationItem } from "../types";

declare var process: {
  env: {
    API_KEY: string;
  };
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor and Market Analyst for AGRIANTS Primary Agricultural Cooperative Limited.
Task: Produce "The Yield," a smart, punchy, and professional newsletter.
Style: Morning Brew style (smart, witty, educational, slightly irreverent).
Tone: Professional but conversational. Avoid generic AI fluff like "delve" or "tapestry."
Rule: Include exactly one subtle agricultural pun per issue.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business insights for farmers.
- [SUPERFOOD SPOTLIGHT]: Facts and recipes for niche health items.
- [THE WALLET]: Investing education + live market data. Use a farm analogy for finance.
- [THE BREAKROOM]: A 1-question agricultural or food history trivia.

Imagery Instruction:
Every section MUST include a highly specific 'imagePrompt'.
- Prompt for: Cinematic editorial photography, high-resolution, photorealistic.
- Subject: Describe the subject clearly in an agricultural or culinary context.
- Lighting: Mention 'soft morning sun' or 'vivid natural lighting'.
- Restriction: Explicitly state 'No text, no letters, no logos in the image.'
- Goal: Create a visual that acts as a lead image for the section's headline.
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

  const themeContext = themeId !== 'standard' ? `Special Edition: This issue honors ${themeId.replace(/_/g, ' ')}.` : "";

  const prompt = `Write today's edition of "The Yield". 
  ${themeContext}
  ${includeMarketData ? "Search Google for latest SAFEX grain prices (White/Yellow Maize, Wheat, Soya) and Raw Honey prices in South Africa (ZAR). Include these in 'The Wallet' with the DATE they were recorded." : "Use current market estimates."}`;
  
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
            marketDate: { type: Type.STRING }
          },
          required: ["header", "sections"]
        }
      },
    });
  };

  try {
    const response = await executeRequest(includeMarketData);
    if (!response.text) throw new Error("Empty response from AI.");
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
  } catch (e: any) {
    if (e.message?.includes('429')) {
      const fallback = await executeRequest(false);
      return { ...JSON.parse(fallback.text || "{}"), sources: [], generatedAt: new Date().toLocaleDateString() };
    }
    throw e;
  }
};

export const fetchMarketTrends = async (): Promise<{prices: CommodityPrice[], asOf: string}> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { prices: getFallbackMarketData(), asOf: "Recent Benchmarks" };
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: "Search latest SAFEX prices (Maize, Wheat, Soya) and Raw Honey in South Africa. Return JSON: { prices: [], asOf: '' }" }] }],
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
    return { prices: data.prices || getFallbackMarketData(), asOf: data.asOf || new Date().toLocaleDateString() };
  } catch {
    return { prices: getFallbackMarketData(), asOf: "Current Benchmarks" };
  }
};

const getFallbackMarketData = (): CommodityPrice[] => [
  { name: "White Maize", price: "R5,420", unit: "per ton", category: "Grains", trend: [5200, 5350, 5420] },
  { name: "Raw Honey", price: "R185", unit: "per kg", category: "Produce", trend: [175, 185] }
];

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `${prompt}. High-quality editorial photography. NO TEXT.` }]
      },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) {
    console.error("Image API Error:", e);
  }
  return undefined;
};
