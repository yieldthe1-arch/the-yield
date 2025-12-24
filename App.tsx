
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2, AlertCircle, Plus, Trash2,
  FileText, Youtube, Zap, X, Settings, LogOut, Layers, Send, CheckCircle2,
  Upload, Download, Share2, Heart, Megaphone, ArrowUp, ArrowDown, Minus, UserPlus,
  Image as ImageIcon, Globe, Handshake, Video, Mic, Check, Newspaper, ExternalLink
} from 'lucide-react';
import { generateNewsletter, fetchMarketTrends, generateImage } from './services/geminiService';
import { NewsletterData, CurationItem, CommodityPrice, EmailConfig, Subscriber } from './types';

const AUTHORIZED_EMAIL = "yieldthe1@gmail.com";
const AUTHORIZED_PASSKEY = "AGRIANTS2025"; 

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // Input Desk State
  const [inputText, setInputText] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [curations, setCurations] = useState<CurationItem[]>([]);
  
  // Settings & Config State
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'email' | 'subscribers'>('email');
  const [newSubName, setNewSubName] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
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

  // Newsletter Logic State
  const [includeMarket, setIncludeMarket] = useState(true);
  const [generateImages, setGenerateImages] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [marketAsOf, setMarketAsOf] = useState<string>('');
  const [marketSources, setMarketSources] = useState<{title: string, uri: string}[]>([]);
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('agriants_subs', JSON.stringify(subscribers));
    localStorage.setItem('agriants_email_cfg', JSON.stringify(emailConfig));
  }, [subscribers, emailConfig]);

  // Auth Handlers
  // Fixed error: Cannot find name 'handleLogin'
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(false);
    
    // Slight UX delay
    await sleep(800);
    
    if (authEmail === AUTHORIZED_EMAIL && authPassword === AUTHORIZED_PASSKEY) {
      setIsAuthenticated(true);
    } else {
      setLoginError(true);
    }
    setIsLoggingIn(false);
  };

  // Handlers
  const handleFileUpload = (type: CurationItem['type']) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*';
      fileInputRef.current.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            setCurations(prev => [...prev, {
              id: crypto.randomUUID(),
              type,
              text: file.name,
              data: base64,
              mimeType: file.type,
              timestamp: new Date().toLocaleTimeString()
            }]);
          };
          reader.readAsDataURL(file);
        }
      };
      fileInputRef.current.click();
    }
  };

  const addToPipeline = (type: 'text' | 'youtube') => {
    const value = type === 'text' ? inputText : ytUrl;
    if (!value.trim()) return;
    setCurations(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      text: type === 'text' ? value : undefined,
      url: type === 'youtube' ? value : undefined,
      timestamp: new Date().toLocaleTimeString()
    }]);
    if (type === 'text') setInputText('');
    else setYtUrl('');
  };

  const handleGenerate = async () => {
    if (curations.length === 0 && !inputText.trim()) {
      setError("Please harvest some content first.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      let currentPrices = marketTrends;
      let currentSources: {title: string, uri: string}[] = [];
      
      if (includeMarket) {
        setLoadingStep('Grounding SAFEX Prices...');
        const fresh = await fetchMarketTrends();
        if (fresh) {
          setMarketTrends(fresh.prices);
          setMarketAsOf(fresh.asOf);
          setMarketSources(fresh.sources);
          currentPrices = fresh.prices;
          currentSources = fresh.sources;
        }
      }

      setLoadingStep('Synthesizing "The Yield" Copy...');
      const data = await generateNewsletter(curations, includeMarket ? currentPrices : null, currentSources);
      setNewsletter(data);
      setCurations([]);

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
            setLoadingStep('Rate Limit Cooling (Free Tier)...');
            await sleep(15000); 
          }
        }
      }
      setIsLoading(false);
      setLoadingStep('');
    } catch (err: any) {
      setError("API limits reached. Please wait 45 seconds and try again.");
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-sm bg-white rounded-[3.5rem] p-12 shadow-2xl space-y-10">
           <div className="text-center">
              <div className="p-8 rounded-[2.5rem] bg-ag-green inline-block mb-6 shadow-2xl"><Sprout className="w-14 h-14 text-ag-gold" /></div>
              <h2 className="font-serif text-5xl font-black text-ag-green italic tracking-tighter">The Yield</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-300 mt-2">Editorial Portal</p>
           </div>
           <div className="space-y-4">
              <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="w-full bg-neutral-50 rounded-2xl p-5 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
              <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey" className="w-full bg-neutral-50 rounded-2xl p-5 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green outline-none" />
           </div>
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-transform">
             {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "Open Desk"}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-black uppercase animate-bounce">Access Denied</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900 selection:bg-ag-gold/30">
      <input type="file" ref={fileInputRef} className="hidden" />
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-center items-center p-6" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-10 border-b flex justify-between items-center bg-neutral-50">
              <div className="flex gap-8">
                <button onClick={() => setSettingsTab('email')} className={`text-[10px] font-black uppercase tracking-widest pb-3 ${settingsTab === 'email' ? 'text-ag-green border-b-4 border-ag-gold' : 'text-neutral-300'}`}>Dispatch System</button>
                <button onClick={() => setSettingsTab('subscribers')} className={`text-[10px] font-black uppercase tracking-widest pb-3 ${settingsTab === 'subscribers' ? 'text-ag-green border-b-4 border-ag-gold' : 'text-neutral-300'}`}>Subscriber DB ({subscribers.length})</button>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-3 bg-neutral-100 rounded-full hover:bg-neutral-200 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-10 max-h-[60vh] overflow-y-auto">
              {settingsTab === 'email' ? (
                <div className="space-y-8">
                  <div className="p-6 bg-ag-green/5 rounded-3xl border border-ag-green/10 flex gap-4 items-start">
                    <Send className="w-5 h-5 text-ag-green mt-1"/>
                    <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">Configured for EmailJS dispatch. These credentials allow you to send "The Yield" directly to your subscriber list from the preview window.</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 mb-2 block">Service ID</label>
                    <input type="text" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} placeholder="service_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 mb-2 block">Template ID</label>
                    <input type="text" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} placeholder="template_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 mb-2 block">Public Key</label>
                    <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} placeholder="pk_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-ag-green" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-neutral-50 p-6 rounded-[2.5rem] grid grid-cols-2 gap-4 border">
                    <input type="text" value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Reader Name" className="bg-white rounded-xl p-3 text-xs font-bold border-none ring-1 ring-neutral-200" />
                    <input type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="email@agriants.co.za" className="bg-white rounded-xl p-3 text-xs font-bold border-none ring-1 ring-neutral-200" />
                    <button onClick={() => { if(newSubEmail) { setSubscribers([...subscribers, {id: crypto.randomUUID(), name: newSubName, email: newSubEmail, addedAt: new Date().toISOString()}]); setNewSubName(''); setNewSubEmail(''); } }} className="col-span-2 bg-ag-green text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110">Add To Colony</button>
                  </div>
                  <div className="space-y-3">
                    {subscribers.map(sub => (
                      <div key={sub.id} className="p-5 bg-white border rounded-2xl flex justify-between items-center group hover:border-ag-green transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center text-[10px] font-black text-neutral-400 uppercase">{sub.name.charAt(0)}</div>
                          <div><p className="text-xs font-black text-ag-green">{sub.name}</p><p className="text-[10px] text-neutral-400 font-medium">{sub.email}</p></div>
                        </div>
                        <button onClick={() => setSubscribers(subscribers.filter(s => s.id !== sub.id))} className="text-neutral-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    {subscribers.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-neutral-300">No readers indexed.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-20 border-b bg-white sticky top-0 z-50 px-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Sprout className="w-9 h-9 text-ag-green" />
          <h1 className="text-2xl font-black text-ag-green tracking-tighter uppercase italic">The Yield</h1>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setShowSettings(true)} className="p-3 text-neutral-400 hover:bg-neutral-50 rounded-full transition-all group">
            <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-700"/>
          </button>
          <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-10 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-ag-green/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate Edition
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="text-neutral-200 hover:text-red-500 transition-colors"><LogOut className="w-6 h-6"/></button>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto p-10 grid grid-cols-1 lg:grid-cols-2 gap-20">
        
        {/* Editorial Harvest Desk */}
        <div className="space-y-10">
          <section className="bg-white rounded-[3.5rem] p-10 border shadow-sm space-y-10">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-3"><Layers className="w-4 h-4" /> Editorial Harvest</h3>
              <div className="flex gap-4">
                <button onClick={() => setCurations([])} className="text-[10px] font-black uppercase text-neutral-300 hover:text-red-500">Purge Pipeline</button>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="relative group">
                <textarea 
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  placeholder="Paste YouTube transcripts, journals, or news snippets here..." 
                  className="w-full h-64 bg-neutral-50 rounded-[2.5rem] p-10 text-sm font-medium border-none ring-1 ring-neutral-100 focus:ring-4 focus:ring-ag-green/10 shadow-inner resize-none transition-all placeholder:text-neutral-300" 
                />
                <button 
                  onClick={() => addToPipeline('text')}
                  className="absolute bottom-6 right-6 px-6 py-3 bg-ag-green text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
                >
                  Index Text
                </button>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 relative">
                   <Youtube className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-red-600" />
                   <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="Link YouTube Transcript" className="w-full bg-neutral-50 rounded-2xl pl-14 pr-6 py-4 text-xs font-bold border-none ring-1 ring-neutral-100" />
                </div>
                <button onClick={() => addToPipeline('youtube')} className="px-6 bg-ag-green text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Plus className="w-6 h-6"/></button>
              </div>

              <div className="pt-8 border-t space-y-8">
                <h4 className="text-[10px] font-black uppercase text-neutral-300 tracking-[0.3em]">Curated Assets</h4>
                <div className="grid grid-cols-3 gap-6">
                  <button onClick={() => handleFileUpload('image')} className="flex flex-col items-center gap-4 p-8 bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-100 hover:border-ag-green hover:bg-ag-green/5 transition-all group">
                    <ImageIcon className="w-7 h-7 text-neutral-300 group-hover:text-ag-green" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-ag-green">Upload Frame</span>
                  </button>
                  <button onClick={() => handleFileUpload('video')} className="flex flex-col items-center gap-4 p-8 bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-100 hover:border-ag-green hover:bg-ag-green/5 transition-all group">
                    <Video className="w-7 h-7 text-neutral-300 group-hover:text-ag-green" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-ag-green">Upload Clip</span>
                  </button>
                  <button onClick={() => handleFileUpload('audio')} className="flex flex-col items-center gap-4 p-8 bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-100 hover:border-ag-green hover:bg-ag-green/5 transition-all group">
                    <Mic className="w-7 h-7 text-neutral-300 group-hover:text-ag-green" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-ag-green">Upload Voice</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-8 border-t">
                 <label className="flex items-center gap-4 p-6 bg-neutral-50 rounded-2xl border cursor-pointer hover:bg-neutral-100 group transition-colors">
                    <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-6 h-6 rounded text-ag-green border-neutral-300" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-neutral-600">SAFEX Grounding</span>
                      <span className="text-[8px] font-bold text-neutral-400 uppercase">Live Market Data</span>
                    </div>
                 </label>
                 <label className="flex items-center gap-4 p-6 bg-neutral-50 rounded-2xl border cursor-pointer hover:bg-neutral-100 group transition-colors">
                    <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)} className="w-6 h-6 rounded text-ag-green border-neutral-300" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-neutral-600">Flash Visuals</span>
                      <span className="text-[8px] font-bold text-neutral-400 uppercase">AI Image Harvest</span>
                    </div>
                 </label>
              </div>
            </div>
          </section>

          {curations.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-left duration-700">
              <p className="text-[11px] font-black uppercase text-neutral-300 px-6 tracking-widest">Synthesis Pipeline ({curations.length})</p>
              <div className="space-y-3">
                {curations.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between group hover:border-ag-green transition-all">
                    <div className="flex items-center gap-5">
                      <div className="p-3 bg-neutral-50 rounded-xl">
                        {item.type === 'youtube' && <Youtube className="w-5 h-5 text-red-600" />}
                        {item.type === 'image' && <ImageIcon className="w-5 h-5 text-ag-green" />}
                        {item.type === 'video' && <Video className="w-5 h-5 text-ag-green" />}
                        {item.type === 'audio' && <Mic className="w-5 h-5 text-ag-green" />}
                        {item.type === 'text' && <FileText className="w-5 h-5 text-ag-green" />}
                      </div>
                      <div>
                        <span className="text-xs font-black text-neutral-700 truncate max-w-[300px] block">{item.url || item.text || 'Fragment'}</span>
                        <span className="text-[9px] font-bold text-neutral-400 uppercase">{item.type} • {item.timestamp}</span>
                      </div>
                    </div>
                    <button onClick={() => setCurations(curations.filter(c => c.id !== item.id))} className="text-neutral-200 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-8 bg-red-50 border-2 border-red-100 text-red-600 rounded-[2.5rem] text-xs font-bold flex gap-5 items-center animate-pulse">
              <AlertCircle className="w-7 h-7 flex-shrink-0"/>
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Live "Morning Brew" Preview */}
        <div className="bg-white rounded-[4.5rem] border-2 shadow-2xl min-h-[1200px] relative overflow-hidden flex flex-col no-print selection:bg-ag-gold/50">
           {loadingStep && (
             <div className="absolute top-0 left-0 w-full z-50 p-6 bg-ag-green text-white text-[10px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-6 shadow-xl">
               <Loader2 className="w-5 h-5 animate-spin text-ag-gold" /><span>{loadingStep}</span>
             </div>
           )}

           <div className="p-20 flex-1 overflow-y-auto">
             {newsletter ? (
               <div className="animate-in fade-in duration-1000 space-y-28">
                  <header className="text-center">
                    <div className="p-12 rounded-[3.5rem] bg-ag-green inline-block mb-12 shadow-2xl shadow-ag-green/30"><Sprout className="w-20 h-20 text-ag-gold" /></div>
                    <h2 className="font-serif text-8xl font-black text-ag-green italic mb-4 tracking-tighter leading-none">The Yield</h2>
                    <p className="text-[12px] font-black uppercase tracking-[0.8em] text-neutral-200 mb-16">{newsletter.generatedAt}</p>
                    <p className="text-3xl font-light italic text-neutral-500 leading-relaxed border-y py-16 max-w-2xl mx-auto border-neutral-100">"{newsletter.header.vibeCheck}"</p>
                  </header>

                  <div className="space-y-28">
                    {/* Live Market Section */}
                    {marketTrends.length > 0 && (
                      <div className="bg-neutral-50 rounded-[4rem] border-2 border-neutral-100 overflow-hidden shadow-sm">
                         <div className="bg-ag-green px-14 py-10 flex justify-between items-center text-white">
                            <div className="flex items-center gap-4">
                              <TrendingUp className="w-6 h-6 text-ag-gold" />
                              <h4 className="text-[13px] font-black uppercase tracking-[0.4em]">SAFEX Markets (RSA)</h4>
                            </div>
                            <span className="text-[10px] font-bold opacity-60">UPDATED: {marketAsOf}</span>
                         </div>
                         <div className="divide-y divide-neutral-200">
                            {marketTrends.map((m, i) => (
                              <div key={i} className="flex items-center justify-between py-10 px-14 hover:bg-neutral-100 transition-colors group">
                                <div className="flex flex-col">
                                  <span className="text-[12px] font-black text-neutral-800 uppercase tracking-widest">{m.name}</span>
                                  <span className="text-[10px] text-neutral-400 font-bold">{m.confirmDate || 'Confirmed'}</span>
                                </div>
                                <div className="flex items-center gap-10">
                                  <span className="text-2xl font-black text-ag-green tracking-tighter">{m.price}</span>
                                  <div className="hidden sm:block opacity-20 group-hover:opacity-100 transition-opacity">
                                    <TrendingUp className="w-6 h-6 text-ag-green"/>
                                  </div>
                                </div>
                              </div>
                            ))}
                         </div>
                         {/* Grounding Sources Rendering */}
                         {newsletter.sources && newsletter.sources.length > 0 && (
                           <div className="bg-neutral-100/50 p-8 border-t">
                              <h5 className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-4 px-6">Grounding Sources</h5>
                              <div className="flex flex-wrap gap-4 px-6">
                                 {newsletter.sources.map((src, i) => (
                                   <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-ag-green flex items-center gap-2 hover:underline">
                                     <ExternalLink className="w-3 h-3"/> {src.title || 'Market Source'}
                                   </a>
                                 ))}
                              </div>
                           </div>
                         )}
                      </div>
                    )}

                    {/* Editorial Sections */}
                    {newsletter.sections.map((s, idx) => (
                      <section key={idx} className="space-y-14">
                         <div className="flex items-center gap-10">
                            <h3 className="text-sm font-black uppercase tracking-[0.5em] text-ag-green bg-ag-green/5 px-10 py-4 rounded-3xl border border-ag-green/10">{s.title}</h3>
                            <div className="h-px bg-neutral-100 flex-1" />
                         </div>
                         <div className="aspect-video bg-neutral-50 rounded-[4.5rem] overflow-hidden border-2 border-neutral-50 flex items-center justify-center shadow-2xl group relative">
                            {s.imageUrl ? (
                              <img src={s.imageUrl} className="w-full h-full object-cover transition-transform duration-[6s] group-hover:scale-110" alt={s.title} />
                            ) : generateImages ? (
                               <div className="flex flex-col items-center gap-8 text-neutral-200 animate-pulse">
                                 <Loader2 className="w-16 h-16 animate-spin" />
                                 <span className="text-[11px] font-black uppercase tracking-[0.3em]">Harvesting Visual Insight...</span>
                               </div>
                            ) : <ImageIcon className="w-24 h-24 text-neutral-100" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         </div>
                         <div 
                           className="text-3xl font-light leading-[2] text-neutral-800 tracking-tight" 
                           dangerouslySetInnerHTML={{ 
                             __html: s.content
                               .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>')
                               .replace(/\n/g, '<br/>') 
                           }} 
                         />
                      </section>
                    ))}

                    {/* Community Hub: Fixed & Polished */}
                    <div className="pt-28 border-t-2 border-neutral-100 grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="p-12 bg-white border rounded-[3.5rem] text-center space-y-6 hover:shadow-2xl hover:-translate-y-2 transition-all">
                        <div className="w-16 h-16 bg-ag-green/5 rounded-3xl flex items-center justify-center mx-auto"><Heart className="w-8 h-8 text-ag-green" /></div>
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-ag-green">Donation Station</h4>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">Empower local producers through digital infra.</p>
                        <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Make Impact</button>
                      </div>
                      <div className="p-12 bg-white border rounded-[3.5rem] text-center space-y-6 hover:shadow-2xl hover:-translate-y-2 transition-all">
                        <div className="w-16 h-16 bg-ag-green/5 rounded-3xl flex items-center justify-center mx-auto"><Share2 className="w-8 h-8 text-ag-green" /></div>
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-ag-green">Referral Center</h4>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">Scale the colony. Invite pros, earn premium perks.</p>
                        <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Invite Pro</button>
                      </div>
                      <div className="p-12 bg-white border rounded-[3.5rem] text-center space-y-6 hover:shadow-2xl hover:-translate-y-2 transition-all">
                        <div className="w-16 h-16 bg-ag-green/5 rounded-3xl flex items-center justify-center mx-auto"><Handshake className="w-8 h-8 text-ag-green" /></div>
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-ag-green">Partners Hub</h4>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">B2B ecosystem for innovative agri-tech brands.</p>
                        <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Join Network</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-40 pt-28 border-t-2 border-neutral-100 text-center pb-20 no-print">
                    <div className="p-12 bg-neutral-50 rounded-[4rem] mb-20 border border-neutral-100">
                      <p className="text-xl font-black text-ag-green italic mb-10">Visit the AGRIANTS shop for artisanal honey & energy balls.</p>
                      <div className="flex flex-wrap gap-8 justify-center">
                         <button onClick={() => alert(`Dispatching to ${subscribers.length} reader profiles...`)} className="bg-ag-green text-white px-14 py-8 rounded-[3rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-ag-green/30 flex items-center gap-4 hover:brightness-110 active:scale-95 transition-all">
                           <Send className="w-6 h-6 text-ag-gold" /> Send to Readers
                         </button>
                         <button onClick={() => window.print()} className="bg-white p-8 rounded-[3rem] border-2 border-neutral-100 hover:bg-neutral-50 transition-all text-neutral-400 flex items-center gap-4 font-black uppercase text-[12px] tracking-widest">
                           <Download className="w-7 h-7" /> Export PDF
                         </button>
                      </div>
                    </div>
                    <div className="flex justify-center gap-12 text-neutral-200">
                       <Globe className="w-6 h-6"/>
                       <Sprout className="w-6 h-6"/>
                       <Zap className="w-6 h-6"/>
                    </div>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-16">
                 <div className="opacity-10 animate-pulse">
                    <Sprout className="w-56 h-56 text-ag-green mb-14 mx-auto" />
                    <h2 className="font-serif text-8xl font-black italic tracking-tighter">The Yield</h2>
                 </div>
                 <div className="space-y-6 max-w-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-neutral-300">Curation Desk Idle</p>
                    <p className="text-xs font-medium text-neutral-300 italic">"The best fertilizer for any crop is the producer's shadow—and their data."</p>
                 </div>
                 <div className="flex gap-10 opacity-20">
                    <ImageIcon className="w-6 h-6" />
                    <Video className="w-6 h-6" />
                    <Mic className="w-6 h-6" />
                    <Youtube className="w-6 h-6" />
                 </div>
               </div>
             )}
           </div>
        </div>
      </main>
      
      <footer className="py-24 text-center opacity-30 border-t mt-20 no-print">
         <p className="text-[12px] font-black uppercase tracking-[0.8em] text-neutral-400">AGRIANTS PRIMARY COOPERATIVE • THE YIELD 2025</p>
         <p className="text-[9px] font-bold uppercase tracking-widest mt-4">Pretoria, South Africa</p>
      </footer>
    </div>
  );
};

export default App;
