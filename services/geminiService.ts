
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
Style: Morning Brew style (smart, punchy, irreverent).
Tone: Professional but conversational. Avoid AI cliches like "delve" or "tapestry."
Pun Rule: Every issue must contain exactly one subtle agricultural pun.
Bold the most important sentence in every paragraph.

Newsletter Structure:
- [THE FIELD REPORT]: Business insights for farmers.
- [SUPERFOOD SPOTLIGHT]: Facts and recipes for niche health items.
- [THE WALLET]: Investing education + live market data. Use a farm analogy for financial concepts.
- [THE BREAKROOM]: A 1-question agriculture or food history quiz.

Image Prompt Instruction:
For every section, provide a highly descriptive 'imagePrompt'.
- Prompt for: 'Cinematic editorial photography, soft natural morning light, crisp focus, 8k resolution, photorealistic'.
- Context: Must be thematic to the section (e.g., 'A macro shot of organic raw honey drizzling', 'A modern green tractor in a golden wheat field').
- CRITICAL: Add 'No text, no letters, no logos in the image' to every prompt.
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
      parts.push({ text: `Context: ${item.text}` });
    } else if (item.type === 'youtube' && item.url) {
      parts.push({ text: `Source Video: ${item.url}` });
    } else if (item.data && item.mimeType) {
      parts.push({
        inlineData: {
          data: item.data,
          mimeType: item.mimeType
        }
      });
    }
  });

  const prompt = `Generate today's "The Yield" newsletter. 
  ${includeMarketData ? "Use Google Search to find current South African SAFEX prices for White Maize and the latest market prices for South African Raw Honey (ZAR). List these precisely." : ""}
  If a special theme like '${themeId}' is selected, weave it in.`;
  
  parts.push({ text: prompt });

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
          marketDate: { type: Type.STRING }
        },
        required: ["header", "sections"]
      },
    },
  });

  const result = JSON.parse(response.text || "{}");
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
  if (!apiKey) throw new Error("API_KEY missing");
  
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: "Get current SAFEX prices for White Maize and Raw Honey in South Africa (ZAR). Format as JSON with array 'prices' {name, price, unit, category, trend: number[]}" }] }],
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
  return JSON.parse(response.text || "{}");
};

export const generateImage = async (prompt: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `${prompt}. Cinematic agricultural photography. Professional lighting. 8k.` }]
      },
      config: { 
        imageConfig: { 
          aspectRatio: "16:9" 
        } 
      }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
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
