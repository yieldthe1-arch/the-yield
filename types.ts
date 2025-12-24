
export interface NewsletterSection {
  id: string;
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface NewsletterData {
  header: {
    vibeCheck: string;
    theme?: string;
  };
  sections: NewsletterSection[];
  sources: { title: string; uri: string }[];
  generatedAt: string;
  marketDate?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface CurationItem {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'youtube';
  text?: string;
  data?: string; 
  mimeType?: string;
  url?: string; 
  timestamp: string;
}

export interface CommodityPrice {
  name: string;
  price: string;
  unit: string;
  category: string;
  trend: number[];
}

export interface Subscriber {
  id: string;
  email: string;
  name: string;
  addedAt: string;
}

export interface EmailConfig {
  senderName: string;
  senderEmail: string;
  provider: 'sendgrid' | 'emailjs' | 'aws_ses';
  apiKey: string;
  serviceId?: string;
  templateId?: string;
}

export const UN_DAYS = [
  { id: 'standard', name: 'Standard Edition' },
  { id: 'world_pulses', name: 'World Pulses Day (Feb 10)' },
  { id: 'world_water', name: 'World Water Day (Mar 22)' },
  { id: 'world_bee', name: 'World Bee Day (May 20)' },
  { id: 'world_environment', name: 'World Environment Day (Jun 5)' },
  { id: 'world_food', name: 'World Food Day (Oct 16)' },
  { id: 'world_soil', name: 'World Soil Day (Dec 5)' }
];
