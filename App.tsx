
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2, AlertCircle, Plus, Trash2, RefreshCw,
  FileText, Youtube, Zap, X, Settings, LogOut, Printer, Layers, Send, CheckCircle2,
  Mail, Globe, Calendar, Image as ImageIcon, Music, Film, Upload, Clock, Download
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
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [marketAsOf, setMarketAsOf] = useState<string>('');
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const data = await fetchMarketTrends();
      setMarketTrends(data.prices);
      setMarketAsOf(data.asOf);
    } catch (e) {
      console.error("Market fetch failed");
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
      setError("Please add text or sources to generate.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setNewsletter(null);
    try {
      const activeContent = [...curations];
      if (inputText.trim()) {
        activeContent.push({ id: 'txt', type: 'text', text: inputText, timestamp: '' });
      }

      const data = await generateNewsletter(activeContent, includeMarket, themeId);
      
      // Sequential Image Generation to ensure reliability
      const sectionsWithImages = [];
      for (const section of data.sections) {
        const url = await generateImage(section.imagePrompt);
        sectionsWithImages.push({ ...section, imageUrl: url });
      }
      
      setNewsletter({ ...data, sections: sectionsWithImages });
      setInputText('');
    } catch (err: any) {
      setError("Failed to harvest the newsletter. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!newsletter) return;
    const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-2xl space-y-6 animate-in zoom-in-95">
           <div className="text-center">
              <div className="p-4 rounded-2xl bg-ag-green inline-block mb-4 shadow-lg"><Sprout className="w-8 h-8 text-ag-gold" /></div>
              <h2 className="font-serif text-3xl font-black text-ag-green italic">Lead Editor Portal</h2>
           </div>
           <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200 outline-none focus:ring-ag-green" />
           <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200 outline-none focus:ring-ag-green" />
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
             {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin"/> : "Unlock Portal"}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest">Access Denied</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 pb-20">
      <header className="h-20 border-b border-neutral-100 bg-white sticky top-0 z-50 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-lg"><Sprout className="w-5 h-5 text-ag-gold" /></div>
          <h1 className="text-xl font-black text-ag-green tracking-tighter uppercase">AGRIANTS</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate Edition
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column: Input & Curation */}
        <div className="space-y-8">
          <section className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Paste Content</h3>
              <select value={themeId} onChange={e => setThemeId(e.target.value)} className="bg-neutral-50 text-[10px] font-black p-2 rounded-lg border border-neutral-100 outline-none">
                {UN_DAYS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            
            <textarea 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              placeholder="Paste YouTube transcripts, articles, or notes..." 
              className="w-full h-44 bg-neutral-50 border-none rounded-2xl p-6 text-sm font-medium focus:ring-1 focus:ring-ag-green shadow-inner resize-none transition-all" 
            />

            <div className="flex gap-2">
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-xl px-4 shadow-inner ring-1 ring-neutral-100">
                <Youtube className="w-4 h-4 text-red-600 mr-2" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link" className="bg-transparent border-none text-xs flex-1 font-bold py-3 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && setCurations([...curations, { id: crypto.randomUUID(), type: 'youtube', url: ytUrl.trim(), timestamp: new Date().toLocaleTimeString() }])} className="text-ag-green hover:scale-110"><Plus className="w-5 h-5"/></button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-neutral-50 rounded-xl text-ag-green ring-1 ring-neutral-100 hover:bg-neutral-100"><Upload className="w-5 h-5"/></button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
          </section>

          {curations.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-4">Curation Stack</h3>
              <div className="space-y-2">
                {curations.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between group animate-in slide-in-from-left">
                    <div className="flex items-center gap-3">
                      {item.type === 'youtube' ? <Youtube className="w-4 h-4 text-red-600" /> : <FileText className="w-4 h-4 text-ag-green" />}
                      <span className="text-xs font-bold truncate max-w-[200px]">{item.url || item.text || 'Attachment'}</span>
                    </div>
                    <button onClick={() => setCurations(curations.filter(c => c.id !== item.id))} className="text-neutral-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase text-ag-green tracking-widest flex items-center gap-2"><Globe className="w-4 h-4 text-ag-gold" /> Market Trends</h3>
              <button onClick={loadMarketTrends} className="text-ag-green"><RefreshCw className="w-4 h-4"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {marketTrends.length > 0 ? marketTrends.map((m, i) => (
                <div key={i} className="bg-neutral-50 p-4 rounded-xl ring-1 ring-neutral-100 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-neutral-400 uppercase mb-1">{m.name}</p>
                    <p className="text-sm font-black text-ag-green">{m.price} <span className="text-[9px] font-medium text-neutral-400 italic">/{m.unit}</span></p>
                  </div>
                  <Sparkline data={m.trend} />
                </div>
              )) : <div className="col-span-2 py-4 text-center text-[10px] text-neutral-300 font-bold uppercase">No data synced</div>}
            </div>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-4 h-4 rounded text-ag-green focus:ring-ag-green" />
              <span className="text-[10px] font-black uppercase text-neutral-400 group-hover:text-neutral-600 transition-colors">Include Live Data in Newsletter</span>
            </label>
          </section>

          {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-2 text-xs font-bold"><AlertCircle className="w-4 h-4"/>{error}</div>}
        </div>

        {/* Right Column: Live Preview */}
        <div className="bg-white rounded-[3rem] border border-neutral-200 shadow-2xl min-h-[850px] flex flex-col overflow-hidden sticky top-28">
           <div className="p-12 flex-1 overflow-y-auto">
             {isLoading ? (
               <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
                 <div className="relative">
                   <div className="w-20 h-20 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                   <Sprout className="w-10 h-10 text-ag-gold absolute inset-0 m-auto" />
                 </div>
                 <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green">Harvesting Edition...</p>
                    <p className="text-[10px] font-medium text-neutral-400">Generating section-specific visuals and witty puns.</p>
                 </div>
               </div>
             ) : newsletter ? (
               <div id="newsletter-content" className="animate-in fade-in duration-1000">
                  <header className="text-center mb-16">
                    <div className="p-5 rounded-2xl bg-ag-green inline-block mb-8 shadow-xl"><Sprout className="w-10 h-10 text-ag-gold" /></div>
                    <h2 className="font-serif text-5xl font-black text-ag-green italic mb-2 tracking-tight">The Yield</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 mb-8">{newsletter.generatedAt}</p>
                    <p className="text-xl font-light italic text-neutral-500 max-w-sm mx-auto leading-relaxed">"{newsletter.header.vibeCheck}"</p>
                  </header>

                  <div className="space-y-24">
                    {newsletter.sections.map(s => (
                      <div key={s.id} className="space-y-10">
                        <div className="flex items-center gap-4">
                          <div className="h-px bg-neutral-100 flex-1" />
                          <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-lg border border-green-100">{s.title}</h3>
                          <div className="h-px bg-neutral-100 flex-1" />
                        </div>
                        
                        {s.imageUrl && (
                          <img 
                            src={s.imageUrl} 
                            alt={s.title} 
                            className="w-full h-auto min-h-[320px] object-cover rounded-[2.5rem] shadow-2xl border border-neutral-100 transition-transform hover:scale-[1.01] duration-500" 
                          />
                        )}
                        
                        <div 
                          className="text-lg font-light leading-relaxed text-neutral-800 text-justify md:text-left" 
                          dangerouslySetInnerHTML={{ __html: s.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} 
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-24 pt-10 border-t border-neutral-100 text-center space-y-4">
                    <p className="text-sm font-bold text-ag-green">Visit the AGRIANTS shop for artisanal honey and energy balls.</p>
                    <div className="flex flex-wrap justify-center gap-3 no-print">
                      <button onClick={handleCopy} className="px-8 py-4 rounded-2xl bg-ag-green text-white text-xs font-black shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                        <Copy className="w-4 h-4 text-ag-gold" /> Copy to Clipboard
                      </button>
                      <button onClick={() => window.print()} className="px-8 py-4 rounded-2xl bg-neutral-50 text-neutral-600 text-xs font-black transition-all hover:bg-neutral-100">
                        <Download className="w-4 h-4" /> Save as PDF
                      </button>
                    </div>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                 <Layers className="w-20 h-20 text-neutral-200" />
                 <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Drafting Environment</p>
                    <p className="text-[10px] font-bold text-neutral-300 uppercase">Input context and click generate to begin harvest</p>
                 </div>
               </div>
             )}
           </div>
        </div>
      </main>
      
      <footer className="mt-20 py-10 text-center no-print">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-200">AGRIANTS PRIMARY AGRICULTURAL COOPERATIVE LIMITED &copy; 2025</p>
      </footer>
    </div>
  );
}
