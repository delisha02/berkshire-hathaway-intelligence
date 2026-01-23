/**
 * Berkshire Hathaway Intelligence - Main Chat Interface
 * 
 * A Gemini-inspired chat UI built with Next.js and TailwindCSS.
 * Features:
 * - Real-time streaming responses via Mastra Client
 * - Persistent chat history with sidebar navigation
 * - Temporal grouping of conversations (Today, Yesterday, etc.)
 * - Rich markdown rendering with source citations
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useChat, useMastraClient } from "@mastra/react";
import {
    Send, User, Bot, Loader2, BookOpen,
    Plus, X, MessageSquare, Menu, ChevronLeft,
    TrendingUp, Building2, Clock, CircleDollarSign, Search, Trash2
} from "lucide-react";
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
    const [threadTitles, setThreadTitles] = useState<Record<string, string>>({});
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Generate AI title for a conversation
    const generateTitle = useCallback(async (userMessage: string, threadIdForTitle: string) => {
        try {
            // Check if we already have a cached title
            const cachedTitles = JSON.parse(localStorage.getItem('berkshire_thread_titles') || '{}');
            if (cachedTitles[threadIdForTitle]) {
                return cachedTitles[threadIdForTitle];
            }

            // Call agent to generate a title using the generate API
            const agent = client.getAgent("berkshire-agent");
            const titlePrompt = `Generate a very short title (maximum 5 words) for a conversation that starts with this question. Only respond with the title, nothing else. Question: "${userMessage}"`;

            const response: any = await agent.generate(titlePrompt);

            let title = '';
            if (response?.text) {
                title = String(response.text).trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
            } else if (typeof response === 'string') {
                title = String(response).trim();
            }

            // Fallback if title generation failed
            if (!title || title.length > 50) {
                title = userMessage.length > 35 ? userMessage.substring(0, 35) + '...' : userMessage;
            }

            // Cache the title
            cachedTitles[threadIdForTitle] = title;
            localStorage.setItem('berkshire_thread_titles', JSON.stringify(cachedTitles));

            return title;
        } catch (e) {
            console.error('Title generation failed:', e);
            return userMessage.length > 35 ? userMessage.substring(0, 35) + '...' : userMessage;
        }
    }, [client]);

    // Load available threads for management
    const refreshThreads = useCallback(async () => {
        try {
            const res = await client.listMemoryThreads({ agentId: "berkshire-agent" });
            const threads = res.threads || [];
            setAllThreads(threads);

            // Load cached titles first
            const cachedTitles = JSON.parse(localStorage.getItem('berkshire_thread_titles') || '{}');
            const titles: Record<string, string> = { ...cachedTitles };

            // For threads without cached titles, get first message and generate title
            for (const thread of threads) {
                if (!titles[thread.id]) {
                    try {
                        const messagesRes: any = await client.listThreadMessages(thread.id, { agentId: "berkshire-agent" });
                        if (messagesRes?.messages?.length > 0) {
                            const firstUserMsg = messagesRes.messages.find((m: any) => m.role === 'user');
                            if (firstUserMsg) {
                                const content = firstUserMsg.content;
                                let text = '';
                                if (typeof content === 'string') text = content;
                                else if (Array.isArray(content)) text = content.map((p: any) => p.text || '').join('');
                                else if (content?.parts) text = content.parts.map((p: any) => p.text || '').join('');

                                // Generate AI title (async, updates in background)
                                generateTitle(text, thread.id).then(title => {
                                    setThreadTitles(prev => ({ ...prev, [thread.id]: title }));
                                });

                                // Use truncated message as placeholder while AI generates
                                titles[thread.id] = text.length > 35 ? text.substring(0, 35) + '...' : text;
                            }
                        }
                    } catch (e) {
                        // Ignore errors for individual threads
                    }
                }
            }
            setThreadTitles(titles);
        } catch (e) {
            console.error(e);
        }
    }, [client, generateTitle]);

    // New Chat handler
    const handleNewChat = () => {
        const newThreadId = crypto.randomUUID();
        localStorage.setItem("berkshire_thread_id", newThreadId);
        setThreadId(newThreadId);
        setMessages([]);
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
        }
    };

    // Delete thread handler
    const handleDeleteThread = async (e: React.MouseEvent, threadIdToDelete: string) => {
        e.stopPropagation(); // Prevent switching to the thread when clicking delete
        try {
            // Call the Mastra API to delete the thread
            await fetch(`/api/memory/threads/${threadIdToDelete}?agentId=berkshire-agent`, {
                method: 'DELETE',
            });

            // Remove from local state
            setAllThreads(prev => prev.filter(t => t.id !== threadIdToDelete));

            // Remove cached title
            const cachedTitles = JSON.parse(localStorage.getItem('berkshire_thread_titles') || '{}');
            delete cachedTitles[threadIdToDelete];
            localStorage.setItem('berkshire_thread_titles', JSON.stringify(cachedTitles));

            // If we deleted the current thread, start a new chat
            if (threadId === threadIdToDelete) {
                handleNewChat();
            }
        } catch (error) {
            console.error('Failed to delete thread:', error);
        }
    };

    // Resolve or create threadId on mount
    useEffect(() => {
        let isMounted = true;

        const loadThread = async () => {
            setIsLoadingHistory(true);
            const storedThreadId = localStorage.getItem("berkshire_thread_id");

            try {
                const threadsRes = await client.listMemoryThreads({ agentId: "berkshire-agent" });
                const validThreads = threadsRes.threads || [];
                if (isMounted) setAllThreads(validThreads);

                if (storedThreadId && validThreads.some((t: any) => t.id === storedThreadId)) {
                    const res: any = await client.listThreadMessages(storedThreadId, { agentId: "berkshire-agent" });
                    if (!isMounted) return;
                    if (res && res.messages && Array.isArray(res.messages)) {
                        setMessages(res.messages);
                        setThreadId(storedThreadId);
                    }
                } else {
                    if (!isMounted) return;
                    const newThreadId = crypto.randomUUID();
                    localStorage.setItem("berkshire_thread_id", newThreadId);
                    setThreadId(newThreadId);
                    setMessages([]);
                }
            } catch (error: any) {
                if (!isMounted) return;
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
            threadId
        });
        refreshThreads();
    };

    // Format relative date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Get temporal group for a thread
    const getTemporalGroup = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return 'Last 7 Days';
        if (diffDays < 30) return 'Last 30 Days';
        return 'Older';
    };

    // Group threads by temporal category
    const groupedThreads = allThreads.reduce((groups: Record<string, any[]>, thread) => {
        const group = getTemporalGroup(thread.updatedAt);
        if (!groups[group]) groups[group] = [];
        groups[group].push(thread);
        return groups;
    }, {});

    // Extract text from message content
    const getMessageText = (message: any) => {
        const content: any = message.content;
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.map((p: any) => p.text || p.content || '').join('');
        if (content?.parts && Array.isArray(content.parts)) return content.parts.map((p: any) => p.text || '').join('');
        if (Array.isArray(message.parts)) return message.parts.map((p: any) => p.text || '').join('');
        return '';
    };

    // Render text with markdown parsing (headings, bold, lists)
    const renderFormattedText = (line: string, isUser: boolean): React.ReactNode => {
        // Handle headings (### Heading or ###Heading)
        if (line.match(/^###\s*.+/)) {
            const text = line.replace(/^###\s*/, '');
            return <h4 className="font-bold text-[#1a4480] text-base mt-3 mb-1">{text}</h4>;
        }
        if (line.match(/^##\s*.+/)) {
            const text = line.replace(/^##\s*/, '');
            return <h3 className="font-bold text-[#1a4480] text-lg mt-3 mb-1">{text}</h3>;
        }
        if (line.match(/^#\s*.+/)) {
            const text = line.replace(/^#\s*/, '');
            return <h2 className="font-bold text-[#1a4480] text-xl mt-3 mb-1">{text}</h2>;
        }

        // Handle numbered lists (e.g., "1. ", "2. ")
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
            return (
                <div className="flex gap-2 mt-2">
                    <span className={`font-semibold ${isUser ? 'text-white' : 'text-[#1a4480]'}`}>{numberedMatch[1]}.</span>
                    <span>{renderBoldText(numberedMatch[2], isUser)}</span>
                </div>
            );
        }

        // Handle bullet points
        if (line.startsWith('- ') || line.startsWith('• ')) {
            return (
                <div className="flex gap-2 mt-1 ml-2">
                    <span className={isUser ? 'text-white' : 'text-[#1a4480]'}>•</span>
                    <span>{renderBoldText(line.slice(2), isUser)}</span>
                </div>
            );
        }

        // Regular text with bold parsing
        return <span>{renderBoldText(line, isUser)}</span>;
    };

    // Parse **bold** text
    const renderBoldText = (text: string, isUser: boolean): React.ReactNode => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2);
                return (
                    <strong key={i} className={isUser ? "font-semibold" : "font-semibold text-[#1a4480]"}>
                        {boldText}
                    </strong>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="flex h-screen bg-[#f8f9fa]">
            {/* Left Sidebar */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="h-full bg-[#f0f4f9] border-r border-[#e0e4e8] flex flex-col overflow-hidden"
                    >
                        {/* Sidebar Header */}
                        <div className="p-4 flex items-center justify-between">
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-2 hover:bg-[#e0e4e8] rounded-full transition-colors"
                            >
                                <Menu size={20} className="text-[#5f6368]" />
                            </button>
                        </div>

                        {/* New Chat Button */}
                        <div className="px-3 mb-2">
                            <button
                                onClick={handleNewChat}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-[#e3e8ed] hover:bg-[#d3d8dd] rounded-full transition-colors text-[#1a4480] font-medium"
                            >
                                <Plus size={20} />
                                <span>New chat</span>
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="px-3 mb-4">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a6]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search chats..."
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#e0e4e8] rounded-lg text-sm text-[#202124] focus:outline-none focus:border-[#1a4480] transition-colors placeholder:text-[#9aa0a6]"
                                />
                            </div>
                        </div>

                        {/* Thread List with Temporal Grouping */}
                        <div className="flex-1 overflow-y-auto px-2">
                            {allThreads.length === 0 ? (
                                <div className="px-3 py-8 text-center">
                                    <MessageSquare size={24} className="mx-auto text-[#9aa0a6] mb-2" />
                                    <p className="text-sm text-[#5f6368]">No conversations yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'].map((group) => {
                                        // Filter threads by search query
                                        const threads = (groupedThreads[group] || []).filter((thread: any) => {
                                            if (!searchQuery.trim()) return true;
                                            const title = threadTitles[thread.id] || '';
                                            return title.toLowerCase().includes(searchQuery.toLowerCase());
                                        });
                                        if (threads.length === 0) return null;
                                        return (
                                            <div key={group}>
                                                {/* Time Break Header */}
                                                <p className="px-3 py-2 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                                                    {group}
                                                </p>
                                                <div className="space-y-0.5">
                                                    {threads.map((thread: any, idx: number) => (
                                                        <motion.div
                                                            key={thread.id}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: idx * 0.03, duration: 0.2 }}
                                                            whileHover={{ x: 4 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => handleSwitchThread(thread.id)}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-pointer",
                                                                threadId === thread.id
                                                                    ? "bg-[#d3e3fd] text-[#1a4480] shadow-sm"
                                                                    : "hover:bg-[#e3e8ed] text-[#3c4043]"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <MessageSquare size={14} className={cn(
                                                                    "shrink-0 transition-colors",
                                                                    threadId === thread.id ? "text-[#1a4480]" : "text-[#9aa0a6]"
                                                                )} />
                                                                <p className="text-sm font-medium truncate flex-1">
                                                                    {threadTitles[thread.id] || 'New Conversation'}
                                                                </p>
                                                                {/* Delete Button */}
                                                                <button
                                                                    onClick={(e) => handleDeleteThread(e, thread.id)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                                                                    title="Delete conversation"
                                                                >
                                                                    <Trash2 size={14} className="text-red-500" />
                                                                </button>
                                                            </div>
                                                            <p className="text-[11px] text-[#5f6368] mt-0.5 ml-6">
                                                                {new Date(thread.updatedAt).toLocaleTimeString('en-US', {
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                    hour12: true
                                                                })}
                                                            </p>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-[#e0e4e8] bg-white">
                    <div className="flex items-center gap-3">
                        {!isSidebarOpen && (
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 hover:bg-[#f0f4f9] rounded-full transition-colors"
                            >
                                <Menu size={20} className="text-[#5f6368]" />
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#1a4480] rounded-lg flex items-center justify-center">
                                <BookOpen size={16} className="text-white" />
                            </div>
                            <span className="font-semibold text-[#1a4480]">Berkshire Intelligence</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#1a4480] rounded-full flex items-center justify-center">
                            <User size={16} className="text-white" />
                        </div>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-4 py-8">
                        <AnimatePresence initial={false}>
                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-32">
                                    <Loader2 className="w-8 h-8 text-[#1a4480] animate-spin mb-4" />
                                    <p className="text-sm text-[#5f6368]">Loading conversation...</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center py-16"
                                >
                                    {/* Hero */}
                                    <motion.h1
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="text-4xl md:text-5xl font-semibold text-[#1a4480] mb-6"
                                    >
                                        Berkshire Hathaway Intelligence
                                    </motion.h1>
                                    <motion.p
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="text-lg text-[#5f6368] max-w-xl mx-auto mb-12 leading-relaxed"
                                    >
                                        Intelligently answer questions about{" "}
                                        <span className="text-[#1a4480] font-medium">Warren Buffett&apos;s investment philosophy</span>{" "}
                                        using{" "}
                                        <span className="text-[#1a4480] font-medium">Berkshire Hathaway shareholder letters</span>{" "}
                                        from <span className="text-[#1a4480] font-medium">1977-2024</span>
                                    </motion.p>

                                    {/* Sample Query Cards */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto"
                                    >
                                        {[
                                            { q: "What does Warren Buffett think about cryptocurrency?", icon: CircleDollarSign },
                                            { q: "How has Berkshire's investment strategy evolved over the past 5 years?", icon: TrendingUp },
                                            { q: "What companies did Berkshire acquire in 2023?", icon: Building2 },
                                            { q: "What is Buffett's view on market volatility and timing?", icon: Clock }
                                        ].map((item, idx) => {
                                            const Icon = item.icon;
                                            return (
                                                <motion.button
                                                    key={item.q}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.4 + idx * 0.05 }}
                                                    onClick={() => setInput(item.q)}
                                                    className="flex items-start gap-3 p-4 bg-white border border-[#e0e4e8] hover:border-[#1a4480] hover:bg-[#f8fafc] rounded-xl text-left transition-all group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center shrink-0 group-hover:bg-[#d3e3fd] transition-colors">
                                                        <Icon size={16} className="text-[#1a4480]" />
                                                    </div>
                                                    <p className="text-sm text-[#3c4043] leading-relaxed">
                                                        {item.q}
                                                    </p>
                                                </motion.button>
                                            );
                                        })}
                                    </motion.div>
                                </motion.div>
                            ) : (
                                <div className="space-y-6">
                                    {messages.map((message, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "flex gap-4",
                                                message.role === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            {message.role !== "user" && (
                                                <div className="w-8 h-8 rounded-full bg-[#1a4480] flex items-center justify-center shrink-0">
                                                    <Bot size={16} className="text-white" />
                                                </div>
                                            )}
                                            <div className={cn(
                                                "max-w-[80%] rounded-2xl px-5 py-4",
                                                message.role === "user"
                                                    ? "bg-[#1a4480] text-white"
                                                    : "bg-white border border-[#e0e4e8] shadow-sm"
                                            )}>
                                                <div className={cn(
                                                    "text-[15px] leading-relaxed",
                                                    message.role === "user" ? "text-white" : "text-[#202124]"
                                                )}>
                                                    {getMessageText(message).split('\n').map((line: string, idx: number) => (
                                                        <div key={idx} className={idx > 0 ? "mt-3" : ""}>
                                                            {renderFormattedText(line, message.role === "user")}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Citations for assistant messages */}
                                                {message.role === "assistant" && (() => {
                                                    const text = getMessageText(message);
                                                    const years = Array.from(new Set(text.match(/\((19|20)\d{2}\)/g) || [])) as string[];
                                                    if (years.length === 0) return null;
                                                    return (
                                                        <div className="mt-3 pt-3 border-t border-[#e0e4e8]">
                                                            <p className="text-xs text-[#5f6368] mb-2">Sources</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {years.slice(0, 5).map((year: string) => (
                                                                    <span key={year} className="text-xs px-2 py-1 bg-[#e8f0fe] text-[#1a4480] rounded-md">
                                                                        Letter {year.replace(/[()]/g, '')}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            {message.role === "user" && (
                                                <div className="w-8 h-8 rounded-full bg-[#1a4480] flex items-center justify-center shrink-0">
                                                    <User size={16} className="text-white" />
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}

                                    {/* Thinking Indicator */}
                                    {isRunning && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex gap-4 justify-start"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-[#1a4480] flex items-center justify-center shrink-0">
                                                <Bot size={16} className="text-white" />
                                            </div>
                                            <div className="max-w-[80%] rounded-2xl px-5 py-4 bg-white border border-[#e0e4e8] shadow-sm">
                                                <div className="flex items-center gap-2 text-[#5f6368]">
                                                    <div className="flex gap-1">
                                                        <motion.span
                                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                                                            className="w-2 h-2 bg-[#1a4480] rounded-full"
                                                        />
                                                        <motion.span
                                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                                                            className="w-2 h-2 bg-[#1a4480] rounded-full"
                                                        />
                                                        <motion.span
                                                            animate={{ opacity: [0.4, 1, 0.4] }}
                                                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                                                            className="w-2 h-2 bg-[#1a4480] rounded-full"
                                                        />
                                                    </div>
                                                    <span className="text-sm ml-2">Thinking...</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Input Area */}
                <div className="border-t border-[#e0e4e8] bg-white p-4">
                    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about Berkshire Hathaway..."
                                className="w-full bg-[#f8f9fa] border border-[#e0e4e8] focus:border-[#1a4480] focus:ring-1 focus:ring-[#1a4480] rounded-full py-4 pl-6 pr-14 outline-none text-[#3c4043] placeholder:text-[#9aa0a6] transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isRunning}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#1a4480] hover:bg-[#0d3a6e] disabled:bg-[#9aa0a6] text-white rounded-full flex items-center justify-center transition-colors"
                            >
                                {isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
