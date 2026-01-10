
import React, { useState, useEffect } from 'react';
import { User, AppView, NavigatePayload } from '../../types';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth } from '../../firebaseConfig';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

interface SettingsPageProps {
  user: User;
  onNavigate: (view: AppView, payload?: NavigatePayload) => void;
  currentTheme: string;
  toggleTheme: () => void;
  onLogout: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ user, onNavigate, currentTheme, toggleTheme, onLogout }) => {
  const [notifications, setNotifications] = useState({
    push: user.notifications?.push ?? false,
    email: user.notifications?.email ?? false,
    sms: user.notifications?.sms ?? true,
  });

  const [pushStatus, setPushStatus] = useState<'none' | 'checking' | 'granted' | 'denied'>('none');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
        PushNotifications.checkPermissions().then(res => {
            setPushStatus(res.receive);
        });
    }
  }, []);

  const handleEnablePush = async () => {
    if (!Capacitor.isNativePlatform()) {
        alert("Push notifications are only available on mobile devices.");
        return;
    }

    setIsActivating(true);
    try {
        // 1. Add listeners FIRST
        await PushNotifications.removeAllListeners();
        
        await PushNotifications.addListener('registration', (token) => {
            console.log("Push Token Generated:", token.value);
            localStorage.setItem('rizqdaan_fcm_token', token.value);
            // We don't write to Firestore here to avoid bridge overload
        });

        await PushNotifications.addListener('registrationError', (err) => {
            console.error("Push Error:", err.error);
        });

        // 2. Request Permission
        const perm = await PushNotifications.requestPermissions();
        setPushStatus(perm.receive);

        if (perm.receive === 'granted') {
            // 3. Register with a massive delay for stability
            setTimeout(() => {
                PushNotifications.register();
                setNotifications(prev => ({ ...prev, push: true }));
                setIsActivating(false);
                alert("✅ Notifications Enabled Successfully!");
            }, 2000);
        } else {
            setIsActivating(false);
            alert("❌ Permission denied. Enable from phone settings.");
        }
    } catch (e) {
        setIsActivating(false);
        alert("Setup failed. Please restart the app.");
    }
  };

  useEffect(() => {
      if (db && user.id) {
          const userRef = doc(db, "users", user.id);
          setDoc(userRef, { notifications }, { merge: true }).catch(() => {});
      }
  }, [notifications, user.id]);

  const handleDeleteAccount = async () => {
      const confirmation = prompt("Type 'DELETE' to confirm you want to permanently delete your account.");
      if (confirmation === 'DELETE' && auth.currentUser) {
          try {
              await deleteDoc(doc(db, "users", user.id));
              await deleteUser(auth.currentUser);
              alert("Account deleted.");
              onLogout();
          } catch (e: any) {
              alert("Error deleting account. Please re-login and try again.");
          }
      }
  };

  return (
    <div className="animate-fade-in pb-20">
      <header className="flex items-center mb-6">
        <button onClick={() => onNavigate('account')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white ml-4">Settings</h1>
      </header>
      
      <div className="space-y-6 max-w-lg mx-auto">
        {/* PUSH NOTIFICATION SECTION - SAFE IMPLEMENTATION */}
        {Capacitor.isNativePlatform() && (
            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border-l-4 border-primary">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold dark:text-white">Push Notifications</h3>
                        <p className="text-xs text-gray-500">Get alerts for messages and updates.</p>
                    </div>
                    <div className={`p-2 rounded-full ${pushStatus === 'granted' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                </div>

                {pushStatus === 'granted' ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 text-xs font-bold rounded-lg text-center">
                        ✓ Notifications are Active
                    </div>
                ) : (
                    <button 
                        onClick={handleEnablePush}
                        disabled={isActivating}
                        className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isActivating ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : 'Enable Mobile Notifications'}
                    </button>
                )}
            </div>
        )}

        <div className="bg-white dark:bg-dark-surface p-4 rounded-xl shadow-md">
          <h3 className="px-1 py-2 text-sm font-semibold text-primary uppercase tracking-wider">Appearance</h3>
          <div className="w-full flex items-center justify-between p-3">
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-300 mr-4">
                {currentTheme === 'light' ? 
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> :
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                }
              </span>
              <span className="flex-grow font-medium text-gray-700 dark:text-gray-200">Dark Mode</span>
            </div>
            <button onClick={toggleTheme} className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors bg-gray-200 dark:bg-gray-600">
              <span className={`${currentTheme === 'dark' ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
            </button>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30">
             <button onClick={handleDeleteAccount} className="w-full text-red-600 dark:text-red-400 font-semibold text-sm py-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors">
                 Delete Account Permanently
             </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
