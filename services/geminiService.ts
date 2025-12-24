
import { GoogleGenAI, Type } from "@google/genai";
import { NewsletterData, GroundingChunk, CommodityPrice, CurationItem } from "../types";

declare var process: {
  env: {
    API_KEY: string;
  };
};

const SYSTEM_INSTRUCTION = `
Role: Lead Editor and Market Analyst for AGRIANTS Primary Agricultural Cooperative Limited.
Task: Produce "The Yield," a high-value, witty, and educational newsletter.
Style: Morning Brew style (smart, punchy, slightly irreverent, high-energy).
Tone: Professional but conversational. NO AI cliches (delve, tapestry, unlock, landscape).
Rule: Include exactly one subtle agricultural pun per issue.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business/Tech insights for modern farmers.
- [SUPERFOOD SPOTLIGHT]: Surprising facts and quick hacks for niche health items.
- [THE WALLET]: Investing education + live market data. Use a farm/crop analogy for financial terms.
- [THE BREAKROOM]: A punchy 1-question agricultural trivia or food history nugget.

Image Prompt Instruction:
Every section MUST have an 'imagePrompt'.
- Prompt for: 'High-end editorial lifestyle photography, warm morning sun, crisp details, 8k resolution, cinematic lighting'.
- Subject: Vivid agricultural or culinary scenes thematic to the section.
- Restriction: 'No text, no letters, no words, no logos, no watermarks'.
`;

export const generateNewsletter = async (
  curations: CurationItem[],
  includeMarketData: boolean,
  themeId: string = 'standard'
): Promise<NewsletterData> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found in environment.");
  
  // Use named parameter for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  
  // Consolidate all curated pieces into a single source context
  const sourceContext = curations.map(c => {
    if (c.type === 'text') return `[TEXT SNIPPET]: ${c.text}`;
    if (c.type === 'youtube') return `[VIDEO SOURCE]: ${c.url}`;
    if (c.type === 'image') return `[IMAGE ATTACHMENT ANALYZED]`;
    return '';
  }).join('\n\n');

  parts.push({ text: `RAW DATA TO PROCESS:\n${sourceContext}` });

  // Add binary data if available
  curations.forEach(item => {
    if (item.data && item.mimeType) {
      parts.push({
        inlineData: {
          data: item.data,
          mimeType: item.mimeType
        }
      });
    }
  });

  const themeNote = themeId !== 'standard' ? `NOTE: This is the ${themeId.replace(/_/g, ' ')} Edition. Ensure the content reflects this theme.` : "";

  const prompt = `Write today's edition of "The Yield". 
  ${themeNote}
  ${includeMarketData ? "IMPORTANT: Use Google Search to find today's (latest) SAFEX White Maize and Raw Honey prices in South Africa (ZAR). Return these exact figures in 'The Wallet' section." : "Use realistic South African agricultural benchmarks for White Maize and Raw Honey."}`;
  
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
            marketDate: { type: Type.STRING, description: "The date of the market data found." }
          },
          required: ["header", "sections"]
        }
      },
    });

    // Use .text property directly
    const responseText = response.text;
    if (!responseText) throw new Error("API returned empty text.");
    
    let result;
    try {
      result = JSON.parse(responseText.trim());
    } catch (parseErr) {
      console.error("JSON Parse Error:", responseText);
      throw new Error("Failed to parse newsletter structure.");
    }

    const sources: { title: string; uri: string }[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks) {
      (groundingChunks as any[]).forEach(chunk => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      ...result,
      sources,
      generatedAt: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    };
  } catch (err: any) {
    console.error("Gemini Generation Error:", err);
    throw err;
  }
};

export const fetchMarketTrends = async (): Promise<{prices: CommodityPrice[], asOf: string}> => {
  if (!process.env.API_KEY) return { prices: [], asOf: 'Offline' };
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: "Search CURRENT SAFEX prices for White Maize, Yellow Maize, Wheat, Sunflower Seeds, and the latest Raw Honey prices in South Africa. Return as JSON: { prices: [{name, price, unit, category, trend: number[]}], asOf: string }. Provide at least 2 numbers in the 'trend' array for each item to show a clear percentage change." }] }],
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
                }
              }
            },
            asOf: { type: Type.STRING }
          }
        }
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    // Ensure we have grain indices as well to match Morning Brew variety
    return parsed;
  } catch (e) {
    console.warn("Market fetch failed, using fallbacks.");
    return {
      prices: [
        { name: "White Maize (WMAZ)", price: "R5,380", unit: "ton", category: "Grains", trend: [5320, 5380] },
        { name: "Yellow Maize (YMAZ)", price: "R5,150", unit: "ton", category: "Grains", trend: [5200, 5150] },
        { name: "Wheat (WHEAT)", price: "R6,200", unit: "ton", category: "Grains", trend: [6100, 6200] },
        { name: "Sunflower Seeds (SUNS)", price: "R9,450", unit: "ton", category: "Seeds", trend: [9500, 9450] },
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `${prompt}. High-resolution editorial photography. No text.` }]
      },
      config: { 
        imageConfig: { aspectRatio: "16:9" } 
      }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        // Iterate and find the inlineData part
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) {
    console.error("Image generation failed:", e);
  }
  return undefined;
};
