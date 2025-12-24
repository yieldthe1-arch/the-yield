
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2, AlertCircle, Plus, Trash2, RefreshCw,
  FileText, Youtube, Zap, X, Settings, LogOut, Printer, Layers, Send, CheckCircle2,
  Mail, Globe, Calendar, Image as ImageIcon, Music, Film, Upload, Clock, Download,
  Key, ExternalLink, Heart, Share2, Megaphone, ArrowUp, ArrowDown, Minus
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

const MarketRow = ({ item }: { item: CommodityPrice }) => {
  const trend = item.trend || [];
  const last = trend.length > 0 ? trend[trend.length - 1] : 0;
  const prev = trend.length > 1 ? trend[trend.length - 2] : last;
  const change = prev !== 0 ? ((last - prev) / prev) * 100 : 0;
  const isUp = last > prev;
  const isDown = last < prev;

  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors px-2">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-4 h-4 flex items-center justify-center">
          {isUp ? <ArrowUp className="w-3 h-3 text-green-600" /> : isDown ? <ArrowDown className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-neutral-400" />}
        </div>
        <span className="text-xs font-bold text-neutral-700">{item.name}</span>
      </div>
      <div className="flex items-center gap-8">
        <span className="text-xs font-black text-neutral-900">{item.price}</span>
        <div className={`min-w-[60px] text-center px-2 py-1 rounded text-[10px] font-black ${isUp ? 'bg-green-100 text-green-700' : isDown ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-500'}`}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
    </div>
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
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [marketAsOf, setMarketAsOf] = useState<string>('');
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'email' | 'subscribers'>('email');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('agriants_subs');
    return saved ? JSON.parse(saved) : [];
  });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => {
    const saved = localStorage.getItem('agriants_email_cfg');
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
    localStorage.setItem('agriants_subs', JSON.stringify(subscribers));
    localStorage.setItem('agriants_email_cfg', JSON.stringify(emailConfig));
  }, [subscribers, emailConfig]);

  useEffect(() => {
    if (isAuthenticated && marketTrends.length === 0) loadMarketTrends();
  }, [isAuthenticated]);

  const loadMarketTrends = async () => {
    try {
      const data = await fetchMarketTrends();
      setMarketTrends(data.prices || []);
      setMarketAsOf(data.asOf || '');
    } catch (e) {
      console.error("Market fetch failed");
    }
  };

  const addToStack = (type: CurationItem['type'], value?: string) => {
    const content = value || inputText;
    if (!content.trim()) return;
    const newItem: CurationItem = {
      id: crypto.randomUUID(),
      type: type,
      text: type === 'text' ? content : undefined,
      url: type === 'youtube' ? content : undefined,
      timestamp: new Date().toLocaleTimeString()
    };
    setCurations(prev => [...prev, newItem]);
    if (type === 'text') setInputText('');
    if (type === 'youtube') setYtUrl('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      setCurations(prev => [...prev, {
        id: crypto.randomUUID(),
        type: file.type.startsWith('image/') ? 'image' : 'text',
        data: base64Data,
        mimeType: file.type,
        text: file.name,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    const allContent = [...curations];
    if (inputText.trim()) {
      allContent.push({ id: 'temp-last', type: 'text', text: inputText, timestamp: '' });
    }
    
    setIsLoading(true);
    setError(null);
    setNewsletter(null);
    try {
      const data = await generateNewsletter(allContent, includeMarket, themeId);
      const sectionsWithImages = [];
      
      // Process images sequentially with a delay to avoid RPM limits.
      // 3.5 seconds is safe for most API tiers.
      for (const section of data.sections) {
        try {
          if (data.sections.indexOf(section) > 0) {
            await new Promise(r => setTimeout(r, 3500));
          }
          
          const url = await generateImage(section.imagePrompt);
          sectionsWithImages.push({ ...section, imageUrl: url });
        } catch (imgErr) {
          console.warn("Image generation failed for section:", section.title, imgErr);
          sectionsWithImages.push(section);
        }
      }
      
      setNewsletter({ ...data, sections: sectionsWithImages });
      setCurations([]);
      setInputText('');
    } catch (err: any) {
      console.error("Newsletter generation failed permanently:", err);
      setError(`Harvesting interrupted: ${err.message || 'The model was unable to complete the draft due to quota limits. Please wait a minute and try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!newsletter) return;
    const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    alert("Newsletter copied!");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(false);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (authEmail === AUTHORIZED_EMAIL && authPassword === AUTHORIZED_PASSKEY) {
      setIsAuthenticated(true);
    } else {
      setLoginError(true);
    }
    setIsLoggingIn(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-sm:max-w-xs max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
           <div className="text-center">
              <div className="p-5 rounded-3xl bg-ag-green inline-block mb-6 shadow-xl"><Sprout className="w-10 h-10 text-ag-gold" /></div>
              <h2 className="font-serif text-5xl font-black text-ag-green italic tracking-tighter">The Yield</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-300 mt-2">AGRIANTS Intelligence</p>
           </div>
           <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="w-full bg-neutral-50 rounded-2xl p-4 pl-12 text-sm font-bold border-none ring-1 ring-neutral-200 outline-none focus:ring-2 focus:ring-ag-green transition-all" />
              </div>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey" className="w-full bg-neutral-50 rounded-2xl p-4 pl-12 text-sm font-bold border-none ring-1 ring-neutral-200 outline-none focus:ring-2 focus:ring-ag-green transition-all" />
              </div>
           </div>
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all">
             {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Key className="w-4 h-4 text-ag-gold" /> Unlock Portal</>}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-black uppercase tracking-widest animate-bounce">Access Denied</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 pb-20">
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex justify-center items-center p-6">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-neutral-100 flex justify-between items-center">
              <div className="flex gap-4">
                <button onClick={() => setSettingsTab('email')} className={`text-xs font-black uppercase tracking-widest pb-1 transition-all ${settingsTab === 'email' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Email Configuration</button>
                <button onClick={() => setSettingsTab('subscribers')} className={`text-xs font-black uppercase tracking-widest pb-1 transition-all ${settingsTab === 'subscribers' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Subscribers ({subscribers.length})</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-100 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto max-h-[60vh]">
              {settingsTab === 'email' ? (
                <div className="space-y-4">
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-neutral-400">EmailJS Service ID</label><input value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-3 text-sm font-bold ring-1 ring-neutral-200 outline-none focus:ring-ag-green"/></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-neutral-400">EmailJS Template ID</label><input value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-3 text-sm font-bold ring-1 ring-neutral-200 outline-none focus:ring-ag-green"/></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-neutral-400">EmailJS Public Key</label><input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-3 text-sm font-bold ring-1 ring-neutral-200 outline-none focus:ring-ag-green"/></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input id="sub-name" placeholder="Name" className="flex-1 bg-neutral-50 rounded-xl px-4 py-2 text-xs font-bold ring-1 ring-neutral-200 outline-none" />
                    <input id="sub-email" placeholder="Email" className="flex-[2] bg-neutral-50 rounded-xl px-4 py-2 text-xs font-bold ring-1 ring-neutral-200 outline-none" />
                    <button onClick={() => {
                      const name = (document.getElementById('sub-name') as HTMLInputElement).value;
                      const email = (document.getElementById('sub-email') as HTMLInputElement).value;
                      if(email) setSubscribers([...subscribers, {id: crypto.randomUUID(), name, email, addedAt: new Date().toISOString()}]);
                    }} className="bg-ag-green text-white p-2 rounded-xl"><Plus className="w-5 h-5"/></button>
                  </div>
                  <div className="space-y-2 mt-4">
                    {subscribers.map(sub => (
                      <div key={sub.id} className="p-4 bg-neutral-50 rounded-xl flex justify-between items-center group">
                        <div>
                          <p className="text-xs font-black text-ag-green">{sub.name || 'Anonymous Reader'}</p>
                          <p className="text-[10px] font-bold text-neutral-400">{sub.email}</p>
                        </div>
                        <button onClick={() => setSubscribers(subscribers.filter(s => s.id !== sub.id))} className="text-neutral-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-neutral-50 text-center"><p className="text-[10px] font-bold text-neutral-400">Settings are persisted to local storage.</p></div>
          </div>
        </div>
      )}

      <header className="h-20 border-b border-neutral-100 bg-white sticky top-0 z-50 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-xl shadow-md"><Sprout className="w-6 h-6 text-ag-gold" /></div>
          <div>
            <h1 className="text-xl font-black text-ag-green tracking-tighter uppercase leading-none">AGRIANTS</h1>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-neutral-400">The Yield Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSettings(true)} className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-full transition-all group"><Settings className="w-6 h-6 group-hover:rotate-90 duration-500"/></button>
          <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-ag-green/20 hover:scale-105 active:scale-95 transition-all">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate Edition
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-red-500 transition-colors"><LogOut className="w-6 h-6"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <section className="bg-white rounded-[2.5rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2"><Layers className="w-3 h-3" /> Input Harvest</h3>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste reports, transcripts, or notes..." className="w-full h-44 bg-neutral-50 border-none rounded-3xl p-6 text-sm font-medium focus:ring-2 focus:ring-ag-green shadow-inner resize-none transition-all placeholder:text-neutral-300" />
            <button onClick={() => addToStack('text')} className="w-full bg-neutral-100 text-neutral-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-ag-green hover:text-white transition-all disabled:opacity-30">Add Fragment to Stack</button>
            <div className="flex gap-3">
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-2xl px-5 shadow-inner ring-1 ring-neutral-100 focus-within:ring-ag-green transition-all">
                <Youtube className="w-4 h-4 text-red-600 mr-3" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube URL" className="bg-transparent border-none text-xs flex-1 font-bold py-4 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && addToStack('youtube', ytUrl.trim())} className="text-ag-green"><Plus className="w-6 h-6"/></button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-neutral-50 rounded-2xl text-ag-green ring-1 ring-neutral-100 hover:bg-neutral-100 transition-all"><Upload className="w-6 h-6"/></button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
          </section>

          {curations.length > 0 && (
            <section className="space-y-3">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Curation Stack ({curations.length})</h3>
                <button onClick={() => setCurations([])} className="text-[8px] font-black text-red-400 uppercase">Clear All</button>
              </div>
              <div className="space-y-2">
                {curations.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between group hover:border-ag-green/20 transition-all">
                    <div className="flex items-center gap-3">
                      {item.type === 'youtube' ? <Youtube className="w-4 h-4 text-red-600" /> : <FileText className="w-4 h-4 text-ag-green" />}
                      <span className="text-xs font-bold truncate max-w-[240px]">{item.url || item.text || 'Fragment'}</span>
                    </div>
                    <button onClick={() => setCurations(curations.filter(c => c.id !== item.id))} className="text-neutral-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white rounded-[2.5rem] p-8 border border-neutral-200 shadow-sm">
            <h3 className="text-xs font-black uppercase text-ag-green tracking-widest flex items-center gap-2 mb-6"><Globe className="w-4 h-4 text-ag-gold" /> Market Watch</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {marketTrends.map((m, i) => (
                <div key={i} className="bg-neutral-50 p-4 rounded-3xl ring-1 ring-neutral-100 flex justify-between items-end">
                  <div><p className="text-[9px] font-black text-neutral-400 uppercase">{m.name}</p><p className="text-sm font-black text-ag-green">{m.price}</p></div>
                  <Sparkline data={m.trend} />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer group bg-neutral-50 p-4 rounded-2xl border border-neutral-100 hover:bg-neutral-100 transition-all">
              <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-5 h-5 rounded-lg text-ag-green border-neutral-300 focus:ring-ag-green" />
              <span className="text-[10px] font-black uppercase text-neutral-400 group-hover:text-ag-green">Sync Market grounding in Draft</span>
            </label>
          </section>

          {error && (
            <div className="p-5 bg-red-50 border border-red-100 text-red-600 rounded-[2rem] flex items-start gap-4 text-xs font-black animate-in slide-in-from-top-2">
              <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5"/>
              <div className="flex-1">
                <span className="block font-bold">Generation Error</span>
                <span className="text-[10px] opacity-80">{error}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[3.5rem] border border-neutral-200 shadow-2xl min-h-[900px] flex flex-col overflow-hidden sticky top-28">
           <div className="p-12 flex-1 overflow-y-auto custom-scrollbar">
             {isLoading ? (
               <div className="h-full flex flex-col items-center justify-center space-y-8 text-center">
                 <div className="w-20 h-20 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                 <div className="space-y-1">
                   <p className="text-[12px] font-black uppercase tracking-[0.5em] text-ag-green">Brewing The Yield</p>
                   <p className="text-[10px] font-medium text-neutral-300 italic">Respecting quota limits and grounding insights...</p>
                 </div>
               </div>
             ) : newsletter ? (
               <div className="animate-in fade-in duration-1000">
                  <header className="text-center mb-16">
                    <div className="p-6 rounded-[2rem] bg-ag-green inline-block mb-10 shadow-xl"><Sprout className="w-10 h-10 text-ag-gold" /></div>
                    <h2 className="font-serif text-6xl font-black text-ag-green italic mb-3 tracking-tighter">The Yield</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 mb-10">{newsletter.generatedAt}</p>
                    <p className="text-xl font-light italic text-neutral-500 leading-relaxed max-w-sm mx-auto">"{newsletter.header.vibeCheck}"</p>
                  </header>

                  <div className="space-y-16">
                    <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden shadow-sm">
                      <div className="bg-neutral-50/80 px-4 py-2 border-b border-neutral-100">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">MARKETS</h4>
                      </div>
                      <div className="p-2 space-y-0">
                        {marketTrends.map((item, idx) => (
                          <MarketRow key={idx} item={item} />
                        ))}
                      </div>
                      <div className="p-4 bg-neutral-50/30 border-t border-neutral-50">
                        <p className="text-[10px] text-neutral-400 font-medium">
                          Data provided by <span className="text-purple-600 font-bold">Yahoo Finance</span> & <span className="text-ag-green font-bold">SAFEX</span>
                        </p>
                        <p className="text-[9px] text-neutral-300 font-bold uppercase mt-1">
                          *Market data as of confirmed close on <span className="text-neutral-500">{newsletter.marketDate || newsletter.generatedAt}</span>
                        </p>
                      </div>
                    </div>

                    {newsletter.sections.map(s => (
                      <div key={s.id} className="space-y-10">
                        <div className="flex items-center gap-4"><div className="h-px bg-neutral-100 flex-1" /><h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-lg border border-green-100">{s.title}</h3><div className="h-px bg-neutral-100 flex-1" /></div>
                        {s.imageUrl && <img src={s.imageUrl} className="w-full h-auto min-h-[350px] object-cover rounded-[3rem] shadow-2xl border border-neutral-100" />}
                        <div className="text-xl font-light leading-relaxed text-neutral-800" dangerouslySetInnerHTML={{ __html: s.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                      </div>
                    ))}
                  </div>

                  {newsletter.sources && newsletter.sources.length > 0 && (
                    <div className="mt-20 pt-10 border-t border-neutral-100 text-left">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Grounding Sources
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {newsletter.sources.map((source, idx) => (
                          <a 
                            key={idx} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 border border-neutral-100 hover:border-ag-green/30 hover:bg-white transition-all group"
                          >
                            <span className="text-[10px] font-bold text-neutral-600 truncate mr-4">{source.title || 'Source'}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-300 group-hover:text-ag-green transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-28 space-y-12 pt-16 border-t border-neutral-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="p-6 bg-neutral-50 rounded-[2rem] text-center space-y-4 hover:shadow-lg transition-all">
                          <Share2 className="w-8 h-8 text-ag-gold mx-auto" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-ag-green">Referral Program</h4>
                          <p className="text-[11px] font-medium text-neutral-500">Share The Yield with a fellow farmer and unlock exclusive market deep-dives.</p>
                          <button className="text-[9px] font-black uppercase text-ag-green border-b border-ag-green pb-1">Get your link</button>
                       </div>
                       <div className="p-6 bg-neutral-50 rounded-[2rem] text-center space-y-4 hover:shadow-lg transition-all">
                          <Heart className="w-8 h-8 text-red-400 mx-auto" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-ag-green">Donation Station</h4>
                          <p className="text-[11px] font-medium text-neutral-500">Support the AGRIANTS Cooperative and our sustainable mission in the RSA.</p>
                          <button className="text-[9px] font-black uppercase text-ag-green border-b border-ag-green pb-1">Contribute</button>
                       </div>
                       <div className="p-6 bg-neutral-50 rounded-[2rem] text-center space-y-4 hover:shadow-lg transition-all">
                          <Megaphone className="w-8 h-8 text-blue-400 mx-auto" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-ag-green">Partner With Us</h4>
                          <p className="text-[11px] font-medium text-neutral-500">Looking to advertise to over 10,000 modern producers? We're open for business.</p>
                          <button className="text-[9px] font-black uppercase text-ag-green border-b border-ag-green pb-1">Media Kit</button>
                       </div>
                    </div>
                  </div>

                  <div className="mt-24 py-10 border-t border-neutral-50 text-center space-y-6 pb-20 no-print">
                    <p className="text-sm font-bold text-ag-green italic">Visit the AGRIANTS shop for artisanal honey & energy balls.</p>
                    <div className="flex justify-center gap-4">
                      <button onClick={handleCopy} className="px-10 py-5 rounded-[2rem] bg-ag-green text-white text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all"><Copy className="w-4 h-4 text-ag-gold" /> Copy Content</button>
                      <button onClick={() => window.print()} className="px-10 py-5 rounded-[2rem] bg-neutral-50 text-neutral-600 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-neutral-100 flex items-center gap-2"><Download className="w-4 h-4" /> Save as PDF</button>
                    </div>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-8 opacity-20">
                 <Layers className="w-20 h-20 text-neutral-200" />
                 <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Editorial Canvas</p>
               </div>
             )}
           </div>
        </div>
      </main>
      
      <footer className="mt-20 py-12 text-center no-print">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-200">AGRIANTS COOPERATIVE RSA • THE YIELD EDITION 2025</p>
      </footer>
    </div>
  );
}
