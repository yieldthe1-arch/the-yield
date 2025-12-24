
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
    recognitionDay?: string;
  };
  sections: NewsletterSection[];
  sources: { title: string; uri: string }[];
  generatedAt: string;
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
  data?: string; // base64 for files
  mimeType?: string;
  url?: string; // for YouTube
  timestamp: string;
}

export interface CommodityPrice {
  name: string;
  price: string;
  unit: string;
  category: 'Commodities' | 'ETFs';
  trend: number[];
}

export interface Subscriber {
  id: string;
  email: string;
  addedAt: string;
}

export interface EmailConfig {
  senderName: string;
  senderEmail: string;
  provider: 'sendgrid' | 'emailjs' | 'aws_ses';
  apiKey: string;
  serviceId?: string; // Specific to EmailJS
  templateId?: string; // Specific to EmailJS
}

export interface DeliveryLog {
  id: string;
  recipient: string;
  status: 'sent' | 'failed';
  timestamp: string;
  referralLink: string;
}

export type LogoTheme = 'regular' | 'custom';
