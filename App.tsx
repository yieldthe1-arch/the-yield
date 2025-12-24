
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, TrendingUp, Loader2, AlertCircle, Plus, Trash2,
  FileText, Youtube, Zap, X, Settings, LogOut, Layers, Send,
  Download, Share2, Heart, Image as ImageIcon, Globe, Handshake, Video, Mic, ExternalLink
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
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<{msg: string, type: 'quota' | 'rate' | 'general'} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('agriants_subs', JSON.stringify(subscribers));
    localStorage.setItem('agriants_email_cfg', JSON.stringify(emailConfig));
  }, [subscribers, emailConfig]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(false);
    await sleep(800);
    if (authEmail === AUTHORIZED_EMAIL && authPassword === AUTHORIZED_PASSKEY) {
      setIsAuthenticated(true);
    } else {
      setLoginError(true);
    }
    setIsLoggingIn(false);
  };

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
    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      let currentPrices = marketTrends;
      let currentSources: {title: string, uri: string}[] = [];
      
      if (includeMarket) {
        setLoadingStep('Grounding SAFEX & Honey Benchmarks...');
        const fresh = await fetchMarketTrends();
        if (fresh) {
          setMarketTrends(fresh.prices);
          setMarketAsOf(fresh.asOf);
          currentPrices = fresh.prices;
          currentSources = fresh.sources;
        }
      }

      setLoadingStep('Drafting The Yield (Editorial Synthesis)...');
      const data = await generateNewsletter(curations, includeMarket ? currentPrices : null, currentSources);
      setNewsletter(data);
      setCurations([]);

      if (generateImages) {
        for (let i = 0; i < data.sections.length; i++) {
          setLoadingStep(`Harvesting Visual ${i+1}/${data.sections.length}...`);
          try {
            const url = await generateImage(data.sections[i].imagePrompt);
            if (url) {
              setNewsletter(prev => {
                if (!prev) return null;
                const newSections = [...prev.sections];
                newSections[i] = { ...newSections[i], imageUrl: url };
                return { ...prev, sections: newSections };
              });
            }
          } catch (imgErr: any) {
            if (imgErr.message === "DAILY_QUOTA_EXHAUSTED") {
               setError({ msg: "Daily Image Quota reached. Text content preserved.", type: 'quota' });
               break; 
            }
          }
          if (i < data.sections.length - 1) {
            setLoadingStep('Rate Limit Safety (Free Tier)...');
            await sleep(15000); 
          }
        }
      }
      setIsLoading(false);
      setLoadingStep('');
    } catch (err: any) {
      if (err.message === "DAILY_QUOTA_EXHAUSTED") {
        setError({ msg: "Daily API Quota Exhausted (20/20). Please try again tomorrow.", type: 'quota' });
      } else {
        setError({ msg: "The engine is saturated. Please wait 60s and try again.", type: 'rate' });
      }
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-[3.5rem] p-12 shadow-2xl space-y-10">
           <div className="text-center">
              <div className="p-8 rounded-[2.5rem] bg-ag-green inline-block mb-6 shadow-2xl"><Sprout className="w-14 h-14 text-ag-gold" /></div>
              <h2 className="font-serif text-5xl font-black text-ag-green italic tracking-tighter">The Yield</h2>
           </div>
           <div className="space-y-4">
              <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="w-full bg-neutral-50 rounded-2xl p-5 text-sm font-bold border-none ring-1 ring-neutral-200 outline-none" />
              <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Passkey" className="w-full bg-neutral-50 rounded-2xl p-5 text-sm font-bold border-none ring-1 ring-neutral-200 outline-none" />
           </div>
           <button disabled={isLoggingIn} className="w-full bg-ag-green text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-transform">
             {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "Unlock Editor"}
           </button>
           {loginError && <p className="text-center text-[10px] text-red-500 font-black uppercase animate-pulse">Denied</p>}
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
              <button onClick={() => setShowSettings(false)} className="p-3 bg-neutral-100 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-10 max-h-[60vh] overflow-y-auto">
              {settingsTab === 'email' ? (
                <div className="space-y-8">
                  <div className="p-6 bg-ag-green/5 rounded-3xl border border-ag-green/10 flex gap-4 items-start">
                    <Send className="w-5 h-5 text-ag-green mt-1"/>
                    <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">Connect EmailJS to automate dispatch to your readers.</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 mb-2 block">Service ID</label>
                    <input type="text" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} placeholder="service_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-neutral-400 mb-2 block">Public Key</label>
                    <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} placeholder="pk_xxxx" className="w-full bg-neutral-50 rounded-xl p-4 text-sm font-bold border-none ring-1 ring-neutral-200" />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-neutral-50 p-6 rounded-[2.5rem] grid grid-cols-2 gap-4 border">
                    <input type="text" value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="Name" className="bg-white rounded-xl p-3 text-xs font-bold border-none ring-1 ring-neutral-200" />
                    <input type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} placeholder="Email" className="bg-white rounded-xl p-3 text-xs font-bold border-none ring-1 ring-neutral-200" />
                    <button onClick={() => { if(newSubEmail) { setSubscribers([...subscribers, {id: crypto.randomUUID(), name: newSubName, email: newSubEmail, addedAt: new Date().toISOString()}]); setNewSubName(''); setNewSubEmail(''); } }} className="col-span-2 bg-ag-green text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Add To Reader List</button>
                  </div>
                  {subscribers.map(sub => (
                    <div key={sub.id} className="p-5 bg-white border rounded-2xl flex justify-between items-center group">
                      <div><p className="text-xs font-black text-ag-green">{sub.name}</p><p className="text-[10px] text-neutral-400">{sub.email}</p></div>
                      <button onClick={() => setSubscribers(subscribers.filter(s => s.id !== sub.id))} className="text-neutral-200 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
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
          <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-10 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl active:scale-95 transition-all">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} Generate Edition
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="text-neutral-200 hover:text-red-500"><LogOut className="w-6 h-6"/></button>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto p-10 grid grid-cols-1 lg:grid-cols-2 gap-20">
        
        {/* Editorial Desk */}
        <div className="space-y-10">
          <section className="bg-white rounded-[3.5rem] p-10 border shadow-sm space-y-10">
            <h3 className="text-[11px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-3"><Layers className="w-4 h-4" /> Editorial Harvest</h3>
            
            <div className="space-y-6">
              <textarea 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                placeholder="Paste YouTube transcripts, news snippets, or business reports here..." 
                className="w-full h-64 bg-neutral-50 rounded-[2.5rem] p-10 text-sm font-medium border-none ring-1 ring-neutral-100 focus:ring-4 focus:ring-ag-green/10 shadow-inner resize-none transition-all placeholder:text-neutral-300" 
              />
              <button onClick={() => addToPipeline('text')} className="w-full bg-ag-green/5 text-ag-green py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-ag-green/10 hover:bg-ag-green hover:text-white transition-all">Submit Text to Pipeline</button>

              <div className="flex gap-4">
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="YouTube Link for Transcript" className="flex-1 bg-neutral-50 rounded-2xl px-6 py-4 text-xs font-bold border-none ring-1 ring-neutral-100" />
                <button onClick={() => addToPipeline('youtube')} className="px-6 bg-ag-green text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Plus className="w-6 h-6"/></button>
              </div>

              <div className="pt-8 border-t space-y-8">
                <h4 className="text-[10px] font-black uppercase text-neutral-300 tracking-[0.3em]">Multi-modal Harvest</h4>
                <div className="grid grid-cols-3 gap-6">
                  <button onClick={() => handleFileUpload('image')} className="flex flex-col items-center gap-4 p-8 bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-100 hover:border-ag-green transition-all group">
                    <ImageIcon className="w-7 h-7 text-neutral-300 group-hover:text-ag-green" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Image</span>
                  </button>
                  <button onClick={() => handleFileUpload('video')} className="flex flex-col items-center gap-4 p-8 bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-100 hover:border-ag-green transition-all group">
                    <Video className="w-7 h-7 text-neutral-300 group-hover:text-ag-green" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Video</span>
                  </button>
                  <button onClick={() => handleFileUpload('audio')} className="flex flex-col items-center gap-4 p-8 bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-100 hover:border-ag-green transition-all group">
                    <Mic className="w-7 h-7 text-neutral-300 group-hover:text-ag-green" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Audio</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-8 border-t">
                 <label className="flex items-center gap-4 p-6 bg-neutral-50 rounded-2xl border cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-6 h-6 rounded text-ag-green border-neutral-300" />
                    <span className="text-[10px] font-black uppercase text-neutral-600">Include Market Search</span>
                 </label>
                 <label className="flex items-center gap-4 p-6 bg-neutral-50 rounded-2xl border cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input type="checkbox" checked={generateImages} onChange={e => setGenerateImages(e.target.checked)} className="w-6 h-6 rounded text-ag-green border-neutral-300" />
                    <span className="text-[10px] font-black uppercase text-neutral-600">Generate Visuals</span>
                 </label>
              </div>
            </div>
          </section>

          {curations.length > 0 && (
            <div className="space-y-3 animate-in slide-in-from-left">
              <p className="text-[11px] font-black uppercase text-neutral-300 px-6 tracking-widest">Synthesis Pipeline ({curations.length})</p>
              {curations.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[2rem] border shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-neutral-50 rounded-xl">
                      {item.type === 'youtube' ? <Youtube className="w-5 h-5 text-red-600" /> : <FileText className="w-5 h-5 text-ag-green" />}
                    </div>
                    <span className="text-xs font-black text-neutral-700 truncate max-w-[300px]">{item.url || item.text}</span>
                  </div>
                  <button onClick={() => setCurations(curations.filter(c => c.id !== item.id))} className="text-neutral-200 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                </div>
              ))}
            </div>
          )}
          
          {error && (
            <div className={`p-8 border-2 rounded-[2.5rem] text-xs font-bold flex gap-5 items-center animate-pulse ${error.type === 'quota' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
              <AlertCircle className="w-7 h-7 flex-shrink-0"/>
              <p>{error.msg}</p>
            </div>
          )}
        </div>

        {/* Live Preview */}
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
                    <h2 className="font-serif text-8xl font-black text-ag-green italic mb-4 tracking-tighter">The Yield</h2>
                    <p className="text-[12px] font-black uppercase tracking-[0.8em] text-neutral-200 mb-16">{newsletter.generatedAt}</p>
                    <p className="text-3xl font-light italic text-neutral-500 leading-relaxed border-y py-16 max-w-2xl mx-auto border-neutral-100">"{newsletter.header.vibeCheck}"</p>
                  </header>

                  <div className="space-y-28">
                    {marketTrends.length > 0 && (
                      <div className="bg-neutral-50 rounded-[4rem] border-2 border-neutral-100 overflow-hidden shadow-sm">
                         <div className="bg-ag-green px-14 py-10 flex justify-between items-center text-white">
                            <h4 className="text-[13px] font-black uppercase tracking-[0.4em]">SAFEX Markets (RSA)</h4>
                            <span className="text-[10px] font-bold opacity-60">CONFIRMED: {marketAsOf}</span>
                         </div>
                         <div className="divide-y divide-neutral-200">
                            {marketTrends.map((m, i) => (
                              <div key={i} className="flex items-center justify-between py-10 px-14 hover:bg-neutral-100 transition-colors">
                                <div className="flex flex-col">
                                  <span className="text-[12px] font-black text-neutral-800 uppercase tracking-widest">{m.name}</span>
                                  <span className="text-[10px] text-neutral-400 font-bold">{m.confirmDate || 'Live'}</span>
                                </div>
                                <span className="text-2xl font-black text-ag-green tracking-tighter">{m.price}</span>
                              </div>
                            ))}
                         </div>
                         {newsletter.sources && newsletter.sources.length > 0 && (
                           <div className="bg-neutral-100 p-8 border-t flex flex-wrap gap-4 justify-center">
                              {newsletter.sources.map((src, i) => (
                                <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-ag-green flex items-center gap-2 hover:underline">
                                  <ExternalLink className="w-3 h-3"/> {src.title || 'Market Source'}
                                </a>
                              ))}
                           </div>
                         )}
                      </div>
                    )}

                    {newsletter.sections.map((s, idx) => (
                      <section key={idx} className="space-y-14">
                         <div className="flex items-center gap-10">
                            <h3 className="text-sm font-black uppercase tracking-[0.5em] text-ag-green bg-ag-green/5 px-10 py-4 rounded-3xl border border-ag-green/10">{s.title}</h3>
                            <div className="h-px bg-neutral-100 flex-1" />
                         </div>
                         <div className="aspect-video bg-neutral-50 rounded-[4.5rem] overflow-hidden border-2 border-neutral-50 flex items-center justify-center shadow-2xl group">
                            {s.imageUrl ? (
                              <img src={s.imageUrl} className="w-full h-full object-cover transition-transform duration-[6s] group-hover:scale-110" alt={s.title} />
                            ) : generateImages ? (
                               <div className="flex flex-col items-center gap-8 text-neutral-200 animate-pulse">
                                 <Loader2 className="w-16 h-16 animate-spin" />
                                 <span className="text-[11px] font-black uppercase tracking-[0.3em]">Harvesting Visual Insight...</span>
                               </div>
                            ) : <ImageIcon className="w-24 h-24 text-neutral-100" />}
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

                    <div className="pt-28 border-t-2 border-neutral-100 grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="p-12 bg-white border rounded-[3.5rem] text-center space-y-6 hover:shadow-2xl transition-all">
                        <Heart className="w-10 h-10 text-ag-green mx-auto" />
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-ag-green">Donation Station</h4>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">Empower local producers through digital infra.</p>
                        <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Impact</button>
                      </div>
                      <div className="p-12 bg-white border rounded-[3.5rem] text-center space-y-6 hover:shadow-2xl transition-all">
                        <Share2 className="w-10 h-10 text-ag-green mx-auto" />
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-ag-green">Referral Center</h4>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">Grow the colony. Earn premium AGRIANTS perks.</p>
                        <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Invite</button>
                      </div>
                      <div className="p-12 bg-white border rounded-[3.5rem] text-center space-y-6 hover:shadow-2xl transition-all">
                        <Handshake className="w-10 h-10 text-ag-green mx-auto" />
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-ag-green">Partners Hub</h4>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">B2B ecosystem for innovative agri-tech brands.</p>
                        <button className="text-[10px] font-black uppercase text-ag-green border-b-2 border-ag-gold pb-1 pt-2">Partner</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-40 pt-28 border-t-2 border-neutral-100 text-center pb-20 no-print">
                    <p className="text-xl font-black text-ag-green italic mb-16">Visit the AGRIANTS shop for artisanal honey & energy balls.</p>
                    <div className="flex flex-wrap gap-8 justify-center">
                       <button onClick={() => alert(`Dispatching to reader profiles...`)} className="bg-ag-green text-white px-14 py-8 rounded-[3rem] font-black text-sm uppercase tracking-widest shadow-2xl flex items-center gap-4 hover:scale-105 transition-all">
                         <Send className="w-6 h-6 text-ag-gold" /> Send to Readers
                       </button>
                       <button onClick={() => window.print()} className="bg-white p-8 rounded-[3rem] border-2 border-neutral-100 hover:bg-neutral-50 transition-all text-neutral-400 flex items-center gap-4 font-black uppercase text-[12px] tracking-widest">
                         <Download className="w-7 h-7" /> Export PDF
                       </button>
                    </div>
                  </div>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-16">
                 <div className="opacity-10 animate-pulse">
                    <Sprout className="w-56 h-56 text-ag-green mb-14 mx-auto" />
                    <h2 className="font-serif text-8xl font-black italic tracking-tighter">The Yield</h2>
                 </div>
                 <p className="text-[11px] font-black uppercase tracking-[0.5em] text-neutral-300 max-w-sm leading-loose">"The best fertilizer for any crop is the producer's shadow—and their data."</p>
               </div>
             )}
           </div>
        </div>
      </main>
      
      <footer className="py-24 text-center opacity-30 border-t mt-20 no-print">
         <p className="text-[12px] font-black uppercase tracking-[0.8em] text-neutral-400">AGRIANTS PRIMARY COOPERATIVE • THE YIELD 2025</p>
      </footer>
    </div>
  );
};

export default App;
