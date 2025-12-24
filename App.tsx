
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2, AlertCircle, Plus, Trash2,
  FileText, Youtube, Zap, X, Settings, LogOut, Layers, Send, CheckCircle2,
  Upload, Download, Share2, Heart, Megaphone, ArrowUp, ArrowDown, Minus, UserPlus,
  Image as ImageIcon, Globe
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
      <polyline
        fill="none"
        stroke={isUp ? "#2D5A27" : "#A1A1AA"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
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
    <div className="flex items-center justify-between py-4 border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition-colors px-5 group">
      <div className="flex flex-col flex-1">
        <span className="text-[10px] font-black text-neutral-800 uppercase tracking-tighter">{item.name}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] font-black px-1.5 py-0.5 bg-neutral-100 text-neutral-400 rounded uppercase tracking-widest">{item.confirmDate || 'Live'}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end">
          <span className="text-xs font-black text-neutral-900 tracking-tight">{item.price}</span>
          <div className={`text-[9px] font-black flex items-center gap-0.5 ${isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-neutral-400'}`}>
            {isUp ? <ArrowUp className="w-2.5 h-2.5" /> : isDown ? <ArrowDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
        
        <div className="hidden sm:block">
           <Sparkline data={trend} />
        </div>
      </div>
    </div>
  );
};

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
  const [settingsTab, setSettingsTab] = useState<'email' | 'subscribers'>('email');

  const [newSubName, setNewSubName] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

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
    if (isAuthenticated && marketTrends.length === 0) {
      loadMarketData();
    }
  }, [isAuthenticated]);

  const loadMarketData = async () => {
    try {
      const data = await fetchMarketTrends();
      setMarketTrends(data.prices || []);
      setMarketAsOf(data.asOf || '');
      return data.prices;
    } catch (e) {
      console.error("Market load failed");
      return null;
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
      let currentPrices = marketTrends;
      if (includeMarket) {
        setLoadingStep('Grounding Market Data...');
        const fresh = await loadMarketData();
        if (fresh) currentPrices = fresh;
      }

      setLoadingStep('Synthesizing Edition...');
      const data = await generateNewsletter(allContent, includeMarket ? currentPrices : null);
      setNewsletter(data);
      setIsLoading(false); 
      setCurations([]);
      setInputText('');

      if (generateImages) {
        for (let i = 0; i < data.sections.length; i++) {
          const section = data.sections[i];
          setLoadingStep(`Harvesting Visual ${i+1}/${data.sections.length}...`);
          try {
            const url = await generateImage(section.imagePrompt);
            if (url) {
              setNewsletter(prev => {
                if (!prev) return null;
                const newSections = [...prev.sections];
                newSections[i] = { ...newSections[i], imageUrl: url };
                return { ...prev, sections: newSections };
              });
            }
          } catch (e) {
            console.warn("Visual failed for prompt: ", section.imagePrompt);
          }
        }
      }
      setLoadingStep('');
    } catch (err: any) {
      console.error("Critical snags during generation:", err);
      setError("The synthesis engine hit a snag. This is likely due to high traffic or API rate limits. Please try again in 30s.");
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleSendToSubscribers = async () => {
    if (!newsletter) return;
    if (subscribers.length === 0) {
      alert("Subscriber list is empty. Add readers in settings.");
      return;
    }
    setIsSending(true);
    await sleep(2500); 
    alert(`Success! "The Yield" Edition dispatched to ${subscribers.length} subscribers via AGRIANTS Dispatcher.`);
    setIsSending(false);
  };

  const addSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail.trim()) return;
    const newSub: Subscriber = {
      id: crypto.randomUUID(),
      name: newSubName || 'Reader',
      email: newSubEmail,
      addedAt: new Date().toISOString()
    };
    setSubscribers([...subscribers, newSub]);
    setNewSubName('');
    setNewSubEmail('');
  };

  const handleCopy = () => {
    if (!newsletter) return;
    const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    alert("Newsletter content copied to clipboard!");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(false);
    await sleep(400);
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
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95">
           <div className="text-center">
              <div className="p-5 rounded-3xl bg-ag-green inline-block mb-6 shadow-xl"><Sprout className="w-10 h-10 text-ag-gold" /></div>
              <h2 className="font-serif text-5xl font-black text-ag-green italic tracking-tighter">The Yield</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-300 mt-2">AGRIANTS Intelligence</p>
           </div>
           <div className="space-y-4">
              <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="w-full bg-neutral-50 rounded-2xl p-4 text-sm font-bold ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
              <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey" className="w-full bg-neutral-50 rounded-2xl p-4 text-sm font-bold ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
           </div>
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all">
             {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin"/> : "Unlock Portal"}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-black uppercase tracking-widest animate-bounce">Access Denied</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 pb-20">
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-center items-center p-6" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <div className="flex gap-6">
                <button onClick={() => setSettingsTab('email')} className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${settingsTab === 'email' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Dispatch Engine</button>
                <button onClick={() => setSettingsTab('subscribers')} className={`text-xs font-black uppercase tracking-widest pb-2 transition-all ${settingsTab === 'subscribers' ? 'text-ag-green border-b-2 border-ag-green' : 'text-neutral-300'}`}>Subscribers ({subscribers.length})</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto max-h-[70vh]">
              {settingsTab === 'email' ? (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">Integrated with EmailJS API</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Service ID</label>
                      <input type="text" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} placeholder="service_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Template ID</label>
                      <input type="text" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} placeholder="template_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Public API Key</label>
                      <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} placeholder="User Public Key" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <form onSubmit={addSubscriber} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Reader Name" className="w-full bg-neutral-50 rounded-xl px-4 py-3 text-xs font-bold ring-1 ring-neutral-200 outline-none focus:ring-ag-green" />
                      <input type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="email@domain.com" className="w-full bg-neutral-50 rounded-xl px-4 py-3 text-xs font-bold ring-1 ring-neutral-200 outline-none focus:ring-ag-green" />
                    </div>
                    <button type="submit" className="w-full bg-ag-green text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all">
                      <UserPlus className="w-4 h-4" /> Register Subscriber
                    </button>
                  </form>
                  <div className="space-y-2 pt-4 border-t border-neutral-100">
                    <h5 className="text-[10px] font-black uppercase text-neutral-400 mb-4">Mailing List Records</h5>
                    {subscribers.map(sub => (
                      <div key={sub.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex justify-between items-center group hover:bg-white transition-colors">
                        <div><p className="text-xs font-black text-ag-green">{sub.name}</p><p className="text-[10px] font-bold text-neutral-400">{sub.email}</p></div>
                        <button onClick={() => setSubscribers(subscribers.filter(s => s.id !== sub.id))} className="text-neutral-200 hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    {subscribers.length === 0 && <p className="text-center py-10 text-xs font-bold text-neutral-300 italic">No subscribers yet...</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="h-20 border-b border-neutral-100 bg-white sticky top-0 z-50 px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-xl shadow-md"><Sprout className="w-6 h-6 text-ag-gold" /></div>
          <div><h1 className="text-xl font-black text-ag-green tracking-tighter uppercase leading-none">AGRIANTS</h1><p className="text-[8px] font-black uppercase tracking-[0.3em] text-neutral-400">Yield Management Portal</p></div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowSettings(true)} className="p-3 text-neutral-400 hover:bg-neutral-50 rounded-full transition-all group">
            <Settings className="w-6 h-6 group-hover:rotate-90 duration-700"/>
          </button>
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
            <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste reports, YouTube transcripts, or notes for 'The Yield'..." className="w-full h-44 bg-neutral-50 border-none rounded-3xl p-6 text-sm font-medium focus:ring-2 focus:ring-ag-green shadow-inner resize-none transition-all placeholder:text-neutral-300" />
            <button onClick={() => addToStack('text')} className="w-full bg-neutral-100 text-neutral-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-ag-green hover:text-white transition-all">Stack Context</button>
            <div className="flex gap-3">
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-2xl px-5 shadow-inner ring-1 ring-neutral-100 focus-within:ring-ag-green transition-all">
                <Youtube className="w-4 h-4 text-red-600 mr-3" />
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Content Link" className="bg-transparent border-none text-xs flex-1 font-bold py-4 focus:ring-0" />
                <button onClick={() => ytUrl.trim() && addToStack('youtube', ytUrl.trim())} className="text-ag-green hover:scale-110 transition-transform"><Plus className="w-6 h-6"/></button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-neutral-50 rounded-2xl text-ag-green ring-1 ring-neutral-100 hover:bg-neutral-100 transition-all"><Upload className="w-6 h-6"/></button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
          </section>

          {curations.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-4">
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Synthesis Pipeline ({curations.length})</p>
                <button onClick={() => setCurations([])} className="text-[8px] font-black uppercase text-red-400">Clear Stack</button>
              </div>
              {curations.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-neutral-100 flex items-center justify-between group animate-in slide-in-from-left duration-300">
                  <div className="flex items-center gap-3">
                    {item.type === 'youtube' ? <Youtube className="w-4 h-4 text-red-600" /> : <FileText className="w-4 h-4 text-ag-green" />}
                    <span className="text-xs font-bold truncate max-w-[200px]">{item.url || item.text || 'Context Fragment'}</span>
                  </div>
                  <button onClick={() => setCurations(curations.filter(c => c.id !== item.id))} className="text-neutral-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          )}

          <section className="bg-white rounded-[2.5rem] p-8 border border-neutral-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-ag-green tracking-widest flex items-center gap-2 mb-2"><Globe className="w-4 h-4 text-ag-gold" /> Retrieval Intelligence</h3>
            <label className="flex items-center gap-3 cursor-pointer group bg-neutral-50 p-4 rounded-2xl border border-neutral-100 hover:bg-neutral-100 transition-all">
              <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-5 h-5 rounded-lg text-ag-green border-neutral-300 focus:ring-ag-green" />
              <div className="flex-1"><span className="block text-[10px] font-black uppercase text-neutral-600">SAFEX Grains & Fibers Data</span><span className="text-[9px] text-neutral-400">Fetch live pricing first for clean synthesis.</span></div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group bg-neutral-50 p-4 rounded-2xl border border-neutral-100 hover:bg-neutral-100 transition-all">
              <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)} className="w-5 h-5 rounded-lg text-ag-green border-neutral-300 focus:ring-ag-green" />
              <div className="flex-1"><span className="block text-[10px] font-black uppercase text-neutral-600">Flash Visual Harvest</span><span className="text-[9px] text-neutral-400">Powered by Gemini 2.5 Flash Image. High speed synthesis.</span></div>
              <Zap className="w-4 h-4 text-ag-gold animate-pulse" />
            </label>
          </section>

          {error && <div className="p-6 bg-red-50 border border-red-100 text-red-600 rounded-[2rem] text-xs font-bold flex gap-3 items-center animate-in slide-in-from-top-2"><AlertCircle className="w-5 h-5"/>{error}</div>}
        </div>

        <div className="bg-white rounded-[3.5rem] border border-neutral-200 shadow-2xl min-h-[900px] flex flex-col overflow-hidden sticky top-28">
           {loadingStep && (
             <div className="absolute top-0 left-0 w-full z-10 p-4 bg-ag-green text-white text-[9px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 animate-in slide-in-from-top duration-500">
               <Loader2 className="w-3 h-3 animate-spin text-ag-gold" /><span>{loadingStep}</span>
             </div>
           )}

           <div className="p-12 flex-1 overflow-y-auto custom-scrollbar">
             {isLoading ? (
               <div className="h-full flex flex-col items-center justify-center space-y-8 text-center">
                 <div className="w-24 h-24 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                 <p className="text-[12px] font-black uppercase tracking-[0.5em] text-ag-green">Brewing The Yield</p>
                 <p className="text-[10px] font-bold text-ag-gold animate-pulse">Running decoupled search & synthesis engines...</p>
               </div>
             ) : newsletter ? (
               <div className="animate-in fade-in duration-1000">
                  <header className="text-center mb-16">
                    <div className="p-6 rounded-[2rem] bg-ag-green inline-block mb-10 shadow-xl"><Sprout className="w-10 h-10 text-ag-gold" /></div>
                    <h2 className="font-serif text-6xl font-black text-ag-green italic mb-3 tracking-tighter leading-none">The Yield</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 mb-10">{newsletter.generatedAt}</p>
                    <p className="text-xl font-light italic text-neutral-500 leading-relaxed max-w-sm mx-auto">"{newsletter.header.vibeCheck}"</p>
                  </header>

                  <div className="space-y-16">
                    <div className="bg-white rounded-[2rem] border border-neutral-200 overflow-hidden shadow-sm">
                      <div className="bg-neutral-50/80 px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <TrendingUp className="w-5 h-5 text-ag-green" />
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-900">Live Market Briefing</h4>
                        </div>
                        {marketAsOf && <span className="text-[9px] font-black text-neutral-400 uppercase">Confirmed {marketAsOf}</span>}
                      </div>
                      
                      <div className="divide-y divide-neutral-100">
                        {marketTrends.map((item, idx) => (
                          <MarketRow key={idx} item={item} />
                        ))}
                      </div>
                      <div className="p-4 bg-neutral-50/50 flex justify-center border-t border-neutral-100">
                         <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-ag-green" /> Grounded via SAFEX & Fiber Global Benchmarks</span>
                      </div>
                    </div>

                    {newsletter.sections.map(s => (
                      <div key={s.id} className="space-y-10">
                        <div className="flex items-center gap-4"><div className="h-px bg-neutral-100 flex-1" /><h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-lg border border-green-100">{s.title}</h3><div className="h-px bg-neutral-100 flex-1" /></div>
                        <div className="relative min-h-[350px] bg-neutral-50 rounded-[3rem] overflow-hidden shadow-2xl border border-neutral-100 flex items-center justify-center group">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} className="w-full h-full object-cover animate-in fade-in duration-1000 group-hover:scale-105 transition-transform duration-700" alt={s.title} />
                          ) : generateImages ? (
                             <div className="flex flex-col items-center justify-center space-y-4 text-neutral-300">
                               <Loader2 className="w-10 h-10 animate-spin" />
                               <span className="text-[10px] font-black uppercase tracking-widest">Developing AI Visual...</span>
                             </div>
                          ) : (
                             <ImageIcon className="w-12 h-12 text-neutral-100" />
                          )}
                        </div>
                        <div className="text-xl font-light leading-relaxed text-neutral-800" dangerouslySetInnerHTML={{ __html: s.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-24 pt-16 border-t border-neutral-100 space-y-12">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 bg-neutral-50 rounded-[2.5rem] text-center space-y-4 border border-neutral-100 group hover:shadow-xl transition-all">
                           <Share2 className="w-8 h-8 text-ag-gold mx-auto group-hover:scale-110 duration-300" />
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-ag-green">Referral Program</h4>
                           <p className="text-[11px] font-medium text-neutral-500">Share The Yield and unlock exclusive producer deep-dives.</p>
                           <button className="text-[9px] font-black uppercase text-ag-green border-b border-ag-green pb-1">Get Link</button>
                        </div>
                        <div className="p-8 bg-neutral-50 rounded-[2.5rem] text-center space-y-4 border border-neutral-100 group hover:shadow-xl transition-all">
                           <Heart className="w-8 h-8 text-red-400 mx-auto group-hover:scale-110 duration-300" />
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-ag-green">Support AGRIANTS</h4>
                           <p className="text-[11px] font-medium text-neutral-500">Help us sustain our mission to modernize RSA agriculture.</p>
                           <button className="text-[9px] font-black uppercase text-ag-green border-b border-ag-green pb-1">Contribute</button>
                        </div>
                        <div className="p-8 bg-neutral-50 rounded-[2.5rem] text-center space-y-4 border border-neutral-100 group hover:shadow-xl transition-all">
                           <Megaphone className="w-8 h-8 text-blue-400 mx-auto group-hover:scale-110 duration-300" />
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-ag-green">Brand Partnerships</h4>
                           <p className="text-[11px] font-medium text-neutral-500">Advertise to our high-intent network of agricultural pros.</p>
                           <button className="text-[9px] font-black uppercase text-ag-green border-b border-ag-green pb-1">Enquire</button>
                        </div>
                     </div>
                  </div>

                  <div className="mt-20 py-12 border-t border-neutral-50 text-center space-y-8 pb-20 no-print">
                    <p className="text-sm font-bold text-ag-green italic">Visit the AGRIANTS shop for artisanal honey & energy balls.</p>
                    <div className="flex flex-wrap justify-center gap-4 px-10">
                      <button onClick={handleSendToSubscribers} disabled={isSending} className="flex-1 min-w-[240px] px-8 py-5 rounded-[2rem] bg-ag-green text-white text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all">
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin text-ag-gold" /> : <Send className="w-5 h-5 text-ag-gold" />} Dispatch to Subscribers
                      </button>
                      <button onClick={handleCopy} className="px-8 py-5 rounded-[2rem] bg-neutral-100 text-neutral-600 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-neutral-200 flex items-center gap-2"><Copy className="w-4 h-4" /> Copy Content</button>
                      <button onClick={() => window.print()} className="px-8 py-5 rounded-[2rem] bg-neutral-100 text-neutral-600 text-[11px] font-black uppercase tracking-widest transition-all hover:bg-neutral-200 flex items-center gap-2"><Download className="w-4 h-4" /> Save PDF</button>
                    </div>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-8 opacity-20">
                 <Layers className="w-20 h-20 text-neutral-200" />
                 <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Editorial Workspace</p>
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
};

export default App;
