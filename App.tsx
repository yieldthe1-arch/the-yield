import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2, AlertCircle, Plus, Trash2,
  FileText, Youtube, Zap, X, Settings, LogOut, Layers, Send, CheckCircle2,
  Upload, Download, Share2, Heart, Megaphone, ArrowUp, ArrowDown, Minus, UserPlus,
  Image as ImageIcon, Globe, Gift, Users, Handshake
} from 'lucide-react';
import { generateNewsletter, fetchMarketTrends, generateImage } from './services/geminiService';
import { NewsletterData, CurationItem, CommodityPrice, EmailConfig, Subscriber } from './types';

const AUTHORIZED_EMAIL = "yieldthe1@gmail.com";
const AUTHORIZED_PASSKEY = "AGRIANTS2025"; 

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const Sparkline = ({ data }: { data: number[] }) => {
  if (!data || data.length < 2) return <div className="w-16 h-4 bg-neutral-100 rounded animate-pulse" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 20;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={isUp ? "#2D5A27" : "#A1A1AA"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
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
    <div className="flex items-center justify-between py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors px-5">
      <div className="flex flex-col flex-1">
        <span className="text-[10px] font-black text-neutral-800 uppercase tracking-tighter">{item.name}</span>
        <span className="text-[9px] font-bold text-neutral-400">{item.confirmDate || 'Live'}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-xs font-black text-neutral-900">{item.price}</span>
          <div className={`text-[9px] font-black flex items-center gap-0.5 ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-neutral-400'}`}>
            {isUp ? <ArrowUp className="w-2 h-2" /> : isDown ? <ArrowDown className="w-2 h-2" /> : <Minus className="w-2 h-2" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
        <div className="hidden sm:block"><Sparkline data={trend} /></div>
      </div>
    </div>
  );
};

const CommunityHub = () => (
  <div className="pt-24 border-t border-neutral-100">
     <h3 className="text-center text-[10px] font-black uppercase tracking-[0.6em] text-neutral-300 mb-16">The AGRIANTS Ecosystem</h3>
     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Donation Station */}
        <div className="p-8 bg-white border border-neutral-100 rounded-[2.5rem] text-center shadow-lg hover:shadow-xl transition-all space-y-4">
           <div className="w-14 h-14 bg-ag-green rounded-2xl mx-auto flex items-center justify-center shadow-lg"><Heart className="w-7 h-7 text-ag-gold" /></div>
           <h4 className="text-xs font-black uppercase tracking-widest text-ag-green">Donation Station</h4>
           <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">Support our primary cooperative's mission to digitize local farming infrastructure.</p>
           <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Support Us</button>
        </div>
        {/* Referral Center */}
        <div className="p-8 bg-white border border-neutral-100 rounded-[2.5rem] text-center shadow-lg hover:shadow-xl transition-all space-y-4">
           <div className="w-14 h-14 bg-ag-green rounded-2xl mx-auto flex items-center justify-center shadow-lg"><Users className="w-7 h-7 text-ag-gold" /></div>
           <h4 className="text-xs font-black uppercase tracking-widest text-ag-green">Referral Center</h4>
           <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">Grow the colony. Invite a fellow producer and unlock premium deep-dives.</p>
           <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Invite Pro</button>
        </div>
        {/* Partners Hub */}
        <div className="p-8 bg-white border border-neutral-100 rounded-[2.5rem] text-center shadow-lg hover:shadow-xl transition-all space-y-4">
           <div className="w-14 h-14 bg-ag-green rounded-2xl mx-auto flex items-center justify-center shadow-lg"><Handshake className="w-7 h-7 text-ag-gold" /></div>
           <h4 className="text-xs font-black uppercase tracking-widest text-ag-green">Partners Hub</h4>
           <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">B2B opportunities. Advertise your tech to our high-intent network.</p>
           <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Partner Up</button>
        </div>
     </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(false);
  
  const [inputText, setInputText] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [curations, setCurations] = useState<CurationItem[]>([]);
  const [includeMarket, setIncludeMarket] = useState(true);
  const [generateImages, setGenerateImages] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [marketAsOf, setMarketAsOf] = useState<string>('');
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem('agriants_subs');
    return saved ? JSON.parse(saved) : [];
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('agriants_subs', JSON.stringify(subscribers));
  }, [subscribers]);

  const loadMarketData = async () => {
    try {
      const data = await fetchMarketTrends();
      setMarketTrends(data.prices || []);
      setMarketAsOf(data.asOf || '');
      return data.prices;
    } catch (e) {
      return null;
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      let currentPrices = marketTrends;
      if (includeMarket) {
        setLoadingStep('Grounding Market Tickers...');
        const fresh = await loadMarketData();
        if (fresh) currentPrices = fresh;
      }

      setLoadingStep('Drafting The Yield (Text Synthesis)...');
      const data = await generateNewsletter(curations, includeMarket ? currentPrices : null);
      setNewsletter(data);
      
      setCurations([]);
      setInputText('');

      if (generateImages) {
        for (let i = 0; i < data.sections.length; i++) {
          setLoadingStep(`Processing Visual ${i+1}/${data.sections.length}...`);
          const url = await generateImage(data.sections[i].imagePrompt);
          if (url) {
            setNewsletter(prev => {
              if (!prev) return null;
              const newSections = [...prev.sections];
              newSections[i] = { ...newSections[i], imageUrl: url };
              return { ...prev, sections: newSections };
            });
          }
          if (i < data.sections.length - 1) {
             setLoadingStep(`RPM Cooling Gap (Free Tier Safety)...`);
             await sleep(8000); 
          }
        }
      }
      
      setLoadingStep('');
      setIsLoading(false);
    } catch (err: any) {
      setError("Free Tier Busy. Please wait 30 seconds and try again.");
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    await sleep(600);
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
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-[3.5rem] p-12 shadow-2xl space-y-10">
           <div className="text-center">
              <div className="p-8 rounded-[2.5rem] bg-ag-green inline-block mb-6 shadow-2xl"><Sprout className="w-14 h-14 text-ag-gold" /></div>
              <h2 className="font-serif text-5xl font-black text-ag-green italic tracking-tighter">The Yield</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-300 mt-2">AGRIANTS Intelligence</p>
           </div>
           <div className="space-y-4">
              <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Authorized Email" className="w-full bg-neutral-50 rounded-2xl p-5 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
              <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Secure Passkey" className="w-full bg-neutral-50 rounded-2xl p-5 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
           </div>
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3">
             {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin"/> : "Enter Portal"}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-black uppercase tracking-widest animate-bounce">Access Denied</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900">
      <header className="h-20 border-b bg-white sticky top-0 z-50 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Sprout className="w-8 h-8 text-ag-green" />
          <h1 className="text-2xl font-black text-ag-green tracking-tighter uppercase italic">The Yield</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-ag-green/20">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate Edition
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="text-neutral-300 hover:text-red-500 transition-colors"><LogOut className="w-6 h-6"/></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* EDITORIAL COLUMN */}
        <div className="space-y-8">
          <section className="bg-white rounded-[2.5rem] p-8 border shadow-sm space-y-6">
            <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2"><Layers className="w-3 h-3" /> Synthesis Desk</h3>
            <textarea 
               value={inputText} 
               onChange={e => setInputText(e.target.value)} 
               placeholder="Paste YouTube transcripts or articles..." 
               className="w-full h-64 bg-neutral-50 rounded-[2rem] p-8 text-sm font-medium border-none focus:ring-2 focus:ring-ag-green shadow-inner resize-none transition-all" 
            />
            <div className="flex gap-3">
              <div className="flex-1 bg-neutral-50 rounded-2xl px-5 border flex items-center">
                 <Youtube className="w-4 h-4 text-red-500 mr-3" />
                 <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link" className="bg-transparent border-none text-xs font-bold py-4 focus:ring-0 flex-1" />
              </div>
              <button onClick={() => {if(ytUrl.trim()) setCurations([...curations, {id: Math.random().toString(), type: 'youtube', url: ytUrl, timestamp: ''}]); setYtUrl('');}} className="p-4 bg-ag-green text-white rounded-2xl hover:scale-105 transition-transform"><Plus className="w-6 h-6"/></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
               <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border cursor-pointer hover:bg-neutral-100 transition-colors">
                  <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-5 h-5 rounded text-ag-green focus:ring-ag-green" />
                  <span className="text-[10px] font-black uppercase text-neutral-600">SAFEX Data</span>
               </label>
               <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border cursor-pointer hover:bg-neutral-100 transition-colors">
                  <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)} className="w-5 h-5 rounded text-ag-green focus:ring-ag-green" />
                  <span className="text-[10px] font-black uppercase text-neutral-600">AI Visuals</span>
               </label>
            </div>
          </section>

          {curations.length > 0 && (
            <div className="space-y-2 animate-in slide-in-from-left">
              <p className="text-[10px] font-black uppercase text-neutral-400 px-4 mb-2">Queue ({curations.length})</p>
              {curations.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    {item.type === 'youtube' ? <Youtube className="w-4 h-4 text-red-600" /> : <FileText className="w-4 h-4 text-ag-green" />}
                    <span className="text-xs font-bold truncate max-w-[250px]">{item.url || item.text || 'Fragment'}</span>
                  </div>
                  <button onClick={() => setCurations(curations.filter(c => c.id !== item.id))} className="text-neutral-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-6 bg-red-50 border border-red-100 text-red-600 rounded-3xl text-xs font-bold flex gap-3 items-center animate-bounce">
              <AlertCircle className="w-5 h-5 flex-shrink-0"/>
              <div>
                <p>{error}</p>
                <button onClick={handleGenerate} className="mt-2 underline text-red-700">Try Again Now</button>
              </div>
            </div>
          )}
        </div>

        {/* LIVE PREVIEW COLUMN */}
        <div className="bg-white rounded-[4rem] border shadow-2xl min-h-[1000px] relative overflow-hidden flex flex-col no-print">
           {loadingStep && (
             <div className="absolute top-0 left-0 w-full z-10 p-5 bg-ag-green text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 animate-pulse">
               <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /><span>{loadingStep}</span>
             </div>
           )}

           <div className="p-16 flex-1 overflow-y-auto">
             {newsletter ? (
               <div className="animate-in fade-in duration-1000">
                  <header className="text-center mb-24">
                    <div className="p-10 rounded-[3rem] bg-ag-green inline-block mb-10 shadow-2xl"><Sprout className="w-14 h-14 text-ag-gold" /></div>
                    <h2 className="font-serif text-8xl font-black text-ag-green italic mb-4 tracking-tighter leading-none">The Yield</h2>
                    <p className="text-[11px] font-black uppercase tracking-[0.6em] text-neutral-300 mb-14">{newsletter.generatedAt}</p>
                    <p className="text-2xl font-light italic text-neutral-500 leading-relaxed border-y py-12 max-w-xl mx-auto border-neutral-100">"{newsletter.header.vibeCheck}"</p>
                  </header>

                  <div className="space-y-24">
                    {/* Market Briefing */}
                    <div className="bg-neutral-50 rounded-[3rem] border border-neutral-200 overflow-hidden shadow-sm">
                       <div className="bg-ag-green px-10 py-6 flex justify-between items-center text-white">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.3em]">SAFEX Markets (RSA)</h4>
                          <span className="text-[9px] font-bold opacity-60">UPDATED: {marketAsOf}</span>
                       </div>
                       <div className="divide-y divide-neutral-200">
                          {marketTrends.map((m, i) => <MarketRow key={i} item={m} />)}
                       </div>
                    </div>

                    {/* Newsletter Dynamic Sections */}
                    {newsletter.sections.map((s, idx) => (
                      <section key={idx} className="space-y-12">
                         <div className="flex items-center gap-8">
                            <h3 className="text-sm font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-xl">{s.title}</h3>
                            <div className="h-px bg-neutral-100 flex-1" />
                         </div>
                         <div className="aspect-video bg-neutral-100 rounded-[3.5rem] overflow-hidden border border-neutral-100 flex items-center justify-center group shadow-2xl relative">
                            {s.imageUrl ? (
                              <img src={s.imageUrl} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" alt={s.title} />
                            ) : generateImages ? (
                               <div className="flex flex-col items-center gap-5 text-neutral-300">
                                 <Loader2 className="w-12 h-12 animate-spin" />
                                 <span className="text-[11px] font-black uppercase tracking-widest">Harvesting AI Visual...</span>
                               </div>
                            ) : <ImageIcon className="w-16 h-16 text-neutral-200" />}
                         </div>
                         <div className="text-2xl font-light leading-[1.8] text-neutral-800 tracking-tight" dangerouslySetInnerHTML={{ __html: s.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                      </section>
                    ))}

                    <CommunityHub />
                  </div>

                  <div className="mt-32 pt-20 border-t border-neutral-100 text-center pb-20 no-print">
                    <p className="text-base font-bold text-ag-green italic mb-14">Visit the AGRIANTS shop for artisanal honey & energy balls.</p>
                    <div className="flex flex-wrap gap-5 justify-center">
                       <button onClick={() => {navigator.clipboard.writeText(newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n')); alert("Content copied!");}} className="bg-ag-green text-white px-10 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-ag-green/30 flex items-center gap-3 hover:brightness-110 active:scale-95 transition-all">
                         <Send className="w-5 h-5 text-ag-gold" /> Dispatch Content
                       </button>
                       <button onClick={() => window.print()} className="bg-neutral-100 p-6 rounded-[2.5rem] hover:bg-neutral-200 transition-all text-neutral-600 flex items-center gap-3 font-black uppercase text-[10px] tracking-widest">
                         <Download className="w-6 h-6" /> Save PDF
                       </button>
                    </div>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-12">
                 <div className="opacity-10 animate-pulse">
                    <Sprout className="w-40 h-40 text-ag-green mb-8 mx-auto" />
                    <h2 className="font-serif text-6xl font-black italic">The Yield</h2>
                 </div>
                 <div className="space-y-4 max-w-sm">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Editorial Desk Waiting</p>
                    <p className="text-[11px] font-medium text-neutral-300 italic">"Good farming is a finger on the pulse of the market and a hand in the soil of the future."</p>
                 </div>
                 
                 {/* Hubs visible even in empty state to reassure user of branding */}
                 <div className="w-full pt-12 border-t border-neutral-50 opacity-40">
                    <div className="grid grid-cols-3 gap-4">
                       <div className="flex flex-col items-center gap-2"><Heart className="w-6 h-6 text-ag-green" /><span className="text-[8px] font-black uppercase">Donations</span></div>
                       <div className="flex flex-col items-center gap-2"><Users className="w-6 h-6 text-ag-green" /><span className="text-[8px] font-black uppercase">Referrals</span></div>
                       <div className="flex flex-col items-center gap-2"><Handshake className="w-6 h-6 text-ag-green" /><span className="text-[8px] font-black uppercase">Partners</span></div>
                    </div>
                 </div>
               </div>
             )}
           </div>
        </div>
      </main>
      
      <footer className="py-16 text-center opacity-20 border-t border-neutral-100 mt-20 no-print">
         <p className="text-[10px] font-black uppercase tracking-[0.6em]">AGRIANTS COOPERATIVE RSA • THE YIELD 2025</p>
      </footer>
    </div>
  );
};

export default App;
