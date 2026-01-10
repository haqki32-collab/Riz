
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, Unsubscribe, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, where } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { App as CapacitorApp } from '@capacitor/app';
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
  
  // Navigation State
  const [navigationHistory, setNavigationHistory] = useState<{view: AppView, payload?: NavigatePayload}[]>([]);
  const lastBackPressTime = useRef<number>(0);

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
  const [initialVendorTab, setInitialVendorTab] = useState<'dashboard' | 'my-listings' | 'add-listing' | 'promotions'>('dashboard');

  // --- 🛠️ ADVANCED NATIVE NAVIGATION ENGINE ---

  const performViewUpdate = (newView: AppView, payload?: NavigatePayload) => {
    // Sync React states based on the view
    if (newView !== 'details' && newView !== 'subcategories') {
        setSelectedListing(null); setSelectedCategory(null);
    }
    if (newView !== 'listings' && newView !== 'details') setSearchQuery('');
    
    if (payload?.listing && newView === 'details') setSelectedListing(payload.listing);
    if (payload?.category && newView === 'subcategories') setSelectedCategory(payload.category);
    if (payload?.query !== undefined && newView === 'listings') setSearchQuery(payload.query);
    if (payload?.targetUser && newView === 'chats') setChatTargetUser(payload.targetUser);
    if (payload?.targetVendorId && newView === 'vendor-profile') setSelectedVendorId(payload.targetVendorId);

    // Handle Vendor Dashboard tabs
    const vendorSubRoutes = ['add-listing', 'my-ads', 'vendor-analytics', 'promote-business'];
    if (vendorSubRoutes.includes(newView as string)) {
        const tab = newView === 'add-listing' ? 'add-listing' : 
                    newView === 'my-ads' ? 'my-listings' : 
                    newView === 'promote-business' ? 'promotions' : 'dashboard';
        setInitialVendorTab(tab as any);
        setView('vendor-dashboard');
    } else {
        setView(newView);
    }
    window.scrollTo(0, 0);
  };

  const handleNavigate = useCallback((newView: AppView, payload?: NavigatePayload) => {
    // 1. Update the internal history stack
    setNavigationHistory(prev => [...prev, { view, payload: undefined }]); // Save current view before changing
    
    // 2. Browser History Trick (Prevents browser back from exiting immediately)
    window.history.pushState({ dummy: Date.now() }, '', '');

    // 3. Update the UI
    performViewUpdate(newView, payload);
  }, [view]);

  const handleGoBack = useCallback(() => {
    if (navigationHistory.length > 0) {
        const historyCopy = [...navigationHistory];
        const lastEntry = historyCopy.pop();
        setNavigationHistory(historyCopy);
        
        if (lastEntry) {
            performViewUpdate(lastEntry.view, lastEntry.payload);
        }
        return true; // We handled it
    } else if (view !== 'home') {
        setView('home');
        setNavigationHistory([]);
        return true;
    }
    return false; // Let default behavior happen (exit)
  }, [navigationHistory, view]);

  // NATIVE Hardware Back Button Listener
  useEffect(() => {
    const backButtonHandler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const handled = handleGoBack();
        
        if (!handled && view === 'home') {
            // "Double Back to Exit" Logic
            const currentTime = Date.now();
            if (currentTime - lastBackPressTime.current < 2000) {
                CapacitorApp.exitApp();
            } else {
                lastBackPressTime.current = currentTime;
                setActiveToast({
                    id: 'exit-alert', userId: 'local', type: 'info', isRead: false, createdAt: new Date().toISOString(),
                    title: "RizqDaan", message: "Pichla button dubara dabayen band karne ke liye."
                });
                setTimeout(() => setActiveToast(null), 2000);
            }
        }
    });

    // Browser Fallback (popstate)
    const onPopState = (e: PopStateEvent) => {
        handleGoBack();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
        backButtonHandler.then(h => h.remove());
        window.removeEventListener('popstate', onPopState);
    };
  }, [handleGoBack, view]);

  // --- 🔔 FIREBASE & DATA LOGIC ---
  
  const triggerNativeNotification = (title: string, body: string) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
              body: body, icon: '/icon.png', badge: '/favicon.ico', tag: 'rizqdaan-alert', rennotify: true,
          } as any);
      }).catch(() => {});
  };

  const requestPushPermission = async () => {
      if (!('Notification' in window) || !messaging || !user?.id || !db) { setShowPermissionBanner(false); return; }
      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
              const vapidKey = 'BAw_pNvmzPURAsecjQH0V3aPbVQ-PmvrZiui2YhyWOwYGb71ycnVejhE-O7qMOZ84oCa6uL-IcBwoyRgEENirlw';
              const token = await getToken(messaging, { vapidKey });
              if (token) {
                  await setDoc(doc(db, 'users', user.id), { fcmToken: token, notificationsEnabled: true }, { merge: true });
                  triggerNativeNotification("RizqDaan alerts active! 🔊", "Mubarak ho! Alerts enable ho gaye.");
                  setShowPermissionBanner(false);
              }
          } else { setShowPermissionBanner(false); }
      } catch (e) { setShowPermissionBanner(false); }
  };

  useEffect(() => {
    if (user && messaging && 'Notification' in window) {
        if (Notification.permission === 'default') setShowPermissionBanner(true);
        try {
            const unsubscribeOnMessage = onMessage(messaging, (payload) => {
                const title = payload.notification?.title || "Update";
                const body = payload.notification?.body || "Check your app.";
                triggerNativeNotification(title, body);
                setActiveToast({
                    id: Date.now().toString(), userId: user.id, title, message: body, type: 'info', isRead: false, createdAt: new Date().toISOString()
                });
                setTimeout(() => setActiveToast(null), 6000);
            });
            return () => unsubscribeOnMessage();
        } catch (e) {}
    }
  }, [user]);

  useEffect(() => {
    if (!auth) { setIsReady(true); return; }
    const timeout = setTimeout(() => { if (!isReady) setIsReady(true); }, 6000);
    let userUnsubscribe: Unsubscribe | null = null;
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
          if (firebaseUser && firebaseUser.emailVerified) {
              if (db) {
                  userUnsubscribe = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
                      if (docSnap.exists()) setUser({ id: firebaseUser.uid, ...docSnap.data() } as User);
                      clearTimeout(timeout); setIsReady(true);
                  });
              } else { setIsReady(true); }
          } else {
              if (userUnsubscribe) userUnsubscribe();
              setUser(null); clearTimeout(timeout); setIsReady(true);
          }
      } catch (e) { setIsReady(true); }
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
      } catch(e) {}
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
            setUser(adminUser); handleNavigate('admin'); return { success: true, message: 'Logged in' };
        }
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) { await signOut(auth); return { success: false, message: 'Verify email.' }; }
        return { success: true, message: 'Login successful!' };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  const handleSignup = async (userData: any) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password || 'password123');
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
        return { success: true, message: 'Signup successful!', user: newUserProfile };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  if (!isReady) {
      return (
          <div className="flex h-screen items-center justify-center bg-primary">
              <div className="text-center p-8">
                  <h1 className="text-white font-black text-2xl tracking-widest mb-2 uppercase animate-pulse">Rizq Daan</h1>
                  <p className="text-white/50 text-[10px] uppercase font-bold tracking-tighter">Please wait...</p>
              </div>
          </div>
      );
  }

  const renderView = () => {
    switch (view) {
      case 'home': return <HomePage listings={listingsDB} categories={categories} onNavigate={handleNavigate as any} onSaveSearch={() => {}} />;
      case 'listings': return <ListingsPage listings={listingsDB} onNavigate={(v, p) => handleNavigate('details', p)} initialSearchTerm={searchQuery} loadMore={fetchMoreListings} hasMore={hasMoreListings} isLoading={loadingData} />;
      case 'details': return selectedListing ? <ListingDetailsPage listing={selectedListing} listings={listingsDB} user={user} onNavigate={handleNavigate as any} /> : null;
      case 'vendor-dashboard': return <VendorDashboard initialTab={initialVendorTab} listings={listingsDB} user={user} onNavigate={handleNavigate as any} />;
      case 'vendor-profile': return selectedVendorId ? <VendorProfilePage vendorId={selectedVendorId} currentUser={user} listings={listingsDB} onNavigate={handleNavigate as any} /> : null;
      case 'auth': return <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={() => handleNavigate('auth')} />;
      case 'account': return user ? <AccountPage user={user} listings={listingsDB} onLogout={() => { signOut(auth); setUser(null); handleNavigate('home'); }} onNavigate={handleNavigate as any} /> : <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={() => handleNavigate('auth')} />;
      case 'subcategories': return selectedCategory ? <SubCategoryPage category={selectedCategory} onNavigate={() => handleGoBack()} onListingNavigate={(v, q) => handleNavigate(v as any, { query: q })} /> : null;
      case 'chats': return user ? <ChatPage currentUser={user} targetUser={chatTargetUser} onNavigate={() => handleGoBack()} /> : null;
      case 'favorites': return user ? <FavoritesPage user={user} listings={listingsDB} onNavigate={handleNavigate as any} /> : null;
      case 'saved-searches': return user ? <SavedSearchesPage searches={user.savedSearches || []} onNavigate={handleNavigate as any} /> : null;
      case 'edit-profile': return user ? <EditProfilePage user={user} onNavigate={handleNavigate as any} /> : null;
      case 'settings': return user ? <SettingsPage user={user} onNavigate={handleNavigate as any} currentTheme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} onLogout={() => { signOut(auth); setUser(null); handleNavigate('home'); }} /> : null;
      case 'admin': return user?.isAdmin ? <AdminPanel users={[]} listings={listingsDB} onUpdateUserVerification={() => {}} onDeleteListing={() => {}} onImpersonate={(u) => { setUser(u); handleNavigate('vendor-dashboard'); }} onNavigate={handleNavigate as any} /> : null;
      case 'add-balance': return user ? <AddFundsPage user={user} onNavigate={() => handleGoBack()} /> : null;
      case 'referrals': return user ? <ReferralPage user={user} onNavigate={() => handleGoBack()} /> : null;
      case 'wallet-history': return user ? <WalletHistoryPage user={user} onNavigate={() => handleGoBack()} /> : null;
      case 'notifications': return user ? <NotificationsPage user={user} onNavigate={handleNavigate as any} /> : null;
      case 'help-center': return <HelpCenterPage onNavigate={() => handleGoBack()} />;
      default: return <HomePage listings={listingsDB} categories={categories} onNavigate={handleNavigate as any} onSaveSearch={() => {}} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-dark-bg' : 'bg-primary-light'}`}>
      
      {activeToast && (
          <div onClick={() => activeToast.id !== 'exit-alert' && handleNavigate('notifications')} className="fixed top-4 left-4 right-4 z-[100] bg-white dark:bg-dark-surface shadow-2xl border-l-8 border-primary rounded-2xl p-4 animate-bounce-in cursor-pointer">
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
                  <div className="flex-1"><h4 className="font-black text-sm uppercase">Enable Alerts?</h4><p className="text-[10px] opacity-80 mt-1">Get sound alerts for messages.</p></div>
                  <div className="flex gap-2">
                    <button onClick={requestPushPermission} className="px-4 py-2 bg-white text-primary rounded-xl text-xs font-black shadow-lg">Allow</button>
                    <button onClick={() => setShowPermissionBanner(false)} className="px-3 text-white/50 text-xs font-bold">Skip</button>
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
