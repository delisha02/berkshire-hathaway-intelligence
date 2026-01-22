"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat, useMastraClient } from "@mastra/react";
import { Send, User, Bot, Loader2, BookOpen, Quote, History, Plus, X, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function ChatPage() {
    const [input, setInput] = useState("");
    const [threadId, setThreadId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const client = useMastraClient();

    const { messages, sendMessage, isRunning, setMessages } = useChat({
        agentId: "berkshire-agent",
    });

    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [allThreads, setAllThreads] = useState<any[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Load available threads for management
    const refreshThreads = useCallback(async () => {
        try {
            const res = await client.listMemoryThreads({ agentId: "berkshire-agent" });
            setAllThreads(res.threads || []);
        } catch (e) {
            console.error(e);
        }
    }, [client]);

    // New Chat handler
    const handleNewChat = () => {
        const newThreadId = crypto.randomUUID();
        localStorage.setItem("berkshire_thread_id", newThreadId);
        setThreadId(newThreadId);
        setMessages([]);
        setIsSidebarOpen(false);
    };

    // Switch thread handler
    const handleSwitchThread = async (id: string) => {
        try {
            setIsLoadingHistory(true);
            const res: any = await client.listThreadMessages(id, { agentId: "berkshire-agent" });
            if (res && res.messages) {
                setMessages(res.messages);
                setThreadId(id);
                localStorage.setItem("berkshire_thread_id", id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingHistory(false);
            setIsSidebarOpen(false);
        }
    };

    // Resolve or create threadId on mount
    useEffect(() => {
        let isMounted = true;

        const loadThread = async () => {
            setIsLoadingHistory(true);
            const storedThreadId = localStorage.getItem("berkshire_thread_id");

            try {
                // First, list all threads to see if our stored one is valid
                const threadsRes = await client.listMemoryThreads({ agentId: "berkshire-agent" });
                const validThreads = threadsRes.threads || [];
                if (isMounted) setAllThreads(validThreads);

                if (storedThreadId && validThreads.some((t: any) => t.id === storedThreadId)) {
                    // Thread is valid, load its messages
                    const res: any = await client.listThreadMessages(storedThreadId, { agentId: "berkshire-agent" });

                    if (!isMounted) return;

                    if (res && res.messages && Array.isArray(res.messages)) {
                        setMessages(res.messages);
                        setThreadId(storedThreadId);
                    }
                } else {
                    // Thread not found or no ID stored, start fresh
                    if (!isMounted) return;
                    const newThreadId = crypto.randomUUID();
                    localStorage.setItem("berkshire_thread_id", newThreadId);
                    setThreadId(newThreadId);
                    setMessages([]);
                }
            } catch (error: any) {
                if (!isMounted) return;
                console.error("Session restoration issue, starting fresh.");
                const newThreadId = crypto.randomUUID();
                localStorage.setItem("berkshire_thread_id", newThreadId);
                setThreadId(newThreadId);
                setMessages([]);
            } finally {
                if (isMounted) setIsLoadingHistory(false);
            }
        };

        loadThread();
        return () => { isMounted = false; };
    }, [client, setMessages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isRunning || !threadId) return;

        const userMessage = input;
        setInput("");
        await sendMessage({
            message: userMessage,
            mode: 'stream',
            threadId // Pass the persistent threadId
        });
        refreshThreads();
    };

    return (
        <div className="flex flex-col h-screen bg-[#F8F9FA] text-[#003366] font-sans">
            {/* Header */}
            <header className="bg-[#003366] text-white p-5 shadow-xl flex items-center justify-between z-10">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center border-2 border-white shadow-inner transform rotate-3">
                        <BookOpen className="text-[#003366] w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase italic">Berkshire Intelligence</h1>
                        <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-[#D4AF37] text-black px-1.5 py-0.5 rounded font-bold uppercase">Pro Analyst</span>
                            <p className="text-xs text-[#D4AF37] font-semibold opacity-90 uppercase tracking-widest">Warren Buffett Knowledge Base</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleNewChat}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#D4AF37] hover:bg-[#C09A30] text-[#003366] rounded-xl font-bold transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">New Chat</span>
                    </button>
                    <button
                        onClick={() => { refreshThreads(); setIsSidebarOpen(true); }}
                        className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20"
                    >
                        <History size={20} />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                        <User size={20} />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-10 space-y-8 scrollbar-hide">
                <div className="max-w-5xl mx-auto space-y-8 pb-32">
                    <AnimatePresence initial={false}>
                        {isLoadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-40 animate-pulse">
                                <div className="w-16 h-16 border-4 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin mb-4" />
                                <p className="text-[#003366]/40 font-bold uppercase tracking-[0.3em] text-[10px]">Restoring Analyst Session</p>
                            </div>
                        ) : messages.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-24 space-y-8"
                            >
                                <div className="relative inline-block">
                                    <Quote className="absolute -top-8 -left-8 w-16 h-16 text-[#003366] opacity-5" />
                                    <h2 className="text-5xl font-black text-[#003366] tracking-tight leading-none">
                                        The Oracle of <br /><span className="text-[#D4AF37]">Omaha's</span> Wisdom
                                    </h2>
                                </div>
                                <p className="text-lg text-[#003366]/60 max-w-lg mx-auto font-medium">
                                    Ask deep questions about investment philosophy, business moats, and capital allocation strategies directly from the shareholder letters.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12">
                                    {[
                                        { q: "What defines an economic moat?", icon: "🛡️" },
                                        { q: "Views on stock buybacks?", icon: "📈" },
                                        { q: "The 2023 insurance results?", icon: "💼" }
                                    ].map((item) => (
                                        <button
                                            key={item.q}
                                            onClick={() => setInput(item.q)}
                                            className="p-6 bg-white border-2 border-transparent hover:border-[#D4AF37] rounded-3xl text-left transition-all shadow-md group hover:-translate-y-1"
                                        >
                                            <span className="text-2xl mb-3 block">{item.icon}</span>
                                            <span className="font-bold text-[#003366] group-hover:text-[#D4AF37] transition-colors">{item.q}</span>
                                            <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-wider">Analyze letters →</p>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {messages.map((message, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: message.role === "user" ? 20 : -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                    "flex space-x-4",
                                    message.role === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2",
                                    message.role === "user"
                                        ? "bg-[#003366] text-white border-[#003366]/20"
                                        : "bg-[#D4AF37] text-[#003366] border-white"
                                )}>
                                    {message.role === "user" ? <User size={20} /> : <Bot size={20} />}
                                </div>

                                <div className={cn(
                                    "relative max-w-[85%] rounded-3xl p-6 shadow-xl overflow-hidden",
                                    message.role === "user"
                                        ? "bg-[#003366] text-white rounded-tr-none"
                                        : "bg-white border border-[#003366]/5 rounded-tl-none"
                                )}>
                                    {/* Background decoration for AI */}
                                    {message.role !== "user" && (
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                                    )}

                                    <div className={cn(
                                        "relative z-10 prose max-w-none text-[15px] md:text-lg leading-relaxed font-medium",
                                        message.role === "user" ? "prose-invert text-white" : "prose-slate text-[#003366]"
                                    )}>
                                        {(() => {
                                            const content: any = message.content;
                                            let text = "";

                                            if (typeof content === 'string') {
                                                text = content;
                                            } else if (Array.isArray(content)) {
                                                text = content.map((p: any) => p.text || p.content || '').join('');
                                            } else if (content?.parts && Array.isArray(content.parts)) {
                                                // Handle Mastra V2 "parts" structure in content
                                                text = content.parts.map((p: any) => p.text || '').join('');
                                            } else if (Array.isArray(message.parts)) {
                                                text = message.parts.map((p: any) => p.text || '').join('');
                                            }

                                            return text.split('\n').map((line: string, idx: number) => (
                                                <p key={idx} className={idx > 0 ? "mt-2" : ""}>{line}</p>
                                            ));
                                        })()}
                                    </div>

                                    {/* Citations Visualization (Task 4.2) */}
                                    {message.role === "assistant" && (
                                        <div className="mt-6 pt-6 border-t border-[#003366]/5 flex flex-col space-y-3">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#003366]/30 px-2 py-1 bg-[#F8F9FA] rounded">
                                                    Validated Sources Found
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {/* Dynamic Extraction of Citations */}
                                                {(() => {
                                                    const content: any = message.content;
                                                    let text = "";

                                                    if (typeof content === 'string') {
                                                        text = content;
                                                    } else if (Array.isArray(content)) {
                                                        text = content.map((p: any) => p.text || p.content || '').join('');
                                                    } else if (content?.parts && Array.isArray(content.parts)) {
                                                        text = content.parts.map((p: any) => p.text || '').join('');
                                                    } else if (Array.isArray(message.parts)) {
                                                        text = message.parts.map((p: any) => p.text || '').join('');
                                                    }

                                                    const years = Array.from(new Set(text.match(/\((19|20)\d{2}\)/g) || [])) as string[];

                                                    return (
                                                        <>
                                                            {years.map((year: string) => (
                                                                <div
                                                                    key={year}
                                                                    className="group relative cursor-pointer px-4 py-2 bg-[#D4AF37]/10 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#003366] text-xs font-black rounded-xl border-2 border-[#D4AF37]/20 transition-all flex items-center space-x-2"
                                                                >
                                                                    <BookOpen size={14} />
                                                                    <span>Letter {year.replace(/[()]/g, '')}</span>
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-white text-[10px] rounded hidden group-hover:block z-50 shadow-2xl">
                                                                        Retrieved from Berkshire Hathaway {year.replace(/[()]/g, '')} Annual Report archive.
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {years.length === 0 && (
                                                                <span className="text-[10px] text-gray-400 italic">Historical Context Applied</span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isRunning && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center space-x-4 ml-14"
                        >
                            <div className="flex space-x-1">
                                {[1, 2, 3].map(i => (
                                    <motion.div
                                        key={i}
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                                        className="w-2 h-2 bg-[#D4AF37] rounded-full"
                                    />
                                ))}
                            </div>
                            <span className="text-[#003366]/40 text-xs font-black uppercase tracking-widest">Oracle is thinking...</span>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input section */}
            <footer className="p-6 md:p-12 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA] to-transparent fixed bottom-0 left-0 right-0 z-20">
                <form
                    onSubmit={handleSubmit}
                    className="max-w-4xl mx-auto relative"
                >
                    <div className="absolute inset-0 bg-[#003366]/5 blur-2xl rounded-full scale-110 opacity-50" />
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Berkshire Hathaway Intelligence..."
                            className="w-full bg-white border-2 border-[#003366]/10 focus:border-[#D4AF37] rounded-3xl py-6 pl-8 pr-20 shadow-2xl transition-all outline-none text-[#003366] text-lg font-medium placeholder:text-[#003366]/20"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isRunning}
                            className="absolute right-4 w-12 h-12 bg-[#003366] hover:bg-[#D4AF37] text-white hover:text-[#003366] rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-[#003366]/20"
                        >
                            {isRunning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send size={24} />}
                        </button>
                    </div>
                </form>
                <div className="flex justify-center space-x-8 mt-6">
                    {["PHILOSOPHY", "ACQUISITIONS", "MOATS"].map(tag => (
                        <span key={tag} className="text-[10px] font-black text-[#003366]/20 tracking-widest">{tag}</span>
                    ))}
                </div>
            </footer>

            {/* Conversation Management Sidebar (Task 4.2) */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99]"
                        />
                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[100] flex flex-col"
                        >
                            <div className="p-6 bg-[#003366] text-white flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <History size={20} className="text-[#D4AF37]" />
                                    <h2 className="text-xl font-black uppercase tracking-tighter">Analyst Archives</h2>
                                </div>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {allThreads.length === 0 ? (
                                    <div className="text-center py-20">
                                        <MessageSquare size={40} className="mx-auto text-[#003366]/10 mb-4" />
                                        <p className="text-sm font-bold text-[#003366]/40 uppercase tracking-widest leading-loose">No previous insights<br />found in archives</p>
                                    </div>
                                ) : (
                                    allThreads.map((thread) => (
                                        <button
                                            key={thread.id}
                                            onClick={() => handleSwitchThread(thread.id)}
                                            className={cn(
                                                "w-full text-left p-5 rounded-2xl border-2 transition-all group relative overflow-hidden",
                                                threadId === thread.id
                                                    ? "border-[#D4AF37] bg-[#D4AF37]/5"
                                                    : "border-transparent hover:border-[#003366]/10 bg-[#F8F9FA]"
                                            )}
                                        >
                                            <div className="relative z-10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] uppercase font-black tracking-widest text-[#003366]/50">Thread ID</span>
                                                    {threadId === thread.id && (
                                                        <span className="text-[10px] bg-[#D4AF37] text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-[#003366] truncate text-sm mb-1">{thread.title || `Session ${thread.id.substring(0, 8)}`}</p>
                                                <p className="text-[10px] text-[#003366]/40 font-medium">Last active: {new Date(thread.updatedAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#003366]/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-[#D4AF37]/10 transition-colors" />
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="p-6 border-t border-[#003366]/10">
                                <button
                                    onClick={handleNewChat}
                                    className="w-full flex items-center justify-center space-x-3 py-4 bg-[#003366] hover:bg-[#D4AF37] text-white hover:text-[#003366] rounded-2xl font-black uppercase tracking-tighter transition-all shadow-xl active:scale-95"
                                >
                                    <Plus size={20} />
                                    <span>Initiate fresh analysis</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
