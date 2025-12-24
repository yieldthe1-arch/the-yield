
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2,
  AlertCircle, Plus, Trash2, RefreshCw,
  FileText, Youtube, Zap, X, Settings, LogOut, Printer, Layers, Send, CheckCircle2,
  Users, UserPlus, Mail, Globe, Calendar, Image as ImageIcon, Music, Film, Upload
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
      setMarketTrends(data);
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
      setError("Please add some content to the stack.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      const data = await generateNewsletter(activeContent, includeMarket, themeId);
      const sectionsWithImages = await Promise.all(data.sections.map(async (s) => ({
        ...s,
        imageUrl: await generateImage(s.imagePrompt)
      })));
      setNewsletter({ ...data, sections: sectionsWithImages });
    } catch (err: any) {
      setError("Generation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToSubscribers = async () => {
    if (subscribers.length === 0) {
      setError("You have 0 subscribers to send to.");
      return;
    }
    if (!emailConfig.apiKey || !emailConfig.serviceId) {
      setShowSettings(true);
      setError("Configure EmailJS first.");
      return;
    }

    setIsSending(true);
    setSendSuccess(false);
    
    try {
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
              vibe_check: newsletter?.header.vibeCheck,
              date: newsletter?.generatedAt,
              content: newsletter?.sections.map(s => `<h3>${s.title}</h3>${s.content}`).join('')
            }
          })
        });
      }
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      setError("Distribution error.");
    } finally {
      setIsSending(false);
    }
  };

  const LogoPlaceholder = () => (
    <div className="flex items-center gap-3">
      {hasCustomLogo ? <img src="/logo.png" alt="Logo" className="h-10 w-auto" /> : (
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-xl">
            <Sprout className="w-6 h-6 text-ag-gold" />
          </div>
          <h1 className="text-xl font-black text-ag-green tracking-tighter uppercase">AGRIANTS</h1>
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95">
           <div className="text-center mb-10">
              <div className="p-5 rounded-3xl bg-ag-green inline-block mb-6 shadow-xl">
                {hasCustomLogo ? <img src="/logo.png" alt="Logo" className="h-12 w-auto" /> : <Sprout className="w-10 h-10 text-ag-gold" />}
              </div>
              <h2 className="font-serif text-4xl font-black text-ag-green italic mb-2">The Yield</h2>
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.4em]">Editor Portal</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-6">
              <input 
                required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email"
                className="w-full bg-neutral-50 border-neutral-100 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none" 
              />
              <input 
                required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey"
                className={`w-full bg-neutral-50 border-neutral-100 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none ${loginError ? 'border-rose-300 ring-rose-100 ring-4' : ''}`} 
              />
              <button disabled={isLoggingIn} type="submit" className="w-full bg-ag-green text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin"/> : "Unlock Portal"}
              </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900 font-sans">
      
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-ag-green/20 backdrop-blur-sm flex justify-end">
           <div className="w-full max-w-xl bg-white shadow-2xl p-10 flex flex-col animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-10">
                <div className="flex gap-6">
                  <button onClick={() => setSettingsTab('config')} className={`text-xl font-black uppercase tracking-tighter flex items-center gap-2 ${settingsTab === 'config' ? 'text-ag-green' : 'text-neutral-300'}`}>
                    <Settings className="w-6 h-6" /> Config
                  </button>
                  <button onClick={() => setSettingsTab('subscribers')} className={`text-xl font-black uppercase tracking-tighter flex items-center gap-2 ${settingsTab === 'subscribers' ? 'text-ag-green' : 'text-neutral-300'}`}>
                    <Users className="w-6 h-6" /> Subscribers ({subscribers.length})
                  </button>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-50 rounded-full"><X className="w-6 h-6"/></button>
              </div>

              {settingsTab === 'config' ? (
                <div className="space-y-6 overflow-y-auto">
                  <div className="p-4 bg-amber-50 rounded-2xl text-[11px] font-bold text-amber-900 leading-relaxed">
                    Configure your distribution layer using EmailJS. Visit emailjs.com to retrieve your credentials.
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Public Key (User ID)</label>
                      <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} placeholder="Public Key" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Service ID</label>
                      <input placeholder="service_xxxxxx" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold shadow-inner" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400">Template ID</label>
                      <input placeholder="template_xxxxxx" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold shadow-inner" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <form onSubmit={handleAddSubscriber} className="flex gap-2 mb-6">
                    <input required value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="flex-1 bg-neutral-50 rounded-xl px-4 py-2 text-xs font-bold shadow-inner" />
                    <input required type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="Email" className="flex-[2] bg-neutral-50 rounded-xl px-4 py-2 text-xs font-bold shadow-inner" />
                    <button type="submit" className="bg-ag-green text-white p-2 rounded-xl transition-transform hover:scale-105 active:scale-95"><UserPlus className="w-5 h-5"/></button>
                  </form>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {subscribers.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-transparent hover:border-ag-green/20 transition-all">
                        <div>
                          <p className="text-xs font-black text-ag-green">{sub.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold">{sub.email}</p>
                        </div>
                        <button onClick={() => removeSubscriber(sub.id)} className="text-neutral-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    {subscribers.length === 0 && (
                      <div className="text-center py-20">
                         <Mail className="w-12 h-12 mx-auto text-neutral-100 mb-4" />
                         <p className="text-xs font-bold text-neutral-300 uppercase tracking-widest">No active subscribers</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      <header className="border-b border-neutral-100 bg-white sticky top-0 z-50 px-6 h-20 flex items-center justify-between">
        <LogoPlaceholder />
        <div className="flex items-center gap-4">
           <button onClick={() => { setSettingsTab('subscribers'); setShowSettings(true); }} className="relative p-2 text-neutral-400 hover:text-ag-green transition-colors">
             <Users className="w-5 h-5"/>
             {subscribers.length > 0 && <span className="absolute -top-1 -right-1 bg-ag-gold text-white text-[8px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white">{subscribers.length}</span>}
           </button>
           <button onClick={() => { setSettingsTab('config'); setShowSettings(true); }} className="p-2 hover:bg-neutral-50 rounded-full text-neutral-400 transition-colors"><Settings className="w-5 h-5"/></button>
           <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-6 py-2.5 rounded-full font-black text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all active:scale-95">
             {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate Edition
           </button>
           <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-rose-500 transition-colors"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Input Stream</h3>
              <div className="flex items-center gap-3 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
                <Calendar className="w-3 h-3 text-ag-green"/>
                <select value={themeId} onChange={e => setThemeId(e.target.value)} className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer">
                   {UN_DAYS.map(day => <option key={day.id} value={day.id}>{day.name}</option>)}
                </select>
              </div>
            </div>
            
            <div className="relative group">
              <textarea 
                value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste reports, transcripts, or notes..." 
                className="w-full h-40 bg-neutral-50 border-none rounded-2xl p-6 text-sm font-medium focus:ring-2 focus:ring-ag-green shadow-inner resize-none transition-all" 
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                 <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-white rounded-lg shadow-sm border border-neutral-100 text-ag-green hover:bg-neutral-50 transition-colors">
                   <Upload className="w-4 h-4"/>
                 </button>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*" onChange={handleFileUpload} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleAddCuration('text')} className="flex-1 bg-ag-green text-white py-3 rounded-xl text-xs font-black shadow-md hover:scale-[1.02] active:scale-95 transition-transform">Add Note</button>
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-xl border border-neutral-100 px-4 shadow-inner">
                <Youtube className="w-4 h-4 text-red-600 mr-2" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link" className="bg-transparent border-none text-xs flex-1 font-bold py-2 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && handleAddCuration('youtube', ytUrl.trim())} className="text-ag-green transition-transform hover:scale-110"><Plus className="w-5 h-5"/></button>
              </div>
            </div>
          </div>

          {curations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-2">Curation Stack</h4>
              <div className="grid grid-cols-1 gap-2">
                {curations.map(c => (
                  <div key={c.id} className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-left duration-300">
                    <div className="flex items-center gap-3">
                      {c.type === 'text' && <FileText className="w-4 h-4 text-ag-green"/>}
                      {c.type === 'youtube' && <Youtube className="w-4 h-4 text-red-600" />}
                      {c.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-500" />}
                      {c.type === 'audio' && <Music className="w-4 h-4 text-purple-500" />}
                      {c.type === 'video' && <Film className="w-4 h-4 text-amber-500" />}
                      <p className="text-xs font-bold truncate max-w-[200px] text-neutral-600">{c.text || c.url}</p>
                    </div>
                    <button onClick={() => handleRemoveCuration(c.id)} className="text-neutral-200 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-ag-green flex items-center gap-2">
                <Globe className="w-4 h-4 text-ag-gold" /> Market Dashboard
              </h3>
              <button onClick={loadMarketTrends} disabled={isFetchingMarket} className="text-ag-green hover:rotate-180 transition-all duration-500">
                <RefreshCw className={`w-4 h-4 ${isFetchingMarket ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {isFetchingMarket && marketTrends.length === 0 ? (
                <div className="col-span-2 text-center py-10 opacity-30">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-ag-green" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Syncing SAFEX...</p>
                </div>
              ) : marketTrends.map((item, i) => (
                <div key={i} className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 flex flex-col justify-between hover:border-ag-green/20 transition-all group">
                  <div>
                    <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest group-hover:text-ag-green transition-colors">{item.name}</p>
                    <p className="text-sm font-black text-ag-green mt-0.5">{item.price} <span className="text-[8px] opacity-60 font-medium">{item.unit}</span></p>
                  </div>
                  <div className="mt-2 flex justify-between items-end">
                    <span className="text-[8px] font-bold text-neutral-300 uppercase">{item.category}</span>
                    <Sparkline data={item.trend} />
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-6 flex items-center gap-3 cursor-pointer group">
               <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-4 h-4 rounded text-ag-green focus:ring-ag-green transition-all" />
               <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-600 transition-colors">Sync Market Trends with Draft</span>
            </label>
          </div>
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0"/>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[3rem] border border-neutral-200 shadow-xl min-h-[800px] flex flex-col overflow-hidden sticky top-28">
          <div className="p-10 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                  <Sprout className="w-6 h-6 text-ag-gold absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-ag-green">Forging The Yield...</p>
                  <p className="text-[10px] font-medium text-neutral-400">Harvesting data & generating visuals</p>
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
                    <div key={section.id} className="space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="h-px bg-neutral-100 flex-1" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-5 py-2 rounded-full border border-green-100">{section.title}</h3>
                        <div className="h-px bg-neutral-100 flex-1" />
                      </div>
                      
                      {section.imageUrl && (
                        <div className="group relative">
                          <img src={section.imageUrl} alt="" className="w-full h-72 object-cover rounded-[2rem] shadow-sm border border-neutral-100 transition-transform duration-500 group-hover:scale-[1.01]" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-[2rem] pointer-events-none" />
                        </div>
                      )}
                      
                      <div className="text-lg font-light leading-relaxed text-neutral-800" dangerouslySetInnerHTML={{ __html: section.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                    </div>
                  ))}
                </div>

                <div className="mt-24 pt-10 border-t border-neutral-100 flex flex-wrap justify-center gap-4 no-print pb-20">
                   <button onClick={handleSendToSubscribers} disabled={isSending} className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-ag-green text-white text-xs font-black shadow-xl shadow-ag-green/20 disabled:opacity-50 transition-all hover:scale-105 active:scale-95">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin"/> : sendSuccess ? <CheckCircle2 className="w-4 h-4 text-ag-gold"/> : <Mail className="w-4 h-4 text-ag-gold"/>} 
                      {sendSuccess ? `Dispatched to ${subscribers.length} Readers` : `Broadcast to ${subscribers.length} Subscribers`}
                   </button>
                   <button onClick={() => window.print()} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all active:scale-95"><Printer className="w-4 h-4 inline mr-2 opacity-50"/> PDF Export</button>
                   <button onClick={() => { const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n'); navigator.clipboard.writeText(text); }} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all active:scale-95"><Copy className="w-4 h-4 inline mr-2 opacity-50"/> Copy Text</button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <Layers className="w-16 h-16 text-neutral-100" />
                  <Zap className="w-6 h-6 text-ag-gold/20 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-widest text-neutral-200">Awaiting your curation</p>
                  <p className="text-[10px] font-bold text-neutral-100 uppercase">Input text or multimedia to start</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="py-12 text-center text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 no-print">
         AGRIANTS Primary Agricultural Cooperative Limited &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
