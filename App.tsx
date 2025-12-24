
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2,
  AlertCircle, Plus, Trash2, RefreshCw,
  FileText, Youtube, Zap, X, Settings, LogOut, Printer, Layers, Send, CheckCircle2,
  Users, UserPlus, Mail, Globe, Calendar, Image as ImageIcon, Music, Film, Upload, Key, Clock
} from 'lucide-react';
import { generateNewsletter, fetchMarketTrends, generateImage } from './services/geminiService';
import { NewsletterData, CurationItem, CommodityPrice, EmailConfig, Subscriber, UN_DAYS } from './types';

const AUTHORIZED_EMAIL = "yieldthe1@gmail.com";
const AUTHORIZED_PASSKEY = "AGRIANTS2025"; 

const Sparkline = ({ data, color = "#2D5A27", width = 80, height = 20 }: { data: number[], color?: string, width?: number, height?: number }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(false);

  const [inputText, setInputText] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [curations, setCurations] = useState<CurationItem[]>([]);
  const [includeMarket, setIncludeMarket] = useState(true);
  const [themeId, setThemeId] = useState('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isFetchingMarket, setIsFetchingMarket] = useState(false);
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [marketAsOf, setMarketAsOf] = useState<string>('');
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'subscribers'>('config');
  const [hasCustomLogo, setHasCustomLogo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('agriants_subscribers');
    return saved ? JSON.parse(saved) : [];
  });

  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubName, setNewSubName] = useState('');

  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => {
    const saved = localStorage.getItem('agriants_email_config');
    return saved ? JSON.parse(saved) : {
      senderName: 'AGRIANTS Editor',
      senderEmail: AUTHORIZED_EMAIL,
      provider: 'emailjs',
      apiKey: '',
      serviceId: '',
      templateId: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('agriants_email_config', JSON.stringify(emailConfig));
    localStorage.setItem('agriants_subscribers', JSON.stringify(subscribers));
  }, [emailConfig, subscribers]);

  useEffect(() => {
    const checkLogo = async () => {
      try {
        const response = await fetch('/logo.png', { method: 'HEAD' });
        if (response.ok) setHasCustomLogo(true);
      } catch (e) {
        setHasCustomLogo(false);
      }
    };
    checkLogo();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMarketTrends();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setIsLoggingIn(true);
    await new Promise(r => setTimeout(r, 600));

    if (authEmail.toLowerCase().trim() === AUTHORIZED_EMAIL && authPassword === AUTHORIZED_PASSKEY) {
      setIsAuthenticated(true);
      setError(null);
    } else {
      setLoginError(true);
      setAuthPassword(''); 
    }
    setIsLoggingIn(false);
  };

  const loadMarketTrends = async () => {
    setIsFetchingMarket(true);
    setMarketError(null);
    try { 
      const data = await fetchMarketTrends(); 
      setMarketTrends(data.prices);
      setMarketAsOf(data.asOf);
    } catch (err: any) { 
      setMarketError("Market Sync Limited.");
    } finally { 
      setIsFetchingMarket(false); 
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('video/') ? 'video' : 'text';
      
      setCurations([...curations, {
        id: crypto.randomUUID(),
        type: type as any,
        data: base64Data,
        mimeType: file.type,
        text: file.name,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail) return;
    const sub: Subscriber = {
      id: crypto.randomUUID(),
      email: newSubEmail,
      name: newSubName || 'Reader',
      addedAt: new Date().toISOString()
    };
    setSubscribers([...subscribers, sub]);
    setNewSubEmail('');
    setNewSubName('');
  };

  const removeSubscriber = (id: string) => {
    setSubscribers(subscribers.filter(s => s.id !== id));
  };

  const handleAddCuration = (type: any, value?: string) => {
    const finalValue = value || inputText;
    if (!finalValue) return;

    setCurations([...curations, { 
      id: crypto.randomUUID(), 
      type, 
      text: type === 'text' ? finalValue : undefined, 
      url: type === 'youtube' ? finalValue : undefined, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
    
    if (type === 'text') setInputText('');
    if (type === 'youtube') setYtUrl('');
  };

  const handleRemoveCuration = (id: string) => {
    setCurations(curations.filter(c => c.id !== id));
  };

  const handleGenerate = async () => {
    const activeContent = [...curations];
    if (inputText.trim()) {
      activeContent.push({
        id: 'temp',
        type: 'text',
        text: inputText,
        timestamp: new Date().toLocaleTimeString()
      });
    }

    if (activeContent.length === 0) {
      setError("Add context (text or video) to generate 'The Yield'.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      const data = await generateNewsletter(activeContent, includeMarket, themeId);
      
      // CRITICAL FIX: Sequential generation to avoid free tier 429 rate limits
      const sectionsWithImages = [];
      for (const section of data.sections) {
        const url = await generateImage(section.imagePrompt);
        sectionsWithImages.push({ ...section, imageUrl: url });
      }
      
      setNewsletter({ ...data, sections: sectionsWithImages });
    } catch (err: any) {
      console.error(err);
      setError("Harvesting failed. Check your connection or API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToSubscribers = async () => {
    if (!newsletter) return;
    if (subscribers.length === 0) {
      setError("Please add at least one subscriber.");
      return;
    }
    if (!emailConfig.apiKey || !emailConfig.serviceId || !emailConfig.templateId) {
      setShowSettings(true);
      setError("Setup EmailJS credentials first.");
      return;
    }

    setIsSending(true);
    setSendSuccess(false);
    
    try {
      const htmlSections = newsletter.sections.map(s => {
        const imgTag = s.imageUrl ? `<div style="text-align:center; margin: 35px 0;"><img src="${s.imageUrl}" alt="${s.title}" style="width:100%; max-width:560px; border-radius:12px; display:block; margin: 0 auto; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);" /></div>` : '';
        const bodyText = s.content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#2D5A27; font-weight: 800;">$1</strong>').replace(/\n/g, '<br/>');
        return `
          <div style="margin-bottom:60px; font-family: 'Inter', system-ui, sans-serif;">
            <div style="text-align:center; margin-bottom: 20px;">
              <span style="background-color: #f0fdf4; color: #2D5A27; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; padding: 6px 14px; border-radius: 4px; border: 1.5px solid #dcfce7; display: inline-block;">${s.title}</span>
            </div>
            ${imgTag}
            <div style="font-size:16px; line-height:1.75; color:#334155; margin-top:20px;">${bodyText}</div>
          </div>
        `;
      }).join('');

      const masterEmailHtml = `
        <div style="background-color: #f8fafc; padding: 40px 0; font-family: 'Inter', system-ui, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden;">
            <tr>
              <td style="padding: 50px 40px 20px 40px; text-align: center;">
                <div style="background-color: #2D5A27; width: 48px; height: 48px; margin: 0 auto; border-radius: 12px; line-height: 48px; text-align: center;">
                   <img src="https://img.icons8.com/ios-filled/100/D4AF37/sprout.png" style="width: 24px; height: 24px; vertical-align: middle;" />
                </div>
                <h1 style="font-family: 'Georgia', serif; font-style: italic; font-weight: 900; font-size: 44px; color: #2D5A27; margin: 20px 0 5px 0;">The Yield</h1>
                <p style="text-transform: uppercase; letter-spacing: 5px; font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 30px;">${newsletter.generatedAt}</p>
                <p style="font-style: italic; color: #64748b; font-size: 18px; line-height: 1.5; max-width: 400px; margin: 0 auto;">"${newsletter.header.vibeCheck}"</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 40px 0;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 0 45px;">
                ${htmlSections}
                ${newsletter.marketDate ? `<div style="text-align:center; padding-bottom: 40px;"><p style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Market Recorded: ${newsletter.marketDate}</p></div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #cbd5e1; margin-bottom: 10px;">AGRIANTS PRIMARY AGRICULTURAL COOPERATIVE</p>
                <p style="font-size: 12px; color: #64748b; margin: 0;">Sustainable insights for the modern producer.</p>
              </td>
            </tr>
          </table>
          <div style="text-align: center; margin-top: 25px;">
             <p style="font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} AGRIANTS Cooperative. RSA.</p>
          </div>
        </div>
      `;

      for (const sub of subscribers) {
        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailConfig.serviceId,
            template_id: emailConfig.templateId,
            user_id: emailConfig.apiKey,
            template_params: {
              to_name: sub.name,
              to_email: sub.email,
              date: newsletter.generatedAt,
              content: masterEmailHtml
            }
          })
        });
      }
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Broadcast failed. Check credentials.");
    } finally {
      setIsSending(false);
    }
  };

  const LogoPlaceholder = () => (
    <div className="flex items-center gap-3">
      {hasCustomLogo ? <img src="/logo.png" alt="Logo" className="h-10 w-auto" /> : (
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-lg">
            <Sprout className="w-5 h-5 text-ag-gold" />
          </div>
          <h1 className="text-lg font-black text-ag-green tracking-tighter uppercase">AGRIANTS</h1>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
           <div className="text-center mb-8">
              <div className="p-4 rounded-2xl bg-ag-green inline-block mb-4 shadow-lg">
                <Sprout className="w-8 h-8 text-ag-gold" />
              </div>
              <h2 className="font-serif text-3xl font-black text-ag-green italic">The Yield</h2>
              <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mt-1">Lead Editor Login</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-4">
              <input 
                required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email"
                className="w-full bg-neutral-50 border border-neutral-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none" 
              />
              <input 
                required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey"
                className={`w-full bg-neutral-50 border border-neutral-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none ${loginError ? 'border-red-500 bg-red-50' : ''}`} 
              />
              <button disabled={isLoggingIn} type="submit" className="w-full bg-ag-green text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin"/> : "Enter Portal"}
              </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900 font-sans">
      
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex justify-end">
           <div className="w-full max-w-lg bg-white shadow-2xl p-8 flex flex-col animate-in slide-in-from-right">
              <div className="flex justify-between items-center mb-8">
                <div className="flex gap-4">
                  <button onClick={() => setSettingsTab('config')} className={`text-sm font-black uppercase tracking-widest ${settingsTab === 'config' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Config</button>
                  <button onClick={() => setSettingsTab('subscribers')} className={`text-sm font-black uppercase tracking-widest ${settingsTab === 'subscribers' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Subscribers ({subscribers.length})</button>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-50 rounded-full"><X className="w-5 h-5"/></button>
              </div>

              {settingsTab === 'config' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">EmailJS Public Key</label>
                      <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} className="w-full bg-neutral-50 rounded-lg p-3 text-sm font-bold shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Service ID</label>
                      <input placeholder="service_xxxx" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} className="w-full bg-neutral-50 rounded-lg p-3 text-sm font-bold shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Template ID</label>
                      <input placeholder="template_xxxx" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} className="w-full bg-neutral-50 rounded-lg p-3 text-sm font-bold shadow-inner" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <form onSubmit={handleAddSubscriber} className="flex gap-2 mb-6">
                    <input required value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="flex-1 bg-neutral-50 rounded-lg px-3 py-2 text-xs font-bold shadow-inner" />
                    <input required type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="Email" className="flex-[2] bg-neutral-50 rounded-lg px-3 py-2 text-xs font-bold shadow-inner" />
                    <button type="submit" className="bg-ag-green text-white p-2 rounded-lg"><UserPlus className="w-4 h-4"/></button>
                  </form>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {subscribers.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div>
                          <p className="text-xs font-black text-ag-green">{sub.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold">{sub.email}</p>
                        </div>
                        <button onClick={() => removeSubscriber(sub.id)} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      <header className="border-b border-neutral-100 bg-white sticky top-0 z-50 px-6 h-16 flex items-center justify-between">
        <LogoPlaceholder />
        <div className="flex items-center gap-3">
           <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-neutral-50 rounded-full text-neutral-400"><Settings className="w-5 h-5"/></button>
           <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-5 py-2 rounded-full font-black text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all">
             {isLoading ? <Loader2 className="w-3 h-3 animate-spin text-ag-gold" /> : <Zap className="w-3 h-3 text-ag-gold" />} Generate Edition
           </button>
           <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Input Stream</h3>
              <select value={themeId} onChange={e => setThemeId(e.target.value)} className="bg-neutral-50 text-[10px] font-black uppercase tracking-widest outline-none border border-neutral-100 rounded-lg px-3 py-1.5 cursor-pointer">
                 {UN_DAYS.map(day => <option key={day.id} value={day.id}>{day.name}</option>)}
              </select>
            </div>
            
            <textarea 
              value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste reports, transcripts, or notes..." 
              className="w-full h-40 bg-neutral-50 border-none rounded-2xl p-6 text-sm font-medium focus:ring-1 focus:ring-ag-green shadow-inner resize-none transition-all" 
            />

            <div className="flex gap-2">
              <button onClick={() => handleAddCuration('text')} className="flex-1 bg-ag-green text-white py-3 rounded-xl text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition-all">Add Context</button>
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-xl border border-neutral-100 px-4 shadow-inner">
                <Youtube className="w-4 h-4 text-red-600 mr-2" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link" className="bg-transparent border-none text-xs flex-1 font-bold py-2 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && handleAddCuration('youtube', ytUrl.trim())} className="text-ag-green"><Plus className="w-5 h-5"/></button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-neutral-50 rounded-xl text-ag-green border border-neutral-100 shadow-sm">
                 <Upload className="w-5 h-5"/>
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*" onChange={handleFileUpload} />
            </div>
          </div>

          {curations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-2">Curation Stack</h4>
              <div className="grid grid-cols-1 gap-2">
                {curations.map(c => (
                  <div key={c.id} className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-left duration-200">
                    <div className="flex items-center gap-3">
                      {c.type === 'text' && <FileText className="w-4 h-4 text-ag-green"/>}
                      {c.type === 'youtube' && <Youtube className="w-4 h-4 text-red-600" />}
                      {c.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                      {c.type === 'audio' && <Music className="w-4 h-4 text-purple-500" />}
                      {c.type === 'video' && <Film className="w-4 h-4 text-amber-500" />}
                      <p className="text-xs font-bold truncate max-w-[240px] text-neutral-600">{c.text || c.url}</p>
                    </div>
                    <button onClick={() => handleRemoveCuration(c.id)} className="text-neutral-200 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-ag-green flex items-center gap-2">
                <Globe className="w-4 h-4 text-ag-gold" /> Market Dashboard
              </h3>
              <button onClick={loadMarketTrends} disabled={isFetchingMarket} className="text-ag-green">
                <RefreshCw className={`w-4 h-4 ${isFetchingMarket ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {marketAsOf && (
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Updated: {marketAsOf}
              </p>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              {marketTrends.map((item, i) => (
                <div key={i} className="bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                   <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{item.name}</p>
                   <div className="flex justify-between items-end mt-1">
                      <p className="text-sm font-black text-ag-green">{item.price}</p>
                      <Sparkline data={item.trend} />
                   </div>
                </div>
              ))}
            </div>
            <label className="mt-6 flex items-center gap-2 cursor-pointer group">
               <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-4 h-4 rounded text-ag-green focus:ring-ag-green" />
               <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-600 transition-colors">Sync Live Market Trends</span>
            </label>
          </div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-1">
              <AlertCircle className="w-5 h-5 flex-shrink-0"/>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[3rem] border border-neutral-200 shadow-xl min-h-[800px] flex flex-col overflow-hidden sticky top-20">
          <div className="p-10 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                  <Sprout className="w-8 h-8 text-ag-gold absolute inset-0 m-auto" />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green">Harvesting Data...</p>
                  <p className="text-[10px] font-medium text-neutral-400">Forging witty insights and brilliant section imagery.</p>
                </div>
              </div>
            ) : newsletter ? (
              <div id="newsletter-content" className="animate-in fade-in duration-700">
                <header className="text-center mb-16">
                  <div className="flex justify-center mb-8">
                    <div className="p-4 rounded-2xl bg-ag-green shadow-xl">
                      {hasCustomLogo ? <img src="/logo.png" alt="Logo" className="h-10 w-auto" /> : <Sprout className="w-8 h-8 text-ag-gold" />}
                    </div>
                  </div>
                  <h2 className="font-serif text-5xl font-black text-ag-green italic mb-2 tracking-tight">The Yield</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 mb-8">{newsletter.generatedAt}</p>
                  <p className="text-xl font-light italic text-neutral-500 max-w-sm mx-auto leading-relaxed">"{newsletter.header.vibeCheck}"</p>
                </header>

                <div className="space-y-24">
                  {newsletter.sections.map(section => (
                    <div key={section.id} className="space-y-10">
                      <div className="flex items-center gap-4">
                        <div className="h-px bg-neutral-100 flex-1" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-lg border border-green-100">{section.title}</h3>
                        <div className="h-px bg-neutral-100 flex-1" />
                      </div>
                      
                      {section.imageUrl && (
                        <div className="relative group">
                          {/* Ensure image has a minimum height and responsive width */}
                          <img src={section.imageUrl} alt={section.title} className="w-full h-auto min-h-[300px] object-cover rounded-3xl shadow-xl border border-neutral-100 transition-transform duration-500 group-hover:scale-[1.01]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-3xl pointer-events-none" />
                        </div>
                      )}
                      
                      <div className="text-lg font-light leading-relaxed text-neutral-800" dangerouslySetInnerHTML={{ __html: section.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                    </div>
                  ))}
                </div>

                {newsletter.marketDate && (
                  <div className="mt-16 text-center py-10 border-t border-neutral-50">
                    <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Market Intelligence recorded on: {newsletter.marketDate}</p>
                  </div>
                )}

                {newsletter.sources && newsletter.sources.length > 0 && (
                  <div className="mt-24 p-8 bg-neutral-50 rounded-[2.5rem] border border-neutral-100 shadow-inner">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-400 mb-6 text-center">Reference Grounding</h4>
                    <div className="flex flex-wrap justify-center gap-3">
                      {newsletter.sources.map((src, i) => (
                        <a 
                          key={i} 
                          href={src.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] font-bold text-ag-green hover:text-ag-gold bg-white px-5 py-2.5 rounded-full border border-neutral-100 shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          {src.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-16 pt-10 border-t border-neutral-100 flex flex-wrap justify-center gap-4 no-print pb-20">
                   <button onClick={handleSendToSubscribers} disabled={isSending} className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-ag-green text-white text-xs font-black shadow-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin"/> : sendSuccess ? <CheckCircle2 className="w-4 h-4 text-ag-gold"/> : <Mail className="w-4 h-4 text-ag-gold"/>} 
                      {sendSuccess ? `Dispatched to ${subscribers.length}` : `Broadcast to ${subscribers.length}`}
                   </button>
                   <button onClick={() => window.print()} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all active:scale-95">Download PDF</button>
                   <button onClick={() => { const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n'); navigator.clipboard.writeText(text); }} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all active:scale-95">Copy Text</button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <Layers className="w-16 h-16 text-neutral-100" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-widest text-neutral-200">Awaiting your harvest</p>
                  <p className="text-[11px] font-bold text-neutral-100 uppercase">Load context and generate the yield</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="py-12 text-center text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 no-print">
         AGRIANTS PRIMARY AGRICULTURAL COOPERATIVE LIMITED &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2,
  AlertCircle, Plus, Trash2, RefreshCw,
  FileText, Youtube, Zap, X, Settings, LogOut, Printer, Layers, Send, CheckCircle2,
  Users, UserPlus, Mail, Globe, Calendar, Image as ImageIcon, Music, Film, Upload, Key, Clock
} from 'lucide-react';
import { generateNewsletter, fetchMarketTrends, generateImage } from './services/geminiService';
import { NewsletterData, CurationItem, CommodityPrice, EmailConfig, Subscriber, UN_DAYS } from './types';

const AUTHORIZED_EMAIL = "yieldthe1@gmail.com";
const AUTHORIZED_PASSKEY = "AGRIANTS2025"; 

const Sparkline = ({ data, color = "#2D5A27", width = 80, height = 20 }: { data: number[], color?: string, width?: number, height?: number }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(false);

  const [inputText, setInputText] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [curations, setCurations] = useState<CurationItem[]>([]);
  const [includeMarket, setIncludeMarket] = useState(true);
  const [themeId, setThemeId] = useState('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isFetchingMarket, setIsFetchingMarket] = useState(false);
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [marketAsOf, setMarketAsOf] = useState<string>('');
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'subscribers'>('config');
  const [hasCustomLogo, setHasCustomLogo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('agriants_subscribers');
    return saved ? JSON.parse(saved) : [];
  });

  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubName, setNewSubName] = useState('');

  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => {
    const saved = localStorage.getItem('agriants_email_config');
    return saved ? JSON.parse(saved) : {
      senderName: 'AGRIANTS Editor',
      senderEmail: AUTHORIZED_EMAIL,
      provider: 'emailjs',
      apiKey: '',
      serviceId: '',
      templateId: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('agriants_email_config', JSON.stringify(emailConfig));
    localStorage.setItem('agriants_subscribers', JSON.stringify(subscribers));
  }, [emailConfig, subscribers]);

  useEffect(() => {
    const checkLogo = async () => {
      try {
        const response = await fetch('/logo.png', { method: 'HEAD' });
        if (response.ok) setHasCustomLogo(true);
      } catch (e) {
        setHasCustomLogo(false);
      }
    };
    checkLogo();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMarketTrends();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setIsLoggingIn(true);
    await new Promise(r => setTimeout(r, 600));

    if (authEmail.toLowerCase().trim() === AUTHORIZED_EMAIL && authPassword === AUTHORIZED_PASSKEY) {
      setIsAuthenticated(true);
      setError(null);
    } else {
      setLoginError(true);
      setAuthPassword(''); 
    }
    setIsLoggingIn(false);
  };

  const loadMarketTrends = async () => {
    setIsFetchingMarket(true);
    setMarketError(null);
    try { 
      const data = await fetchMarketTrends(); 
      setMarketTrends(data.prices);
      setMarketAsOf(data.asOf);
    } catch (err: any) { 
      setMarketError("Market Sync Limited.");
    } finally { 
      setIsFetchingMarket(false); 
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('video/') ? 'video' : 'text';
      
      setCurations([...curations, {
        id: crypto.randomUUID(),
        type: type as any,
        data: base64Data,
        mimeType: file.type,
        text: file.name,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail) return;
    const sub: Subscriber = {
      id: crypto.randomUUID(),
      email: newSubEmail,
      name: newSubName || 'Reader',
      addedAt: new Date().toISOString()
    };
    setSubscribers([...subscribers, sub]);
    setNewSubEmail('');
    setNewSubName('');
  };

  const removeSubscriber = (id: string) => {
    setSubscribers(subscribers.filter(s => s.id !== id));
  };

  const handleAddCuration = (type: any, value?: string) => {
    const finalValue = value || inputText;
    if (!finalValue) return;

    setCurations([...curations, { 
      id: crypto.randomUUID(), 
      type, 
      text: type === 'text' ? finalValue : undefined, 
      url: type === 'youtube' ? finalValue : undefined, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
    
    if (type === 'text') setInputText('');
    if (type === 'youtube') setYtUrl('');
  };

  const handleRemoveCuration = (id: string) => {
    setCurations(curations.filter(c => c.id !== id));
  };

  const handleGenerate = async () => {
    const activeContent = [...curations];
    if (inputText.trim()) {
      activeContent.push({
        id: 'temp',
        type: 'text',
        text: inputText,
        timestamp: new Date().toLocaleTimeString()
      });
    }

    if (activeContent.length === 0) {
      setError("Add context (text or video) to generate 'The Yield'.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      const data = await generateNewsletter(activeContent, includeMarket, themeId);
      
      // CRITICAL FIX: Sequential generation to avoid free tier 429 rate limits
      const sectionsWithImages = [];
      for (const section of data.sections) {
        const url = await generateImage(section.imagePrompt);
        sectionsWithImages.push({ ...section, imageUrl: url });
      }
      
      setNewsletter({ ...data, sections: sectionsWithImages });
    } catch (err: any) {
      console.error(err);
      setError("Harvesting failed. Check your connection or API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToSubscribers = async () => {
    if (!newsletter) return;
    if (subscribers.length === 0) {
      setError("Please add at least one subscriber.");
      return;
    }
    if (!emailConfig.apiKey || !emailConfig.serviceId || !emailConfig.templateId) {
      setShowSettings(true);
      setError("Setup EmailJS credentials first.");
      return;
    }

    setIsSending(true);
    setSendSuccess(false);
    
    try {
      const htmlSections = newsletter.sections.map(s => {
        const imgTag = s.imageUrl ? `<div style="text-align:center; margin: 35px 0;"><img src="${s.imageUrl}" alt="${s.title}" style="width:100%; max-width:560px; border-radius:12px; display:block; margin: 0 auto; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);" /></div>` : '';
        const bodyText = s.content.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#2D5A27; font-weight: 800;">$1</strong>').replace(/\n/g, '<br/>');
        return `
          <div style="margin-bottom:60px; font-family: 'Inter', system-ui, sans-serif;">
            <div style="text-align:center; margin-bottom: 20px;">
              <span style="background-color: #f0fdf4; color: #2D5A27; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; padding: 6px 14px; border-radius: 4px; border: 1.5px solid #dcfce7; display: inline-block;">${s.title}</span>
            </div>
            ${imgTag}
            <div style="font-size:16px; line-height:1.75; color:#334155; margin-top:20px;">${bodyText}</div>
          </div>
        `;
      }).join('');

      const masterEmailHtml = `
        <div style="background-color: #f8fafc; padding: 40px 0; font-family: 'Inter', system-ui, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden;">
            <tr>
              <td style="padding: 50px 40px 20px 40px; text-align: center;">
                <div style="background-color: #2D5A27; width: 48px; height: 48px; margin: 0 auto; border-radius: 12px; line-height: 48px; text-align: center;">
                   <img src="https://img.icons8.com/ios-filled/100/D4AF37/sprout.png" style="width: 24px; height: 24px; vertical-align: middle;" />
                </div>
                <h1 style="font-family: 'Georgia', serif; font-style: italic; font-weight: 900; font-size: 44px; color: #2D5A27; margin: 20px 0 5px 0;">The Yield</h1>
                <p style="text-transform: uppercase; letter-spacing: 5px; font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 30px;">${newsletter.generatedAt}</p>
                <p style="font-style: italic; color: #64748b; font-size: 18px; line-height: 1.5; max-width: 400px; margin: 0 auto;">"${newsletter.header.vibeCheck}"</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 40px 0;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 0 45px;">
                ${htmlSections}
                ${newsletter.marketDate ? `<div style="text-align:center; padding-bottom: 40px;"><p style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Market Recorded: ${newsletter.marketDate}</p></div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #cbd5e1; margin-bottom: 10px;">AGRIANTS PRIMARY AGRICULTURAL COOPERATIVE</p>
                <p style="font-size: 12px; color: #64748b; margin: 0;">Sustainable insights for the modern producer.</p>
              </td>
            </tr>
          </table>
          <div style="text-align: center; margin-top: 25px;">
             <p style="font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} AGRIANTS Cooperative. RSA.</p>
          </div>
        </div>
      `;

      for (const sub of subscribers) {
        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: emailConfig.serviceId,
            template_id: emailConfig.templateId,
            user_id: emailConfig.apiKey,
            template_params: {
              to_name: sub.name,
              to_email: sub.email,
              date: newsletter.generatedAt,
              content: masterEmailHtml
            }
          })
        });
      }
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError("Broadcast failed. Check credentials.");
    } finally {
      setIsSending(false);
    }
  };

  const LogoPlaceholder = () => (
    <div className="flex items-center gap-3">
      {hasCustomLogo ? <img src="/logo.png" alt="Logo" className="h-10 w-auto" /> : (
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-lg">
            <Sprout className="w-5 h-5 text-ag-gold" />
          </div>
          <h1 className="text-lg font-black text-ag-green tracking-tighter uppercase">AGRIANTS</h1>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
           <div className="text-center mb-8">
              <div className="p-4 rounded-2xl bg-ag-green inline-block mb-4 shadow-lg">
                <Sprout className="w-8 h-8 text-ag-gold" />
              </div>
              <h2 className="font-serif text-3xl font-black text-ag-green italic">The Yield</h2>
              <p className="text-[9px] font-black uppercase text-neutral-400 tracking-widest mt-1">Lead Editor Login</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-4">
              <input 
                required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email"
                className="w-full bg-neutral-50 border border-neutral-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none" 
              />
              <input 
                required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey"
                className={`w-full bg-neutral-50 border border-neutral-100 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none ${loginError ? 'border-red-500 bg-red-50' : ''}`} 
              />
              <button disabled={isLoggingIn} type="submit" className="w-full bg-ag-green text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin"/> : "Enter Portal"}
              </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900 font-sans">
      
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex justify-end">
           <div className="w-full max-w-lg bg-white shadow-2xl p-8 flex flex-col animate-in slide-in-from-right">
              <div className="flex justify-between items-center mb-8">
                <div className="flex gap-4">
                  <button onClick={() => setSettingsTab('config')} className={`text-sm font-black uppercase tracking-widest ${settingsTab === 'config' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Config</button>
                  <button onClick={() => setSettingsTab('subscribers')} className={`text-sm font-black uppercase tracking-widest ${settingsTab === 'subscribers' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Subscribers ({subscribers.length})</button>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-50 rounded-full"><X className="w-5 h-5"/></button>
              </div>

              {settingsTab === 'config' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">EmailJS Public Key</label>
                      <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} className="w-full bg-neutral-50 rounded-lg p-3 text-sm font-bold shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Service ID</label>
                      <input placeholder="service_xxxx" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} className="w-full bg-neutral-50 rounded-lg p-3 text-sm font-bold shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Template ID</label>
                      <input placeholder="template_xxxx" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} className="w-full bg-neutral-50 rounded-lg p-3 text-sm font-bold shadow-inner" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <form onSubmit={handleAddSubscriber} className="flex gap-2 mb-6">
                    <input required value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="flex-1 bg-neutral-50 rounded-lg px-3 py-2 text-xs font-bold shadow-inner" />
                    <input required type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="Email" className="flex-[2] bg-neutral-50 rounded-lg px-3 py-2 text-xs font-bold shadow-inner" />
                    <button type="submit" className="bg-ag-green text-white p-2 rounded-lg"><UserPlus className="w-4 h-4"/></button>
                  </form>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {subscribers.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div>
                          <p className="text-xs font-black text-ag-green">{sub.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold">{sub.email}</p>
                        </div>
                        <button onClick={() => removeSubscriber(sub.id)} className="text-neutral-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      <header className="border-b border-neutral-100 bg-white sticky top-0 z-50 px-6 h-16 flex items-center justify-between">
        <LogoPlaceholder />
        <div className="flex items-center gap-3">
           <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-neutral-50 rounded-full text-neutral-400"><Settings className="w-5 h-5"/></button>
           <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-5 py-2 rounded-full font-black text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all">
             {isLoading ? <Loader2 className="w-3 h-3 animate-spin text-ag-gold" /> : <Zap className="w-3 h-3 text-ag-gold" />} Generate Edition
           </button>
           <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Input Stream</h3>
              <select value={themeId} onChange={e => setThemeId(e.target.value)} className="bg-neutral-50 text-[10px] font-black uppercase tracking-widest outline-none border border-neutral-100 rounded-lg px-3 py-1.5 cursor-pointer">
                 {UN_DAYS.map(day => <option key={day.id} value={day.id}>{day.name}</option>)}
              </select>
            </div>
            
            <textarea 
              value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste reports, transcripts, or notes..." 
              className="w-full h-40 bg-neutral-50 border-none rounded-2xl p-6 text-sm font-medium focus:ring-1 focus:ring-ag-green shadow-inner resize-none transition-all" 
            />

            <div className="flex gap-2">
              <button onClick={() => handleAddCuration('text')} className="flex-1 bg-ag-green text-white py-3 rounded-xl text-xs font-black shadow-md hover:scale-[1.01] active:scale-95 transition-all">Add Context</button>
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-xl border border-neutral-100 px-4 shadow-inner">
                <Youtube className="w-4 h-4 text-red-600 mr-2" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link" className="bg-transparent border-none text-xs flex-1 font-bold py-2 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && handleAddCuration('youtube', ytUrl.trim())} className="text-ag-green"><Plus className="w-5 h-5"/></button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-neutral-50 rounded-xl text-ag-green border border-neutral-100 shadow-sm">
                 <Upload className="w-5 h-5"/>
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*" onChange={handleFileUpload} />
            </div>
          </div>

          {curations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-2">Curation Stack</h4>
              <div className="grid grid-cols-1 gap-2">
                {curations.map(c => (
                  <div key={c.id} className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-left duration-200">
                    <div className="flex items-center gap-3">
                      {c.type === 'text' && <FileText className="w-4 h-4 text-ag-green"/>}
                      {c.type === 'youtube' && <Youtube className="w-4 h-4 text-red-600" />}
                      {c.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                      {c.type === 'audio' && <Music className="w-4 h-4 text-purple-500" />}
                      {c.type === 'video' && <Film className="w-4 h-4 text-amber-500" />}
                      <p className="text-xs font-bold truncate max-w-[240px] text-neutral-600">{c.text || c.url}</p>
                    </div>
                    <button onClick={() => handleRemoveCuration(c.id)} className="text-neutral-200 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-ag-green flex items-center gap-2">
                <Globe className="w-4 h-4 text-ag-gold" /> Market Dashboard
              </h3>
              <button onClick={loadMarketTrends} disabled={isFetchingMarket} className="text-ag-green">
                <RefreshCw className={`w-4 h-4 ${isFetchingMarket ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {marketAsOf && (
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Updated: {marketAsOf}
              </p>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              {marketTrends.map((item, i) => (
                <div key={i} className="bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                   <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{item.name}</p>
                   <div className="flex justify-between items-end mt-1">
                      <p className="text-sm font-black text-ag-green">{item.price}</p>
                      <Sparkline data={item.trend} />
                   </div>
                </div>
              ))}
            </div>
            <label className="mt-6 flex items-center gap-2 cursor-pointer group">
               <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-4 h-4 rounded text-ag-green focus:ring-ag-green" />
               <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-600 transition-colors">Sync Live Market Trends</span>
            </label>
          </div>
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-1">
              <AlertCircle className="w-5 h-5 flex-shrink-0"/>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[3rem] border border-neutral-200 shadow-xl min-h-[800px] flex flex-col overflow-hidden sticky top-20">
          <div className="p-10 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                  <Sprout className="w-8 h-8 text-ag-gold absolute inset-0 m-auto" />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green">Harvesting Data...</p>
                  <p className="text-[10px] font-medium text-neutral-400">Forging witty insights and brilliant section imagery.</p>
                </div>
              </div>
            ) : newsletter ? (
              <div id="newsletter-content" className="animate-in fade-in duration-700">
                <header className="text-center mb-16">
                  <div className="flex justify-center mb-8">
                    <div className="p-4 rounded-2xl bg-ag-green shadow-xl">
                      {hasCustomLogo ? <img src="/logo.png" alt="Logo" className="h-10 w-auto" /> : <Sprout className="w-8 h-8 text-ag-gold" />}
                    </div>
                  </div>
                  <h2 className="font-serif text-5xl font-black text-ag-green italic mb-2 tracking-tight">The Yield</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 mb-8">{newsletter.generatedAt}</p>
                  <p className="text-xl font-light italic text-neutral-500 max-w-sm mx-auto leading-relaxed">"{newsletter.header.vibeCheck}"</p>
                </header>

                <div className="space-y-24">
                  {newsletter.sections.map(section => (
                    <div key={section.id} className="space-y-10">
                      <div className="flex items-center gap-4">
                        <div className="h-px bg-neutral-100 flex-1" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-lg border border-green-100">{section.title}</h3>
                        <div className="h-px bg-neutral-100 flex-1" />
                      </div>
                      
                      {section.imageUrl && (
                        <div className="relative group">
                          {/* Ensure image has a minimum height and responsive width */}
                          <img src={section.imageUrl} alt={section.title} className="w-full h-auto min-h-[300px] object-cover rounded-3xl shadow-xl border border-neutral-100 transition-transform duration-500 group-hover:scale-[1.01]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-3xl pointer-events-none" />
                        </div>
                      )}
                      
                      <div className="text-lg font-light leading-relaxed text-neutral-800" dangerouslySetInnerHTML={{ __html: section.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                    </div>
                  ))}
                </div>

                {newsletter.marketDate && (
                  <div className="mt-16 text-center py-10 border-t border-neutral-50">
                    <p className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Market Intelligence recorded on: {newsletter.marketDate}</p>
                  </div>
                )}

                {newsletter.sources && newsletter.sources.length > 0 && (
                  <div className="mt-24 p-8 bg-neutral-50 rounded-[2.5rem] border border-neutral-100 shadow-inner">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-400 mb-6 text-center">Reference Grounding</h4>
                    <div className="flex flex-wrap justify-center gap-3">
                      {newsletter.sources.map((src, i) => (
                        <a 
                          key={i} 
                          href={src.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] font-bold text-ag-green hover:text-ag-gold bg-white px-5 py-2.5 rounded-full border border-neutral-100 shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          {src.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-16 pt-10 border-t border-neutral-100 flex flex-wrap justify-center gap-4 no-print pb-20">
                   <button onClick={handleSendToSubscribers} disabled={isSending} className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-ag-green text-white text-xs font-black shadow-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin"/> : sendSuccess ? <CheckCircle2 className="w-4 h-4 text-ag-gold"/> : <Mail className="w-4 h-4 text-ag-gold"/>} 
                      {sendSuccess ? `Dispatched to ${subscribers.length}` : `Broadcast to ${subscribers.length}`}
                   </button>
                   <button onClick={() => window.print()} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all active:scale-95">Download PDF</button>
                   <button onClick={() => { const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n'); navigator.clipboard.writeText(text); }} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all active:scale-95">Copy Text</button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <Layers className="w-16 h-16 text-neutral-100" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-widest text-neutral-200">Awaiting your harvest</p>
                  <p className="text-[11px] font-bold text-neutral-100 uppercase">Load context and generate the yield</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="py-12 text-center text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 no-print">
         AGRIANTS PRIMARY AGRICULTURAL COOPERATIVE LIMITED &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
