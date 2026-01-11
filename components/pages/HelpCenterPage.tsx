
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { HelpCategory, HelpTopic } from '../../types';

interface HelpCenterPageProps {
    onNavigate: () => void;
}

const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ onNavigate }) => {
    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [topics, setTopics] = useState<HelpTopic[]>([]);
    const [supportWhatsapp, setSupportWhatsapp] = useState('923265520658');
    const [loading, setLoading] = useState(true);
    
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;

        // 1. Listen to Help Categories - Standardized Ordering
        const unsubCats = onSnapshot(query(collection(db, 'help_categories'), where('isActive', '==', true)), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpCategory));
            setCategories(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
        });

        // 2. Listen to Help Topics - Standardized Ordering
        const unsubTopics = onSnapshot(query(collection(db, 'help_topics'), where('isActive', '==', true)), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTopic));
            setTopics(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
            setLoading(false);
        });

        // 3. System Support Settings
        const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.supportWhatsapp) setSupportWhatsapp(data.supportWhatsapp);
            }
        }, (err) => {
            console.warn("Settings listener error (Silent):", err.message);
        });

        return () => { unsubCats(); unsubTopics(); unsubSettings(); };
    }, []);

    // RESET EXPANSION: When category changes, close any open accordion
    useEffect(() => {
        setExpandedTopicId(null);
    }, [selectedCategoryId]);

    // SECURE FILTERING: Ensure topics ONLY belong to the selected category
    const currentCategory = useMemo(() => categories.find(c => c.id === selectedCategoryId), [categories, selectedCategoryId]);
    const filteredTopics = useMemo(() => topics.filter(t => t.categoryId === selectedCategoryId), [topics, selectedCategoryId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Verifying Knowledge Base...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-20">
            <header className="flex items-center mb-8 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-md sticky top-0 py-4 z-30 border-b border-gray-100 dark:border-gray-800 -mx-4 px-4">
                <button 
                    onClick={() => selectedCategoryId ? setSelectedCategoryId(null) : onNavigate()} 
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-90"
                >
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="ml-4">
                    <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                        {selectedCategoryId ? currentCategory?.title : 'Help Center'}
                    </h1>
                    {selectedCategoryId && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Support / {currentCategory?.title}</p>}
                </div>
            </header>

            {!selectedCategoryId ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className="flex items-center p-6 bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/30 transition-all text-left group active:scale-95"
                        >
                            <span className="text-4xl mr-4 group-hover:scale-110 transition-transform drop-shadow-sm">{cat.icon}</span>
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-lg leading-tight">{cat.title}</h3>
                                <p className="text-xs text-gray-500 font-medium">Browse articles & faqs</p>
                            </div>
                        </button>
                    ))}
                    {categories.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-white dark:bg-dark-surface rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800 px-6">
                            <p className="font-bold text-sm">System Updating...</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTopics.length > 0 ? filteredTopics.map((topic) => (
                        <div 
                            key={topic.id} 
                            className={`bg-white dark:bg-dark-surface border rounded-3xl overflow-hidden transition-all duration-300 ${expandedTopicId === topic.id ? 'shadow-xl border-primary/20 ring-4 ring-primary/5' : 'border-gray-100 dark:border-gray-700 shadow-sm'}`}
                        >
                            <button
                                onClick={() => setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)}
                                className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                                <span className={`font-bold transition-colors ${expandedTopicId === topic.id ? 'text-primary dark:text-teal-400' : 'text-gray-800 dark:text-white'}`}>{topic.title}</span>
                                <div className={`p-1.5 rounded-full transition-all duration-300 ${expandedTopicId === topic.id ? 'bg-primary text-white rotate-180' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>
                            
                            <div 
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedTopicId === topic.id ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <div className="p-6 pt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line border-t border-gray-50 dark:border-gray-800 bg-gray-50/30 dark:bg-black/10">
                                    {topic.content || "Description unavailable."}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center text-gray-400 bg-white dark:bg-dark-surface rounded-3xl border-2 border-dashed dark:border-gray-800">
                             <p className="font-black text-[10px] uppercase tracking-widest">No articles found in this section.</p>
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-12 p-8 bg-primary/5 dark:bg-primary/10 rounded-[40px] border border-primary/20 text-center shadow-inner relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full"></div>
                <h4 className="font-black text-primary dark:text-teal-400 text-xl tracking-tighter">Need more help?</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-8">Our Support Team is online to assist you directly.</p>
                <a 
                    href={`https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 px-10 py-4 bg-green-600 text-white font-black uppercase text-xs tracking-widest rounded-full hover:bg-green-700 active:scale-95 transition-all shadow-xl shadow-green-600/20"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.407 3.481 2.239 2.24 3.477 5.23 3.475 8.411-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.394 1.664zm6.222-3.528c1.552.92 3.51 1.405 5.621 1.406 5.543 0 10.054-4.51 10.057-10.055.002-2.686-1.047-5.212-2.952-7.118-1.904-1.905-4.432-2.952-7.118-2.952-5.544 0-10.054 4.51-10.057 10.055-.001 2.112.553 4.17 1.602 5.962l-.999 3.649 3.846-.947zm11.387-5.477c-.31-.156-1.834-.905-2.113-1.006-.279-.101-.482-.151-.684.151-.202.302-.782 1.006-.958 1.207-.176.202-.352.227-.662.071-.31-.156-1.311-.484-2.498-1.543-.923-.824-1.547-1.841-1.728-2.143-.181-.303-.019-.466.136-.621.14-.14.31-.362.466-.543.156-.181.208-.31.31-.517.103-.207.052-.387-.026-.543-.078-.156-.684-1.649-.938-2.261-.247-.597-.499-.516-.684-.525-.176-.008-.378-.009-.58-.009s-.53.076-.807.378c-.278.302-1.061 1.037-1.061 2.531s1.087 2.946 1.239 3.148c.152.202 2.139 3.267 5.182 4.581.724.312 1.288.499 1.728.639.728.231 1.389.198 1.912.12.583-.087 1.834-.751 2.09-1.477.256-.725.256-1.348.179-1.477-.076-.128-.278-.204-.588-.36z"/></svg>
                    Contact Support
                </a>
            </div>
        </div>
    );
};

export default HelpCenterPage;
