import React, { useState, useEffect } from 'react';
import { 
  Sprout, Copy, TrendingUp, Loader2,
  AlertCircle, Plus, Trash2, RefreshCw,
  FileText, Youtube, Zap, X, Settings, LogOut, Printer, Layers
} from 'lucide-react';
import { generateNewsletter, fetchMarketTrends, generateImage } from './services/geminiService';
import { NewsletterData, CurationItem, CommodityPrice, EmailConfig } from './types';

const AUTHORIZED_EMAIL = "yieldthe1@gmail.com";
const AUTHORIZED_PASSKEY = "AGRIANTS2025"; 

const Sparkline = ({ data, color = "#2D5A27", width = 100, height = 30 }: { data: number[], color?: string, width?: number, height?: number }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
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
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMarket, setIsFetchingMarket] = useState(false);
  const [marketTrends, setMarketTrends] = useState<CommodityPrice[]>([]);
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    senderName: 'AGRIANTS Editor',
    senderEmail: AUTHORIZED_EMAIL,
    provider: 'emailjs',
    apiKey: '',
    serviceId: '',
    templateId: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      loadMarketTrends();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setIsLoggingIn(true);
    
    await new Promise(r => setTimeout(r, 800));

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
    try { 
      const data = await fetchMarketTrends(); 
      if (data && data.length > 0) {
        setMarketTrends(data);
      }
    } catch (err) { 
      console.error("Market fetch error:", err); 
    } finally { 
      setIsFetchingMarket(false); 
    }
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
      setError("No content found. Add items to the stack or type in the box.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setNewsletter(null);

    try {
      const data = await generateNewsletter(activeContent, includeMarket);
      const sectionsWithImages = await Promise.all(data.sections.map(async (s) => ({
        ...s,
        imageUrl: await generateImage(s.imagePrompt)
      })));
      setNewsletter({ ...data, sections: sectionsWithImages });
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "Failed to generate newsletter. Check your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-ag-green flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-500">
           <div className="text-center mb-10">
              <div className="p-5 rounded-3xl bg-ag-green inline-block mb-6 shadow-xl">
                <Sprout className="w-10 h-10 text-ag-gold" />
              </div>
              <h2 className="font-serif text-4xl font-black text-ag-green italic tracking-tighter mb-2">The Yield</h2>
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.4em]">Editor Portal</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-1">Email</label>
                 <input 
                   required 
                   type="email" 
                   value={authEmail} 
                   onChange={e => setAuthEmail(e.target.value)} 
                   placeholder="yieldthe1@gmail.com" 
                   className="w-full bg-neutral-50 border-neutral-100 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none" 
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-1">Passkey</label>
                 <input 
                   required 
                   type="password" 
                   value={authPassword} 
                   onChange={e => setAuthPassword(e.target.value)} 
                   placeholder="••••••••" 
                   className={`w-full bg-neutral-50 border-neutral-100 rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-ag-green outline-none ${loginError ? 'border-rose-300 ring-rose-100 ring-4' : ''}`} 
                 />
                 {loginError && <p className="text-[10px] text-rose-500 font-bold mt-1">Invalid credentials.</p>}
              </div>

              <button 
                disabled={isLoggingIn} 
                type="submit" 
                className="w-full bg-ag-green text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin"/> : "Unlock Access"}
              </button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-neutral-900 font-sans selection:bg-green-100">
      
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-ag-green/20 backdrop-blur-sm flex justify-end">
           <div className="w-full max-w-lg bg-white shadow-2xl p-10 flex flex-col animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <Settings className="w-6 h-6 text-ag-green" /> Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-neutral-50 rounded-full transition-all">
                  <X className="w-6 h-6"/>
                </button>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-900 leading-relaxed font-medium">
                  Configuring the distribution layer. Ensure your templates match the defined output keys.
                </div>
                <div className="space-y-4">
                  <input type="password" value={emailConfig.apiKey} onChange={e => setEmailConfig({...emailConfig, apiKey: e.target.value})} placeholder="Service Key" className="w-full bg-neutral-50 border-neutral-100 rounded-xl p-4 text-sm font-bold shadow-inner" />
                  <input placeholder="Service ID" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} className="w-full bg-neutral-50 border-neutral-100 rounded-xl p-4 text-sm font-bold shadow-inner" />
                  <input placeholder="Template ID" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} className="w-full bg-neutral-50 border-neutral-100 rounded-xl p-4 text-sm font-bold shadow-inner" />
                </div>
                <button onClick={() => setShowSettings(false)} className="w-full bg-ag-green text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest mt-4">Save Configuration</button>
              </div>
           </div>
        </div>
      )}

      <header className="border-b border-neutral-100 bg-white sticky top-0 z-50 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-ag-green p-2 rounded-xl">
            <Sprout className="w-6 h-6 text-ag-gold" />
          </div>
          <h1 className="text-xl font-black text-ag-green tracking-tighter uppercase">AGRIANTS</h1>
        </div>
        
        <div className="flex items-center gap-4">
           <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-neutral-50 rounded-full text-neutral-400 transition-all">
             <Settings className="w-5 h-5"/>
           </button>
           <button onClick={handleGenerate} disabled={isLoading} className="bg-ag-green text-white px-6 py-2.5 rounded-full font-black text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg active:scale-95 transition-all">
             {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-ag-gold" /> : <Zap className="w-4 h-4 text-ag-gold" />} 
             Generate Edition
           </button>
           <button onClick={() => setIsAuthenticated(false)} className="p-2 text-neutral-300 hover:text-rose-500">
             <LogOut className="w-5 h-5"/>
           </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Input Stream</h3>
            <textarea 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              placeholder="Paste raw data, YouTube transcripts, or article links here..." 
              className="w-full h-40 bg-neutral-50 border-none rounded-2xl p-6 text-sm font-medium focus:ring-2 focus:ring-ag-green shadow-inner resize-none" 
            />
            <div className="flex gap-3">
              <button onClick={() => handleAddCuration('text')} className="flex-1 bg-ag-green text-white py-3 rounded-xl text-xs font-black hover:opacity-90 transition-all shadow-md">
                Add to Stack
              </button>
              <div className="flex-[2] flex items-center bg-neutral-50 rounded-xl border border-neutral-100 px-4 shadow-sm">
                <Youtube className="w-4 h-4 text-red-600 mr-2" />
                <input 
                  value={ytUrl} 
                  onChange={e => setYtUrl(e.target.value)} 
                  placeholder="Paste YouTube Link" 
                  className="bg-transparent border-none text-xs flex-1 focus:ring-0 font-bold py-2" 
                />
                <button onClick={() => ytUrl.trim() && handleAddCuration('youtube', ytUrl.trim())} className="text-ag-green hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5"/>
                </button>
              </div>
            </div>
          </div>

          {curations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-2">Curation Stack</h4>
              <div className="space-y-2">
                {curations.map(c => (
                  <div key={c.id} className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-left duration-300">
                    <div className="flex items-center gap-3">
                      {c.type === 'text' ? <FileText className="w-4 h-4 text-ag-green"/> : <Youtube className="w-4 h-4 text-red-600" />}
                      <p className="text-xs font-bold truncate max-w-[200px]">{c.text || c.url}</p>
                    </div>
                    <button onClick={() => handleRemoveCuration(c.id)} className="text-neutral-300 hover:text-rose-500">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-8 border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-ag-green flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-ag-gold" /> Market Ticker
              </h3>
              <button onClick={loadMarketTrends} disabled={isFetchingMarket} className="text-ag-green hover:rotate-180 transition-all duration-500">
                <RefreshCw className={`w-4 h-4 ${isFetchingMarket ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {isFetchingMarket && marketTrends.length === 0 ? (
               <div className="py-4 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-ag-green opacity-20 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Pinging SAFEX...</p>
               </div>
            ) : marketTrends.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {marketTrends.map((item, i) => (
                  <div key={i} className="bg-neutral-50 p-5 rounded-2xl border border-neutral-100 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] font-black text-ag-green/40 uppercase tracking-widest">{item.name}</p>
                      <p className="text-base font-black text-ag-green mt-1">{item.price} <span className="text-[10px] opacity-60 font-normal">{item.unit}</span></p>
                    </div>
                    <div className="mt-4">
                      <Sparkline data={item.trend} width={120} height={20} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 opacity-40">
                <p className="text-xs font-bold">No recent ticker data.</p>
              </div>
            )}
            <label className="mt-6 flex items-center gap-3 cursor-pointer select-none">
               <input type="checkbox" checked={includeMarket} onChange={e => setIncludeMarket(e.target.checked)} className="w-5 h-5 rounded-lg border-neutral-200 text-ag-green focus:ring-ag-green" />
               <span className="text-xs font-bold text-neutral-600">Sync Market Data with Newsletter</span>
            </label>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[3rem] border border-neutral-200 shadow-xl overflow-hidden min-h-[800px] flex flex-col">
          <div className="p-10 flex-1 overflow-y-auto custom-scrollbar bg-white">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 border-4 border-ag-green/10 border-t-ag-green rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-ag-green">Forging The Yield...</p>
              </div>
            ) : newsletter ? (
              <div id="newsletter-content" className="animate-in fade-in duration-700">
                <header className="text-center mb-16">
                  <div className="flex justify-center mb-8">
                    <div className="p-4 rounded-2xl bg-ag-green shadow-xl">
                      <Sprout className="w-8 h-8 text-ag-gold" />
                    </div>
                  </div>
                  <h2 className="font-serif text-5xl font-black text-ag-green italic mb-4">The Yield</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-300 mb-8">{newsletter.generatedAt}</p>
                  <p className="text-xl font-light italic text-neutral-500 leading-relaxed max-w-sm mx-auto">
                    "{newsletter.header.vibeCheck}"
                  </p>
                </header>

                <div className="space-y-20">
                  {newsletter.sections.map(section => (
                    <div key={section.id} className="space-y-6">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-ag-green bg-green-50 px-6 py-2 rounded-full inline-block border border-green-100">
                        {section.title}
                      </h3>
                      {section.imageUrl && <img src={section.imageUrl} alt="" className="w-full h-64 object-cover rounded-3xl shadow-md border border-neutral-100" />}
                      <div 
                        className="text-lg font-light leading-relaxed text-neutral-800"
                        dangerouslySetInnerHTML={{ __html: section.content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-ag-green">$1</strong>').replace(/\n/g, '<br/>') }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-20 pt-10 border-t border-neutral-100 flex justify-center gap-4 no-print">
                   <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all">
                      <Printer className="w-4 h-4"/> Save to PDF
                   </button>
                   <button onClick={() => {
                     const text = newsletter.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n');
                     navigator.clipboard.writeText(text);
                   }} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-50 text-neutral-600 text-xs font-black hover:bg-neutral-100 transition-all">
                      <Copy className="w-4 h-4"/> Copy Content
                   </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                <Layers className="w-16 h-16 mb-6" />
                <p className="text-sm font-black uppercase tracking-widest">Feed the stack to begin</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}