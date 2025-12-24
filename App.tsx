
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
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'subscribers'>('config');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('agriants_subscribers');
    return saved ? JSON.parse(saved) : [];
  });

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
    if (isAuthenticated) loadMarketTrends();
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(false);
    await new Promise(r => setTimeout(r, 600));
    if (authEmail.toLowerCase().trim() === AUTHORIZED_EMAIL && authPassword === AUTHORIZED_PASSKEY) {
      setIsAuthenticated(true);
    } else {
      setLoginError(true);
    }
    setIsLoggingIn(false);
  };

  const loadMarketTrends = async () => {
    setIsFetchingMarket(true);
    try {
      const data = await fetchMarketTrends();
      setMarketTrends(data.prices);
      setMarketAsOf(data.asOf);
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
      setCurations([...curations, {
        id: crypto.randomUUID(),
        type: file.type.startsWith('image/') ? 'image' : 'text',
        data: base64Data,
        mimeType: file.type,
        text: file.name,
        timestamp: new Date().toLocaleTimeString()
      }]);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (curations.length === 0 && !inputText.trim()) {
      setError("Please add some context first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setNewsletter(null);
    try {
      const finalCurations = [...curations];
      if (inputText.trim()) finalCurations.push({ id: 'txt', type: 'text', text: inputText, timestamp: '' });
      
      const data = await generateNewsletter(finalCurations, includeMarket, themeId);
      
      // Sequential Image Harvest to prevent rate limits
      const updatedSections = [];
      for (const section of data.sections) {
        const url = await generateImage(section.imagePrompt);
        updatedSections.push({ ...section, imageUrl: url });
      }
      
      setNewsletter({ ...data, sections: updatedSections });
    } catch (err: any) {
      setError("Harvesting error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-[2rem] p-10 shadow-2xl space-y-6">
           <div className="text-center">
              <div className="p-4 rounded-2xl bg-ag-green inline-block mb-4"><Sprout className="w-8 h-8 text-ag-gold" /></div>
              <h2 className="font-serif text-3xl font-black text-ag-green italic">Lead Editor</h2>
           </div>
           <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Portal Email" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200" />
           <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200" />
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2">
             {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin"/> : "Unlock Portal"}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest">Invalid credentials</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 pb-20">
      <header className="h-20 border-b border-neutral-100 bg-white sticky top-0 z-50 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ag-green rounded-lg"><Sprout className="w-5 h-5 text-ag-gold" /></div>
          <h1 className="text-lg font-black text-ag-green tracking-tighter uppercase">AGRIANTS</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSettings(true)} className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-full transition-all"><Settings className="w-5 h-5"/></button>
          <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-ag-green/20 hover:scale-105 active:scale-95 transition-all">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-red-500"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <section className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Content Harvest</h3>
              <select value={themeId} onChange={e => setThemeId(e.target.value)} className="bg-neutral-50 text-[10px] font-black p-2 rounded-lg border border-neutral-100 outline-none">
                {UN_DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste reports, transcripts, or notes..." className="w-full h-44 bg-neutral-50 border-none rounded-2xl p-6 text-sm font-medium focus:ring-1 focus:ring-ag-green shadow-inner resize-none transition-all" />
            <div className="flex gap-2">
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-xl px-4 shadow-inner ring-1 ring-neutral-100">
                <Youtube className="w-4 h-4 text-red-600 mr-2" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link" className="bg-transparent border-none text-xs flex-1 font-bold py-2 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && setCurations([...curations, { id: crypto.randomUUID(), type: 'youtube', url: ytUrl.trim(), timestamp: '' }])} className="text-ag-green"><Plus className="w-5 h-5"/></button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-neutral-50 rounded-xl text-ag-green ring-1 ring-neutral-100"><Upload className="w-5 h-5"/></button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase text-ag-green tracking-widest flex items-center gap-2"><Globe className="w-4 h-4 text-ag-gold" /> Market Watch</h3>
              <p className="text-[9px] font-bold text-neutral-400 uppercase">{marketAsOf && `Updated: ${marketAsOf}`}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {marketTrends.map((m, i) => (
                <div key={i} className="bg-neutral-50 p-4 rounded-xl ring-1 ring-neutral-100 flex justify-between items-end">
                  <div>
                    <p className="text-[8px] font-black text-neutral-400 uppercase mb-1">{m.name}</p>
                    <p className="text-sm font-black text-ag-green">{m.price}</p>
                  </div>
                  <Sparkline data={m.trend} />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-4 h-4 rounded text-ag-green focus:ring-ag-green" />
              <span className="text-[10px] font-black uppercase text-neutral-400 group-hover:text-neutral-600 transition-colors">Sync Market Trends in Draft</span>
            </label>
          </section>
        </div>

        <div className="bg-white rounded-[3rem] border border-neutral-200 shadow-2xl min-h-[800px] flex flex-col overflow-hidden sticky top-28">
           <div className="p-12 flex-1 overflow-y-auto">
             {isLoading ? (
               <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                 <div className="relative"><div className="w-16 h-16 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" /><Sprout className="w-8 h-8 text-ag-gold absolute inset-0 m-auto" /></div>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-ag-green">Harvesting Insights & Pictures...</p>
               </div>
             ) : newsletter ? (
               <div className="animate-in fade-in duration-1000">
                  <header className="text-center mb-16">
                    <div className="p-4 rounded-2xl bg-ag-green inline-block mb-8 shadow-xl"><Sprout className="w-8 h-8 text-ag-gold" /></div>
                    <h2 className="font-serif text-5xl font-black text-ag-green italic mb-2">The Yield</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-300 mb-8">{newsletter.generatedAt}</p>
                    <p className="text-xl font-light italic text-neutral-500 max-w-sm mx-auto">"{newsletter.header.vibeCheck}"</p>
                  </header>
                  <div className="space-y-24">
                    {newsletter.sections.map(s => (
                      <div key={s.id} className="space-y-10">
                        <div className="flex items-center gap-4"><div className="h-px bg-neutral-100 flex-1" /><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-ag-green bg-green-50 px-5 py-2 rounded-lg border border-green-100">{s.title}</h3><div className="h-px bg-neutral-100 flex-1" /></div>
                        {s.imageUrl && <img src={s.imageUrl} className="w-full h-auto min-h-[300px] object-cover rounded-[2rem] shadow-xl border border-neutral-100" />}
                        <div className="text-lg font-light leading-relaxed text-neutral-800" dangerouslySetInnerHTML={{ __html: s.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                      </div>
                    ))}
                  </div>
                  {newsletter.marketDate && <div className="mt-20 text-center py-10 border-t border-neutral-50"><p className="text-[10px] font-black uppercase text-neutral-400">Market Recorded on: {newsletter.marketDate}</p></div>}
                  <div className="mt-16 flex flex-wrap justify-center gap-4 no-print pb-10">
                    <button className="px-8 py-4 rounded-2xl bg-ag-green text-white text-xs font-black shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95"><Mail className="w-4 h-4 text-ag-gold"/> Broadcast</button>
                    <button onClick={() => window.print()} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black transition-all hover:bg-neutral-100">Export PDF</button>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                 <Layers className="w-16 h-16" />
                 <p className="text-xs font-black uppercase tracking-widest">Drafting Area</p>
               </div>
             )}
           </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white h-full p-10 shadow-2xl animate-in slide-in-from-right">
             <div className="flex justify-between items-center mb-10">
                <div className="flex gap-6">
                  <button onClick={() => setSettingsTab('config')} className={`text-sm font-black uppercase ${settingsTab === 'config' ? 'text-ag-green border-b-2 border-ag-green pb-1' : 'text-neutral-300'}`}>Email Setup</button>
                  <button onClick={() => setSettingsTab('subscribers')} className={`text-sm font-black uppercase ${settingsTab === 'subscribers' ? 'text-ag-green border-b-2 border-ag-green pb-1' : 'text-neutral-300'}`}>Readers ({subscribers.length})</button>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-50 rounded-full"><X className="w-5 h-5"/></button>
             </div>
             {settingsTab === 'config' ? (
                <div className="space-y-6">
                   <div className="space-y-1"><label className="text-[10px] font-black uppercase text-neutral-400">EmailJS Public Key</label><input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold" /></div>
                   <div className="space-y-1"><label className="text-[10px] font-black uppercase text-neutral-400">Service ID</label><input value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold" /></div>
                   <div className="space-y-1"><label className="text-[10px] font-black uppercase text-neutral-400">Template ID</label><input value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold" /></div>
                </div>
             ) : (
                <div className="space-y-4">
                   <div className="flex gap-2 mb-6">
                      <input placeholder="Reader Name" className="flex-1 bg-neutral-50 rounded-xl px-4 py-3 text-xs font-bold" />
                      <button className="bg-ag-green text-white p-3 rounded-xl"><Plus className="w-4 h-4"/></button>
                   </div>
                   <div className="space-y-2">
                      {subscribers.map(s => <div key={s.id} className="p-4 bg-neutral-50 rounded-xl flex justify-between items-center"><p className="text-xs font-bold text-ag-green">{s.email}</p><Trash2 className="w-4 h-4 text-neutral-300"/></div>)}
                   </div>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
