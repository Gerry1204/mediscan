/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Image as ImageIcon,
  Pill,
  Info,
  AlertCircle,
  DollarSign,
  Stethoscope,
  Loader2,
  Camera,
  Upload,
  X,
  ChevronRight,
  Bell,
  MessageSquare,
  Menu,
  MoreHorizontal,
  History,
  Trash2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { analyzeMedicine, chatAboutMedicine, MedicineInfo } from './services/geminiService';

type TabType = 'query' | 'comparison' | 'consultation' | 'reminders';

interface Reminder {
  id: string;
  name: string;
  dosage: string;
  time: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('query');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MedicineInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consultation Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Reminders State
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('med_reminders');
    if (saved) setReminders(JSON.parse(saved));
  }, []);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const intervalId = setInterval(() => {
      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMinute = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHour}:${currentMinute}`;
      
      const lastTriggered = sessionStorage.getItem('last_reminder_time');

      if (currentTime !== lastTriggered) {
        const dueReminders = reminders.filter(r => r.time === currentTime);
        
        if (dueReminders.length > 0) {
          sessionStorage.setItem('last_reminder_time', currentTime);
          
          dueReminders.forEach(reminder => {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`用藥提醒: ${reminder.name}`, {
                body: `請記得服用：\n${reminder.dosage}`,
              });
            } else {
              alert(`🔔 用藥時間到！\n\n藥品：${reminder.name}\n用法：${reminder.dosage}\n時間：${reminder.time}`);
            }
          });
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
  }, [reminders]);

  const saveReminders = (newReminders: Reminder[]) => {
    setReminders(newReminders);
    localStorage.setItem('med_reminders', JSON.stringify(newReminders));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setPreviewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query && !previewImage) {
      setError('請輸入藥名或上傳圖片');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setActiveTab('query');

    try {
      const data = await analyzeMedicine(query, previewImage || undefined);
      setResult(data);
      setChatHistory([]); // Reset chat when new medicine found
    } catch (err: any) {
      console.error("Search API Error:", err);
      setError(err.message || '發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage || !result) return;

    const userMsg = { role: 'user' as const, text: chatMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const response = await chatAboutMedicine(result, chatHistory, chatMessage);
      setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      console.error("Chat API Error:", err);
      setChatHistory(prev => [...prev, { role: 'model', text: '抱歉，暫時無法連線到 AI 藥師。' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const addReminder = () => {
    if (!result) return;
    const newReminder: Reminder = {
      id: Date.now().toString(),
      name: result.chineseName,
      dosage: result.dosage,
      time: '08:00'
    };
    saveReminders([...reminders, newReminder]);
    setActiveTab('reminders');
  };

  const deleteReminder = (id: string) => {
    saveReminders(reminders.filter(r => r.id !== id));
  };

  const TabButton = ({ id, label, icon: Icon, needsResult = false }: { id: TabType, label: string, icon: any, needsResult?: boolean }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setShowMobileMenu(false);
      }}
      disabled={needsResult && !result}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold ${activeTab === id
        ? 'bg-indigo-600 text-white shadow-md'
        : 'text-slate-600 hover:bg-slate-100 disabled:opacity-30'
        }`}
    >
      <Icon size={18} />
      <span className="text-sm">{label}</span>
      {id === 'reminders' && reminders.length > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'reminders' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'}`}>
          {reminders.length}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Header Navigation */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-12 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('query')}>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Pill size={20} />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight">藥智查</h1>
            <p className="hidden md:block text-[8px] text-slate-400 uppercase tracking-widest font-bold">Medical AI Platform</p>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-4">
          <TabButton id="query" label="資訊" icon={Info} />
          <TabButton id="comparison" label="比價" icon={DollarSign} needsResult />
          <TabButton id="consultation" label="諮詢" icon={MessageSquare} needsResult />
          <TabButton id="reminders" label="提醒" icon={Bell} />
        </nav>

        {/* Mobile Header Actions */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 flex items-center gap-1 active:scale-95 transition-transform"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-white border-b border-slate-200 p-4 grid grid-cols-2 gap-2 sticky top-[57px] z-40 shadow-lg"
          >
            <TabButton id="query" label="藥物資訊" icon={Info} />
            <TabButton id="comparison" label="詢價對比" icon={DollarSign} needsResult />
            <TabButton id="consultation" label="專業諮詢" icon={MessageSquare} needsResult />
            <TabButton id="reminders" label="用藥提醒" icon={Bell} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-4 md:p-12 max-w-7xl mx-auto w-full space-y-6 md:space-y-10">
        {/* Main Search Area */}
        {activeTab === 'query' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl md:rounded-[2rem] p-1.5 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-center gap-1 md:gap-2"
          >
            <div className="flex-1 flex items-center px-4 w-full">
              <input
                type="text"
                placeholder="輸入藥名、學名或症狀..."
                className="w-full py-3 md:py-4 text-slate-700 outline-none text-base md:text-lg font-medium"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto p-1.5 md:p-1 md:pr-1 pt-0 md:pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 md:py-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl text-slate-600 font-black text-sm transition-all active:scale-95"
              >
                <Camera size={16} />
                <span className="whitespace-nowrap">拍照</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="flex-1 md:flex-none bg-indigo-600 text-white py-2.5 md:py-3 px-6 rounded-xl md:rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all hover:bg-indigo-700 disabled:opacity-80"
              >
                <Search size={16} />
                <span>搜尋</span>
              </button>
            </div>
          </motion.div>
        )}

        {previewImage && activeTab === 'query' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center">
            <div className="relative group">
              <img src={previewImage} alt="Preview" className="max-h-32 md:max-h-48 rounded-2xl border-2 border-white shadow-md" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-slate-900 text-white p-1 rounded-full shadow-lg"><X size={14} /></button>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-center text-sm font-bold">
            {error}
          </div>
        )}

        {/* Dynamic Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">資料調閱中...</p>
            </motion.div>
          ) : activeTab === 'query' && result ? (
            <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8 items-start">
              {/* Main Info Card */}
              <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">
                <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 border border-slate-100 shadow-sm overflow-hidden relative">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10 relative z-10">
                    <div className="w-full">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100 mb-2 inline-block leading-none">{result.category}</span>
                      <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight">{result.chineseName}</h2>
                      <p className="text-slate-400 font-bold italic text-xs md:text-base mt-0.5">{result.englishName}</p>
                    </div>
                    <div className="text-left md:text-right w-full md:w-auto p-3 md:p-0 bg-slate-50 md:bg-transparent rounded-2xl md:rounded-none">
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-1 leading-none">學名 / Generic</p>
                      <p className="text-sm md:text-lg font-mono font-bold text-indigo-900 leading-none">{result.genericName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Stethoscope size={12} className="text-rose-500" /> 適應症
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.indications.split(/[、,，]/).map((item, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100/30">
                            {item.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Bell size={12} className="text-indigo-500" /> 用法用量
                      </h3>
                      <div className="bg-slate-50 p-4 rounded-2xl text-xs md:text-sm text-slate-600 leading-relaxed font-bold italic border border-slate-100">
                        {result.dosage}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">市場詢價參考</h3>
                    <button onClick={() => setActiveTab('comparison')} className="text-indigo-600 text-[10px] font-black flex items-center gap-0.5 hover:underline uppercase">
                      查看學名藥對比 <ChevronRight size={10} />
                    </button>
                  </div>

                  <div className="bg-slate-50 p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">估計通路價格</p>
                      <p className="text-2xl md:text-3xl font-black text-slate-800">{result.priceRange}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-4 flex flex-col gap-5 md:gap-8">
                <div className="bg-indigo-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                  <h3 className="text-xl font-black mb-2 tracking-tight">AI 藥師建議</h3>
                  <p className="text-indigo-200 text-xs mb-6 leading-relaxed italic opacity-80">{result.consultation}</p>
                  <button onClick={() => setActiveTab('consultation')} className="w-full py-4 bg-white text-indigo-900 rounded-2xl font-black hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm shadow-lg">
                    <MessageSquare size={16} /> 即時諮詢
                  </button>
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
                </div>

                <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-500" />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">重要提示</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-bold bg-amber-50/50 p-4 rounded-xl border border-amber-100/20">
                    {result.warnings}
                  </p>
                  <button onClick={addReminder} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-slate-800 shadow-lg">
                    <Bell size={14} /> 加入用藥提醒
                  </button>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'comparison' && result ? (
            <motion.div key="comparison" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('query')} className="p-2 hover:bg-white rounded-full text-slate-400"><X size={18} /></button>
                <h2 className="text-2xl font-black text-slate-800">詢價對比</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-6 shadow-sm">
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] rounded font-black uppercase mb-3 inline-block tracking-widest">原廠藥</span>
                  <h3 className="text-lg font-black text-indigo-900">{result.chineseName}</h3>
                  <div className="text-xl font-black text-indigo-900 my-4">{result.priceRange}</div>
                </div>
                {result.alternatives.map((alt, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] rounded font-black uppercase mb-3 inline-block tracking-widest">替代藥</span>
                    <h3 className="text-lg font-black text-slate-800">{alt.name}</h3>
                    <div className="text-xl font-black text-slate-700 my-4">{alt.priceEstimate}</div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 text-[10px] rounded-xl font-bold leading-relaxed lowercase">
                      優勢：{alt.advantage}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'consultation' && result ? (
            <motion.div key="consultation" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-3xl mx-auto h-[500px] md:h-[600px] flex flex-col bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="bg-indigo-900 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-800 flex items-center justify-center"><MessageSquare size={18} /></div>
                  <div>
                    <h3 className="font-bold text-sm md:text-base">AI 藥師諮詢</h3>
                    <p className="text-[10px] text-indigo-400 uppercase tracking-widest">針對 {result.chineseName}</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('query')} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/50">
                <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm text-xs md:text-sm text-slate-600 border border-slate-100 max-w-[90%] leading-relaxed">
                  您好！我是您的智慧藥師。關於 <b>{result.chineseName} ({result.genericName})</b>，有任何想了解的副作用或用藥時程嗎？
                </div>
                {chatHistory.map((chat, i) => (
                  <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-4 rounded-2xl text-xs md:text-sm max-w-[90%] shadow-sm leading-relaxed ${chat.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none font-bold'
                      : 'bg-white text-slate-600 rounded-tl-none border border-slate-100'
                      }`}>
                      {chat.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100">
                      <Loader2 size={14} className="animate-spin text-indigo-600" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 md:p-4 border-t border-slate-100 bg-white shadow-inner">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="輸入您的問題..."
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button onClick={handleSendMessage} disabled={chatLoading} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'reminders' ? (
            <motion.div key="reminders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                用藥清單 <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">{reminders.length}</span>
              </h2>

              {reminders.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 border-dashed">
                  <Clock size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">目前無任何提醒</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reminders.map(reminder => (
                    <div key={reminder.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group active:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Clock size={18} /></div>
                        <div>
                          <h4 className="font-black text-slate-800 text-sm md:text-base">{reminder.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{reminder.dosage}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="time"
                          value={reminder.time}
                          onChange={(e) => {
                            const updated = reminders.map(r => r.id === reminder.id ? { ...r, time: e.target.value } : r);
                            saveReminders(updated);
                          }}
                          className="bg-slate-50 px-2 py-1.5 rounded-lg font-mono font-bold text-slate-700 text-xs md:text-sm outline-none border border-slate-100"
                        />
                        <button onClick={() => deleteReminder(reminder.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {[
                { icon: Search, title: '智慧識別', desc: '輸入商品名或拍照，AI 自動分析成分', color: 'indigo' },
                { icon: DollarSign, title: '詢價對比', desc: '即時查詢各大藥局參考價格', color: 'emerald' },
                { icon: Stethoscope, title: '專業諮詢', desc: '全天候藥學問答與安全指南', color: 'rose' }
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm flex md:flex-col items-center md:items-start gap-4 group">
                  <div className={`w-12 h-12 md:w-14 md:h-14 bg-${f.color}-50 text-${f.color}-600 rounded-2xl flex items-center justify-center shrink-0`}>
                    <f.icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-slate-800 md:mb-2">{f.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed font-bold hidden md:block">{f.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Micro-Bar */}
      <footer className="bg-slate-900 py-6 px-6 md:px-10 text-[10px] md:text-[11px] flex flex-col md:flex-row justify-between items-center gap-4 mt-auto">
        <p className="text-slate-500 font-bold tracking-tight text-center md:text-left leading-relaxed">
          © 2026 MediScan AI. 本資訊僅供參考，不具診斷效力。<br className="md:hidden" />用藥前請諮詢醫療專業人員。
        </p>
        <div className="flex gap-4 uppercase tracking-[0.2em] font-black items-center">
          <div className="flex items-center gap-2 text-emerald-500">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>系統正常</span>
          </div>
          <span className="text-slate-600 border-l border-slate-800 pl-4">V4.2.1-PRO</span>
        </div>
      </footer>
    </div>
  );
}
