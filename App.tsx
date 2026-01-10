
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, Unsubscribe, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

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
import { Listing, User, Category, Transaction, AppView, NavigatePayload } from './types';
import { CATEGORIES as DEFAULT_CATEGORIES } from './constants';

const App: React.FC = () => {
  const [theme, setTheme] = useState('light');
  const [view, setView] = useState<AppView>('home');
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  
  const [listingsDB, setListingsDB] = useState<Listing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [chatTargetUser, setChatTargetUser] = useState<{id: string, name: string} | null>(null);
  const [usersDB, setUsersDB] = useState<User[]>([]);

  const [initialVendorTab, setInitialVendorTab] = useState<'dashboard' | 'my-listings' | 'add-listing' | 'promotions'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const pushInitRef = useRef(false);

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

  // --- SAFE PUSH NOTIFICATION SEQUENCE ---
  useEffect(() => {
    // Only attempt push if: Native Platform, User Logged In, and System Ready
    if (!Capacitor.isNativePlatform() || !user?.id || !isReady || pushInitRef.current) return;

    const setupPush = async () => {
      try {
        pushInitRef.current = true;
        console.log("Initializing Push Service...");

        // 1. Add listeners FIRST before requesting permission or registering
        await PushNotifications.addListener('registration', async (token) => {
            console.log("FCM Token Generated:", token.value);
            if (db && auth.currentUser) {
                try {
                    await setDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token.value }, { merge: true });
                } catch (err) { console.error("Could not save token to Firestore", err); }
            }
        });

        await PushNotifications.addListener('registrationError', (err) => {
            console.error("Push Registration Error:", err.error);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            const data = notification.notification.data;
            if (data?.view) handleNavigate(data.view as AppView, data.payload || {});
        });

        // 2. Request Permissions
        const permStatus = await PushNotifications.requestPermissions();
        
        if (permStatus.receive === 'granted') {
            // 3. Register (with a safe delay to avoid bridge collision)
            setTimeout(() => {
                PushNotifications.register().catch(e => console.error("Native Register Error", e));
            }, 5000);
        }
      } catch (err) {
        console.error("Critical Push Setup Failure:", err);
        pushInitRef.current = false;
      }
    };

    setupPush();

    return () => {
        if (Capacitor.isNativePlatform()) {
            PushNotifications.removeAllListeners();
        }
    };
  }, [user?.id, isReady, handleNavigate]);

  useEffect(() => {
    if (!auth) return;
    let userUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
          // If not verified, we don't block the ready state, but we don't set the user
          if (firebaseUser.emailVerified) {
              if (db) {
                  try {
                      userUnsubscribe = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
                          if (docSnap.exists()) {
                              setUser({ id: firebaseUser.uid, ...docSnap.data() } as User);
                          }
                          setIsReady(true);
                      }, (err) => {
                          console.error("Snapshot error:", err);
                          setIsReady(true);
                      });
                  } catch (e) { setIsReady(true); }
              } else { setIsReady(true); }
          } else {
              setUser(null);
              setIsReady(true);
          }
      } else {
          if (userUnsubscribe) { userUnsubscribe(); userUnsubscribe = null; }
          setUser(null);
          setIsReady(true);
      }
    });

    return () => {
        authUnsubscribe();
        if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  useEffect(() => {
      if (!db) return;
      const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          setListingsDB(items);
          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setHasMoreListings(snapshot.docs.length >= 20);
      }, (err) => {
          console.error("Listings fetch error:", err);
      });
      return () => unsubscribe();
  }, []);

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
        return { success: true, message: 'Signup successful! Verification email sent.', user: newUserProfile };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  if (!isReady) {
      return (
          <div className="flex h-screen items-center justify-center bg-primary">
              <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4 mx-auto"></div>
                  <h1 className="text-white font-bold text-xl tracking-widest">RIZQ DAAN</h1>
                  <p className="text-white/60 text-xs mt-2">Connecting to Services...</p>
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
      case 'admin': return user?.isAdmin ? <AdminPanel users={usersDB} listings={listingsDB} onUpdateUserVerification={() => {}} onDeleteListing={() => {}} onImpersonate={(u) => { setUser(u); setView('vendor-dashboard'); }} onNavigate={handleNavigate} /> : null;
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
      <Header onNavigate={handleNavigate as any} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} currentTheme={theme} user={user} />
      <main className={view === 'home' ? "container mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24" : "container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24"}>
        {renderView()}
      </main>
      <BottomNavBar onNavigate={handleNavigate as any} activeView={view} />
    </div>
  );
};

export default App;
