'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, LogOut, Heart, Copy, Download, Star, 
  User as UserIcon, Zap, TrendingUp, Shield 
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import SonnerToaster from '@/components/sonner-toaster';

import { User, Generation, AppState } from '../lib/types';
import { generateContent } from '../lib/generator';
import * as storage from '../lib/storage';

// Types for current results
type CurrentResults = Omit<Generation, 'id' | 'createdAt'> | null;

export default function ContentSpark() {
  // App State
  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [usage, setUsage] = useState({ date: '', count: 0 });

  // UI State
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTopic, setCurrentTopic] = useState('');
  const [currentResults, setCurrentResults] = useState<CurrentResults>(null);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'captions' | 'threads' | 'hashtags' | 'video'>('captions');

  // Load persisted state on mount
  useEffect(() => {
    const state = storage.loadFullState();
    if (state.user) {
      setUser(state.user);
      setView('app');
    }
    setIsPro(state.isPro);
    setGenerations(state.generations);
    setFavorites(state.favorites);
    setUsage(state.usage);
  }, []);

  // Persist on change
  useEffect(() => {
    if (user) storage.saveUser(user);
  }, [user]);

  useEffect(() => {
    storage.saveIsPro(isPro);
  }, [isPro]);

  useEffect(() => {
    storage.saveGenerations(generations);
  }, [generations]);

  useEffect(() => {
    storage.saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    storage.saveUsage(usage);
  }, [usage]);

  const remainingGenerations = isPro ? '∞' : Math.max(0, 5 - usage.count);
  const canGenerate = isPro || usage.count < 5;

  // Auth handlers
  const handleDemoLogin = () => {
    const demoUser = storage.createDemoUser();
    setUser(demoUser);
    setView('app');
    setShowAuthModal(false);
    toast.success('Welcome to the demo! You are now logged in.');
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value; // demo only

    if (!email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    const newUser = storage.createUserFromEmail(email);
    setUser(newUser);
    setView('app');
    setShowAuthModal(false);
    toast.success(isLogin ? 'Welcome back!' : 'Account created! You have 5 free generations today.');
  };

  const handleLogout = () => {
    setUser(null);
    setView('landing');
    setCurrentResults(null);
    setCurrentTopic('');
    setSelectedFavoriteId(null);
    toast.info('Logged out successfully');
  };

  // Generator
  const handleGenerate = async () => {
    if (!currentTopic.trim()) {
      toast.error('Please enter a topic or niche');
      return;
    }
    if (!canGenerate) {
      setShowUpgradeModal(true);
      return;
    }

    setIsGenerating(true);

    // Simulate real AI thinking time (feels premium)
    await new Promise(resolve => setTimeout(resolve, 850));

    const generated = generateContent(currentTopic.trim());
    
    const newGeneration: Generation = {
      id: 'gen-' + Date.now(),
      ...generated,
      createdAt: new Date().toISOString(),
    };

    // Save generation
    const updatedGens = [newGeneration, ...generations].slice(0, 50); // keep last 50
    setGenerations(updatedGens);

    // Update usage
    if (!isPro) {
      const newUsage = storage.incrementUsage();
      setUsage(newUsage);
    }

    setCurrentResults(generated);
    setSelectedFavoriteId(null);
    setActiveTab('captions');

    setIsGenerating(false);
    toast.success('Content generated! Ready to copy and use.');
  };

  const loadGeneration = (gen: Generation) => {
    setCurrentResults({
      topic: gen.topic,
      captions: gen.captions,
      threads: gen.threads,
      hashtags: gen.hashtags,
      videoHook: gen.videoHook,
    });
    setCurrentTopic(gen.topic);
    setSelectedFavoriteId(gen.id);
    setActiveTab('captions');
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  // Favorites
  const toggleFavorite = (genId?: string) => {
    const targetId = genId || (currentResults ? 'current' : null);
    if (!targetId || !currentResults) return;

    // For current results, we need to save it first if not already saved
    let idToUse = genId;
    
    if (!genId) {
      // Find or create the generation for current results
      const existing = generations.find(g => 
        g.captions[0] === currentResults.captions[0]
      );
      
      if (existing) {
        idToUse = existing.id;
      } else {
        // Save it now
        const newGen: Generation = {
          id: 'gen-' + Date.now(),
          createdAt: new Date().toISOString(),
          ...currentResults,
        };
        setGenerations(prev => [newGen, ...prev]);
        idToUse = newGen.id;
      }
    }

    if (!idToUse) return;

    const isFav = favorites.includes(idToUse);
    const newFavs = isFav 
      ? favorites.filter(id => id !== idToUse)
      : [...favorites, idToUse];

    setFavorites(newFavs);

    if (isFav) {
      toast.info('Removed from favorites');
    } else {
      toast.success('Saved to favorites!');
    }
  };

  const isCurrentFavorited = () => {
    if (!currentResults) return false;
    const existing = generations.find(g => 
      g.topic === currentResults.topic && g.captions[0] === currentResults.captions[0]
    );
    return existing ? favorites.includes(existing.id) : false;
  };

  // Copy helpers
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const copyAll = () => {
    if (!currentResults) return;
    
    const all = `
ContentSpark - ${currentResults.topic}

CAPTIONS:
${currentResults.captions.map((c, i) => `${i+1}. ${c}`).join('\n\n')}

TWITTER THREADS:
${currentResults.threads.join('\n\n')}

HASHTAGS:
${currentResults.hashtags.join(' ')}

VIDEO HOOK:
${currentResults.videoHook}
    `.trim();

    copyToClipboard(all, 'All content');
  };

  // PDF Export
  const exportPDF = () => {
    if (!currentResults) return;

    const doc = new jsPDF();
    const margin = 20;
    let y = 25;

    // Header
    doc.setFillColor(16, 185, 129); // emerald
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('ContentSpark', margin, 12);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString(), 170, 12);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text(currentResults.topic, margin, y + 10);
    y += 22;

    // Captions
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text('10 CATCHY SOCIAL MEDIA CAPTIONS', margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    currentResults.captions.forEach((cap, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${cap}`, 170);
      doc.text(lines, margin, y);
      y += lines.length * 5.5 + 3;
      if (y > 260) { doc.addPage(); y = 25; }
    });

    y += 6;
    if (y > 250) { doc.addPage(); y = 25; }

    // Threads
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text('TWITTER / X THREAD IDEAS', margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    currentResults.threads.forEach((thread, i) => {
      const lines = doc.splitTextToSize(`${thread}`, 170);
      doc.text(lines, margin, y);
      y += lines.length * 5.5 + 4;
      if (y > 255) { doc.addPage(); y = 25; }
    });

    y += 6;
    if (y > 240) { doc.addPage(); y = 25; }

    // Hashtags
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text('RELEVANT HASHTAGS', margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(currentResults.hashtags.join('   '), margin, y);
    y += 12;

    // Video
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129);
    doc.text('SHORT VIDEO SCRIPT HOOK', margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const hookLines = doc.splitTextToSize(currentResults.videoHook, 170);
    doc.text(hookLines, margin, y);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated with ContentSpark — Spark viral content in seconds. contentspark.app', 105, 285, { align: 'center' });

    const filename = `contentspark-${currentResults.topic.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    doc.save(filename);
    toast.success('PDF exported successfully!');
  };

  // Upgrade (mock)
  const handleUpgrade = () => {
    setIsPro(true);
    setShowUpgradeModal(false);
    toast.success('Welcome to Pro! Unlimited generations unlocked.', {
      description: 'Thank you for supporting ContentSpark.',
    });
  };

  const openAuth = (loginMode = false) => {
    setIsLogin(loginMode);
    setShowAuthModal(true);
  };

  // Render helpers
  const renderResults = () => {
    if (!currentResults) return null;

    const isFav = isCurrentFavorited();

    return (
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-emerald-600 font-semibold tracking-wider">GENERATED FOR</div>
            <h2 className="text-3xl font-semibold tracking-tight">{currentResults.topic}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleFavorite()}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${isFav ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 hover:border-slate-300'}`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              {isFav ? 'Saved' : 'Save to Favorites'}
            </button>
            <button onClick={copyAll} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50">
              <Copy className="w-4 h-4" /> Copy All
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          {(['captions', 'threads', 'hashtags', 'video'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab === 'captions' && 'Captions (10)'}
              {tab === 'threads' && 'X Threads (5)'}
              {tab === 'hashtags' && 'Hashtags'}
              {tab === 'video' && 'Video Hook'}
            </button>
          ))}
        </div>

        {/* Captions */}
        {activeTab === 'captions' && (
          <div className="grid md:grid-cols-2 gap-4">
            {currentResults.captions.map((caption, index) => (
              <div key={index} className="result-card card p-5 flex gap-3 group">
                <div className="flex-1 text-[15px] leading-relaxed text-slate-700">{caption}</div>
                <button onClick={() => copyToClipboard(caption, 'Caption')} className="copy-button self-start p-2 rounded-xl hover:bg-slate-100">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Threads */}
        {activeTab === 'threads' && (
          <div className="space-y-4">
            {currentResults.threads.map((thread, index) => (
              <div key={index} className="result-card p-5 flex gap-3">
                <div className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{thread}</div>
                <button onClick={() => copyToClipboard(thread, 'Thread idea')} className="copy-button self-start p-2 rounded-xl hover:bg-slate-100">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hashtags */}
        {activeTab === 'hashtags' && (
          <div className="result-card p-6">
            <div className="flex flex-wrap gap-2">
              {currentResults.hashtags.map((tag, i) => (
                <button
                  key={i}
                  onClick={() => copyToClipboard(tag, 'Hashtag')}
                  className="hashtag-pill px-4 py-1.5 rounded-2xl text-sm font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>
            <button onClick={() => copyToClipboard(currentResults.hashtags.join(' '), 'All hashtags')} className="mt-4 text-sm text-emerald-600 font-medium flex items-center gap-1">
              <Copy className="w-3.5 h-3.5" /> Copy all hashtags
            </button>
          </div>
        )}

        {/* Video Hook */}
        {activeTab === 'video' && (
          <div className="result-card p-7 text-lg leading-relaxed text-slate-700 border-l-4 border-emerald-500">
            {currentResults.videoHook}
            <div className="mt-4">
              <button onClick={() => copyToClipboard(currentResults.videoHook, 'Video hook')} className="text-sm flex items-center gap-2 text-emerald-600 font-semibold">
                <Copy className="w-4 h-4" /> Copy hook
              </button>
            </div>
          </div>
        )}

        <div className="text-center mt-8 text-xs text-slate-400">
          Generated instantly with ContentSpark • Feel free to tweak and make it yours
        </div>
      </div>
    );
  };

  // Favorites sidebar / section
  const favoriteGenerations = generations.filter(g => favorites.includes(g.id));

  return (
    <div className="min-h-screen">
      <SonnerToaster />
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('landing'); setCurrentResults(null); }}>
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-2xl font-semibold tracking-tighter">ContentSpark</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-2xl text-xs">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isPro ? 'Pro' : `${remainingGenerations} / 5 today`}</span>
                </div>
                {!isPro && (
                  <button onClick={() => setShowUpgradeModal(true)} className="text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                    <Star className="w-4 h-4" /> Upgrade
                  </button>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <UserIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.email}</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-slate-600">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => openAuth(true)} className="text-slate-600 hover:text-slate-900 font-medium">Log in</button>
                <button onClick={() => openAuth(false)} className="px-5 py-2 bg-slate-900 text-white rounded-2xl font-semibold text-sm">Get started free</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* LANDING PAGE */}
      {view === 'landing' && (
        <div>
          {/* Hero */}
          <div className="max-w-screen-xl mx-auto px-6 pt-16 pb-12 text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" /> INSTANT AI-POWERED CONTENT
            </div>

            <h1 className="font-display text-6xl md:text-7xl tracking-tighter font-semibold leading-none mb-6">
              Spark viral content.<br />In seconds.
            </h1>
            <p className="max-w-md mx-auto text-xl text-slate-600 mb-10">
              Generate 10 captions, 5 Twitter threads, perfect hashtags, and a video hook — tailored to your niche.
            </p>

            <div className="max-w-lg mx-auto mb-8">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={currentTopic}
                  onChange={(e) => setCurrentTopic(e.target.value)}
                  placeholder="fitness motivation, restaurant marketing..."
                  className="flex-1 px-6 py-4 rounded-3xl border border-slate-300 text-lg focus:border-emerald-500 outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') openAuth(false); }}
                />
                <button onClick={() => openAuth(false)} className="primary-button px-8 py-4 text-lg font-semibold rounded-3xl">
                  Generate free
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3">No credit card • 5 generations free daily</p>
            </div>

            <div className="flex justify-center gap-8 text-sm text-slate-500">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> 12k+ creators</div>
              <div>Instant results</div>
              <div>Export to PDF</div>
            </div>
          </div>

          {/* Trust */}
          <div className="border-y bg-white py-5">
            <div className="max-w-screen-xl mx-auto px-6 text-center text-sm text-slate-500">
              Trusted by creators at Vercel, Framer, Stripe &amp; indie hackers worldwide
            </div>
          </div>

          {/* Features */}
          <div className="max-w-screen-xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
            {[
              { icon: <Zap className="w-6 h-6" />, title: "Instant Generation", desc: "10 captions + threads + hooks in under a second. No waiting." },
              { icon: <Star className="w-6 h-6" />, title: "Premium Quality", desc: "Templates crafted from viral posts. Feels like a $5k copywriter." },
              { icon: <Download className="w-6 h-6" />, title: "Save & Export", desc: "Favorites, full history (Pro), and beautiful PDF exports." },
            ].map((f, i) => (
              <div key={i} className="card bg-white p-7 rounded-3xl border border-slate-100 modern-shadow">
                <div className="text-emerald-600 mb-4">{f.icon}</div>
                <div className="font-semibold text-xl mb-2">{f.title}</div>
                <p className="text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="bg-white border-t py-16">
            <div className="max-w-screen-xl mx-auto px-6 text-center mb-10">
              <div className="text-emerald-600 text-sm font-semibold tracking-[1.5px]">START FOR FREE. UPGRADE WHEN READY.</div>
              <h2 className="section-header mt-2">Simple pricing</h2>
            </div>

            <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-6">
              {/* Free */}
              <div className="card bg-white border p-8 rounded-3xl">
                <div className="font-semibold text-2xl">Free</div>
                <div className="text-5xl font-semibold mt-2 mb-1">$0</div>
                <div className="text-slate-500 mb-6">Forever</div>
                <ul className="space-y-3 text-sm mb-8">
                  <li className="flex gap-2">✓ 5 generations per day</li>
                  <li className="flex gap-2">✓ Save favorites</li>
                  <li className="flex gap-2">✓ Export as PDF</li>
                  <li className="flex gap-2">✓ Copy &amp; customize</li>
                </ul>
                <button onClick={() => openAuth(false)} className="w-full py-3 border border-slate-300 rounded-2xl font-semibold">Start free</button>
              </div>

              {/* Pro */}
              <div className="card bg-white border-2 border-emerald-600 p-8 rounded-3xl relative">
                <div className="absolute -top-3 right-6 bg-emerald-600 text-white text-xs px-4 py-1 rounded-full font-bold tracking-widest">MOST POPULAR</div>
                <div className="font-semibold text-2xl">Pro</div>
                <div className="flex items-baseline gap-1 mt-2 mb-1">
                  <span className="text-5xl font-semibold">$9</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <div className="text-slate-500 mb-6">Billed monthly. Cancel anytime.</div>
                <ul className="space-y-3 text-sm mb-8">
                  <li className="flex gap-2">✓ Unlimited generations</li>
                  <li className="flex gap-2">✓ Full history &amp; search</li>
                  <li className="flex gap-2">✓ Priority support</li>
                  <li className="flex gap-2">✓ Early access to new templates</li>
                </ul>
                <button onClick={() => openAuth(false)} className="primary-button w-full py-3 text-base">Start 14-day Pro trial</button>
                <p className="text-[10px] text-center text-slate-400 mt-3">No card required for trial</p>
              </div>
            </div>
          </div>

          {/* Testimonials (inspired by QuickWin) */}
          <div className="max-w-screen-xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <div className="text-emerald-600 text-sm font-semibold tracking-widest">CREATORS LOVE IT</div>
              <h3 className="section-header mt-1">Real results. Real fast.</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { quote: "I went from spending 2 hours on captions to 30 seconds. The threads are shockingly good.", name: "Maya Torres", role: "Fitness Coach • 180k IG" },
                { quote: "My restaurant marketing content now converts 3x better. This is my secret weapon.", name: "David Kim", role: "Founder, Noodle Co." },
                { quote: "The video hooks alone are worth the price. I use ContentSpark for every single piece of content.", name: "Priya Patel", role: "Real Estate Investor" },
              ].map((t, i) => (
                <div key={i} className="card bg-white p-7 rounded-3xl border">
                  <div className="flex text-emerald-400 mb-4">★★★★★</div>
                  <p className="text-[15px] leading-relaxed text-slate-700 mb-6">“{t.quote}”</p>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-sm text-slate-500">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center pb-16">
            <button onClick={() => openAuth(false)} className="primary-button px-10 py-4 text-lg inline-flex items-center gap-3">
              <Sparkles className="w-5 h-5" /> Start generating for free
            </button>
          </div>
        </div>
      )}

      {/* APP VIEW */}
      {view === 'app' && user && (
        <div className="max-w-screen-xl mx-auto px-6 pt-10 pb-24">
          {/* Generator Header */}
          <div className="max-w-3xl mx-auto text-center mb-8">
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-xs font-bold tracking-widest">AI-POWERED • INSTANT</div>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">What’s your niche today?</h1>
            <p className="text-slate-600 mt-2">Enter any topic. Get professional-grade content ready to post.</p>
          </div>

          {/* Input */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                value={currentTopic}
                onChange={(e) => setCurrentTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="fitness motivation, restaurant marketing, real estate tips..."
                className="w-full px-7 py-[22px] text-xl rounded-3xl border-2 border-slate-200 focus:border-emerald-500 outline-none pr-40"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !currentTopic.trim() || !canGenerate}
                className="primary-button absolute right-3 top-3 px-8 py-3.5 text-base disabled:opacity-60"
              >
                {isGenerating ? 'Generating...' : 'Generate Content'}
              </button>
            </div>
            <div className="text-center mt-3 text-sm text-emerald-600 font-medium">
              {isPro ? 'Unlimited generations (Pro)' : `${remainingGenerations} generations left today`}
            </div>
          </div>

          {/* Results or Empty State */}
          {isGenerating && (
            <div className="max-w-2xl mx-auto text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
              <div className="text-xl font-medium text-slate-700">Crafting your content with care...</div>
            </div>
          )}

          {!isGenerating && renderResults()}

          {/* Favorites & History */}
          {favoriteGenerations.length > 0 && (
            <div className="max-w-5xl mx-auto mt-16">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="font-semibold flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" /> Your Favorites</div>
                <div className="text-xs text-slate-400">Click to reload</div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteGenerations.slice(0, 6).map(gen => (
                  <button
                    key={gen.id}
                    onClick={() => loadGeneration(gen)}
                    className={`text-left p-4 rounded-2xl border bg-white hover:border-emerald-300 transition-all ${selectedFavoriteId === gen.id ? 'border-emerald-600 ring-1 ring-emerald-100' : 'border-slate-200'}`}
                  >
                    <div className="font-medium text-sm mb-1 line-clamp-1">{gen.topic}</div>
                    <div className="text-[12px] text-slate-500">{new Date(gen.createdAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats / upgrade nudge */}
          <div className="max-w-5xl mx-auto mt-16 text-center text-xs text-slate-400">
            {isPro ? 'Thank you for being Pro ✨' : 'Loving it? Upgrade for unlimited + full history'}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={() => setShowAuthModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-8" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="text-emerald-600 w-6 h-6" />
              </div>
              <div className="font-semibold text-2xl">{isLogin ? 'Welcome back' : 'Create your account'}</div>
              <p className="text-slate-500 text-sm mt-1">Start generating beautiful content instantly</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <input name="email" type="email" placeholder="you@company.com" required className="auth-input w-full px-5 py-3.5 border rounded-2xl" />
              <input name="password" type="password" placeholder="Password (demo only)" required className="auth-input w-full px-5 py-3.5 border rounded-2xl" />
              <button type="submit" className="primary-button w-full py-3.5 text-base mt-2">
                {isLogin ? 'Log in' : 'Create account & start free'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
              <div className="flex-1 h-px bg-slate-200" /> or <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button onClick={handleDemoLogin} className="w-full py-3 border border-slate-300 rounded-2xl font-semibold hover:bg-slate-50">
              Continue with Demo Account (no signup)
            </button>

            <div className="text-center mt-5 text-sm">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-600 font-semibold">{isLogin ? 'Sign up' : 'Log in'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center">
                <Star className="text-white w-6 h-6" />
              </div>
              <div className="font-semibold text-2xl">Unlock unlimited with Pro</div>
              <div className="text-5xl font-semibold my-4">$9<span className="text-base align-super font-normal text-slate-500">/mo</span></div>
            </div>

            <ul className="text-sm space-y-2 my-6 px-2">
              <li>✓ Unlimited generations every day</li>
              <li>✓ Full access to history &amp; search</li>
              <li>✓ Priority new templates</li>
            </ul>

            <button onClick={handleUpgrade} className="primary-button w-full py-3.5 text-base">Start Pro — $9/month</button>
            <button onClick={() => setShowUpgradeModal(false)} className="w-full mt-3 py-2 text-sm text-slate-500">Maybe later</button>
            <p className="text-[10px] text-center text-slate-400 mt-3">Billed monthly. Cancel anytime. (Demo — no real charge)</p>
          </div>
        </div>
      )}
    </div>
  );
}
