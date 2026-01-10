
import React, { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, Unsubscribe, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, where } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { auth, db, messaging } from './firebaseConfig';

import Header from './components/common/Header';
import BottomNavBar from './components/common/BottomNavBar';
import HomePage from './components/pages/HomePage';
import ListingsPage from './components/pages/ListingsPage';
import ListingDetailsPage from './components/pages/ListingDetailsPage';
import VendorDashboard from './components/pages/VendorDashboard';
import VendorProfilePage from './components/pages/VendorProfilePage';
import AuthPage from './components/auth/AuthPage';
import AccountPage from './components/auth/AccountPage';
import SubCategoryPage from './components/pages/SubCategoryPage';
import FavoritesPage from './components/pages/FavoritesPage';
import SavedSearchesPage from './components/pages/SavedSearchesPage';
import EditProfilePage from './components/auth/EditProfilePage';
import SettingsPage from './components/pages/SettingsPage';
import ReferralPage from './components/pages/ReferralPage';
import AdminPanel from './components/admin/AdminPanel';
import ChatPage from './components/pages/ChatPage';
import AddFundsPage from './components/pages/AddFundsPage';
import WalletHistoryPage from './components/pages/WalletHistoryPage';
import NotificationsPage from './components/pages/NotificationsPage'; 
import HelpCenterPage from './components/pages/HelpCenterPage';
import { Listing, User, Category, AppView, NavigatePayload, AppNotification } from './types';
import { CATEGORIES as DEFAULT_CATEGORIES } from './constants';

const App: React.FC = () => {
  const [theme, setTheme] = useState('light');
  const [view, setView] = useState<AppView>('home');
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  
  const [listingsDB, setListingsDB] = useState<Listing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [chatTargetUser, setChatTargetUser] = useState<{id: string, name: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- 🔔 NATIVE SYSTEM NOTIFICATION TRIGGER ---
  const triggerNativeNotification = (title: string, body: string) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      // This triggers the Android/System Status Bar notification
      navigator.serviceWorker.ready.then((registration) => {
          // Fix: Type assertion to 'any' to bypass TS errors for potentially missing 'renotify' or 'vibrate' in NotificationOptions
          registration.showNotification(title, {
              body: body,
              icon: '/icon.png',
              badge: '/favicon.ico',
              tag: 'rizqdaan-alert',
              renotify: true,
              vibrate: [200, 100, 200]
          } as any);
      });
  };

  const requestPushPermission = async () => {
      if (!('Notification' in window) || !messaging || !user?.id || !db) {
          setShowPermissionBanner(false);
          return;
      }

      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
              const vapidKey = 'BAw_pNvmzPURAsecjQH0V3aPbVQ-PmvrZiui2YhyWOwYGb71ycnVejhE-O7qMOZ84oCa6uL-IcBwoyRgEENirlw';
              const token = await getToken(messaging, { vapidKey });
              if (token) {
                  await setDoc(doc(db, 'users', user.id), { 
                      fcmToken: token,
                      notificationsEnabled: true 
                  }, { merge: true });
                  
                  // Send a system welcome alert
                  triggerNativeNotification("RizqDaan Alerts Active", "Mubarak ho! Notifications ab aapki status bar mein nazar ayenge.");
                  setShowPermissionBanner(false);
              }
          } else {
              setShowPermissionBanner(false);
          }
      } catch (e) {
          console.error("Messaging setup error:", e);
          setShowPermissionBanner(false);
      }
  };

  useEffect(() => {
    if (user && messaging && 'Notification' in window) {
        if (Notification.permission === 'default') {
            setShowPermissionBanner(true);
        }
        
        try {
            const unsubscribeOnMessage = onMessage(messaging, (payload) => {
                const title = payload.notification?.title || "RizqDaan Update";
                const body = payload.notification?.body || "Check your app for details.";
                
                // 1. Show in Status Bar (drawer)
                triggerNativeNotification(title, body);

                // 2. Keep the internal UI toast for better UX
                setActiveToast({
                    id: Date.now().toString(),
                    userId: user.id,
                    title: title,
                    message: body,
                    type: 'info',
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
                setTimeout(() => setActiveToast(null), 6000);
            });
            return () => unsubscribeOnMessage();
        } catch (e) {
            console.error("onMessage error:", e);
        }
    }
  }, [user]);

  const handleNavigate = useCallback((newView: AppView, payload?: NavigatePayload) => {
    if (newView !== 'details' && newView !== 'subcategories') {
      setSelectedListing(null); setSelectedCategory(null);
    }
    if (newView !== 'listings' && newView !== 'details') setSearchQuery('');
    if (payload?.listing && newView === 'details') setSelectedListing(payload.listing);
    if (payload?.category && newView === 'subcategories') setSelectedCategory(payload.category);
    if (payload?.query !== undefined && newView === 'listings') setSearchQuery(payload.query);
    if (payload?.targetUser && newView === 'chats') setChatTargetUser(payload.targetUser);
    if (payload?.targetVendorId && newView === 'vendor-profile') setSelectedVendorId(payload.targetVendorId);

    if (newView === 'add-listing') { setInitialVendorTab('add-listing'); setView('vendor-dashboard'); }
    else if (newView === 'my-ads') { setInitialVendorTab('my-listings'); setView('vendor-dashboard'); }
    else if (newView === 'vendor-analytics') { setInitialVendorTab('dashboard'); setView('vendor-dashboard'); }
    else if (newView === 'promote-business') { setInitialVendorTab('promotions'); setView('vendor-dashboard'); }
    else setView(newView);
    window.scrollTo(0, 0);
  }, []);

  const [initialVendorTab, setInitialVendorTab] = useState<'dashboard' | 'my-listings' | 'add-listing' | 'promotions'>('dashboard');

  useEffect(() => {
    if (!auth) { setIsReady(true); return; }
    const timeout = setTimeout(() => { if (!isReady) setIsReady(true); }, 6000);
    
    let userUnsubscribe: Unsubscribe | null = null;
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
          if (firebaseUser && firebaseUser.emailVerified) {
              if (db) {
                  userUnsubscribe = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
                      if (docSnap.exists()) {
                          setUser({ id: firebaseUser.uid, ...docSnap.data() } as User);
                      }
                      clearTimeout(timeout);
                      setIsReady(true);
                  }, (err) => { 
                      setIsReady(true); 
                  });
              } else { setIsReady(true); }
          } else {
              if (userUnsubscribe) userUnsubscribe();
              setUser(null);
              clearTimeout(timeout);
              setIsReady(true);
          }
      } catch (e) {
          setIsReady(true);
      }
    });
    return () => { authUnsubscribe(); if (userUnsubscribe) userUnsubscribe(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
      if (!db || !isReady) return;
      const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          setListingsDB(items);
          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setHasMoreListings(snapshot.docs.length >= 20);
      });
      return () => unsubscribe();
  }, [isReady]);

  const fetchMoreListings = async () => {
      if (!db || loadingData || !hasMoreListings || !lastListingDoc) return;
      setLoadingData(true);
      try {
          const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), startAfter(lastListingDoc), limit(20));
          const snapshot = await getDocs(q);
          const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          setHasMoreListings(snapshot.docs.length >= 20);
          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setListingsDB(prev => [...prev, ...newItems]);
      } catch(e) { console.error(e); }
      finally { setLoadingData(false); }
  };

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const handleLogin = async (email: string, password: string) => {
    try {
        if (email === 'admin@rizqdaan.com' && password === 'admin') {
            const adminUser: User = { id: 'admin-demo', name: 'Admin', email: 'admin@rizqdaan.com', phone: '0000', shopName: 'Admin HQ', shopAddress: 'Cloud', isVerified: true, isAdmin: true };
            setUser(adminUser); setView('admin'); return { success: true, message: 'Logged in as Demo Admin' };
        }
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, message: 'Please verify your email.' };
        }
        return { success: true, message: 'Login successful!' };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  const handleSignup = async (userData: any) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(userData.email, userData.password || 'password123');
        await sendEmailVerification(userCredential.user);
        const newUserId = userCredential.user.uid;
        const newUserProfile: User = {
            id: newUserId, name: userData.name, email: userData.email, phone: userData.phone,
            shopName: userData.shopName, shopAddress: userData.shopAddress, isVerified: false,
            referralCode: `USER-${Math.floor(1000 + Math.random() * 9000)}`, referredBy: null,
            wallet: { balance: 0, totalSpend: 0, pendingDeposit: 0, pendingWithdrawal: 0 },
            walletHistory: [], favorites: []
        };
        await setDoc(doc(db, "users", newUserId), newUserProfile);
        await signOut(auth);
        return { success: true, message: 'Signup successful! Verification email sent.', user: newUserProfile };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  if (!isReady) {
      return (
          <div className="flex h-screen items-center justify-center bg-primary">
              <div className="text-center p-8">
                  <h1 className="text-white font-black text-2xl tracking-widest mb-2 uppercase animate-pulse">Rizq Daan</h1>
                  <p className="text-white/50 text-[10px] uppercase font-bold tracking-tighter">Preparing Sustenance...</p>
              </div>
          </div>
      );
  }

  const renderView = () => {
    switch (view) {
      case 'home': return <HomePage listings={listingsDB} categories={categories} onNavigate={handleNavigate} onSaveSearch={() => {}} />;
      case 'listings': return <ListingsPage listings={listingsDB} onNavigate={(v, p) => handleNavigate('details', p)} initialSearchTerm={searchQuery} loadMore={fetchMoreListings} hasMore={hasMoreListings} isLoading={loadingData} />;
      case 'details': return selectedListing ? <ListingDetailsPage listing={selectedListing} listings={listingsDB} user={user} onNavigate={handleNavigate as any} /> : null;
      case 'vendor-dashboard': return <VendorDashboard initialTab={initialVendorTab} listings={listingsDB} user={user} onNavigate={handleNavigate} />;
      case 'vendor-profile': return selectedVendorId ? <VendorProfilePage vendorId={selectedVendorId} currentUser={user} listings={listingsDB} onNavigate={handleNavigate} /> : null;
      case 'auth': return <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={() => setView('auth')} />;
      case 'account': return user ? <AccountPage user={user} listings={listingsDB} onLogout={() => { signOut(auth); setUser(null); setView('home'); }} onNavigate={handleNavigate as any} /> : <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={() => setView('auth')} />;
      case 'subcategories': return selectedCategory ? <SubCategoryPage category={selectedCategory} onNavigate={() => setView('home')} onListingNavigate={(v, q) => handleNavigate(v, { query: q })} /> : null;
      case 'chats': return user ? <ChatPage currentUser={user} targetUser={chatTargetUser} onNavigate={() => setView('home')} /> : null;
      case 'favorites': return user ? <FavoritesPage user={user} listings={listingsDB} onNavigate={handleNavigate as any} /> : null;
      case 'saved-searches': return user ? <SavedSearchesPage searches={user.savedSearches || []} onNavigate={handleNavigate as any} /> : null;
      case 'edit-profile': return user ? <EditProfilePage user={user} onNavigate={handleNavigate} /> : null;
      case 'settings': return user ? <SettingsPage user={user} onNavigate={handleNavigate} currentTheme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} onLogout={() => { signOut(auth); setUser(null); setView('home'); }} /> : null;
      case 'admin': return user?.isAdmin ? <AdminPanel users={[]} listings={listingsDB} onUpdateUserVerification={() => {}} onDeleteListing={() => {}} onImpersonate={(u) => { setUser(u); setView('vendor-dashboard'); }} onNavigate={handleNavigate} /> : null;
      case 'add-balance': return user ? <AddFundsPage user={user} onNavigate={() => setView('account')} /> : null;
      case 'referrals': return user ? <ReferralPage user={user} onNavigate={() => setView('account')} /> : null;
      case 'wallet-history': return user ? <WalletHistoryPage user={user} onNavigate={() => setView('account')} /> : null;
      case 'notifications': return user ? <NotificationsPage user={user} onNavigate={handleNavigate} /> : null;
      case 'help-center': return <HelpCenterPage onNavigate={() => setView('account')} />;
      default: return <HomePage listings={listingsDB} categories={categories} onNavigate={handleNavigate} onSaveSearch={() => {}} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-dark-bg' : 'bg-primary-light'}`}>
      
      {activeToast && (
          <div onClick={() => { handleNavigate('notifications'); setActiveToast(null); }} className="fixed top-4 left-4 right-4 z-[100] bg-white dark:bg-dark-surface shadow-2xl border-l-8 border-primary rounded-2xl p-4 animate-bounce-in cursor-pointer">
              <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-full text-primary">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-gray-900 dark:text-white truncate uppercase tracking-tighter">{activeToast.title}</h4>
                      <p className="text-xs text-gray-500 truncate">{activeToast.message}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setActiveToast(null); }} className="text-gray-400 p-1">✕</button>
              </div>
          </div>
      )}

      {showPermissionBanner && (
          <div className="fixed bottom-20 left-4 right-4 z-50 bg-primary text-white p-5 rounded-2xl shadow-2xl animate-fade-in border-2 border-white/20">
              <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                      <h4 className="font-black text-sm uppercase">Enable Alerts? 🔔</h4>
                      <p className="text-[10px] opacity-80 mt-1">Receive system alerts in your status bar.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={requestPushPermission} className="px-4 py-2 bg-white text-primary rounded-xl text-xs font-black shadow-lg uppercase active:scale-90 transition-transform">Allow</button>
                    <button onClick={() => setShowPermissionBanner(false)} className="px-3 text-white/50 text-xs font-bold uppercase">Skip</button>
                  </div>
              </div>
          </div>
      )}

      <Header onNavigate={handleNavigate as any} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} currentTheme={theme} user={user} />
      <main className={view === 'home' ? "container mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24" : "container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24"}>
        {renderView()}
      </main>
      <BottomNavBar onNavigate={handleNavigate as any} activeView={view} />
    </div>
  );
};

export default App;
