
import React, { useState, useEffect } from 'react';
import { User, AppView, NavigatePayload } from '../../types';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth } from '../../firebaseConfig';

interface SettingsPageProps {
  user: User;
  onNavigate: (view: AppView, payload?: NavigatePayload) => void;
  currentTheme: string;
  toggleTheme: () => void;
  onLogout: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ user, onNavigate, currentTheme, toggleTheme, onLogout }) => {
  const [notifications, setNotifications] = useState({
    push: user.notifications?.push ?? true,
    email: user.notifications?.email ?? false,
    sms: user.notifications?.sms ?? true,
  });

  useEffect(() => {
      if (db && user.id) {
          const userRef = doc(db, "users", user.id);
          setDoc(userRef, { notifications }, { merge: true }).catch((e) => {
              console.warn("Setting save failed: " + (e?.message || String(e)));
          });
      }
  }, [notifications, user.id]);

  const toggleNotification = (type: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleDeleteAccount = async () => {
      const confirmation = prompt("Type 'DELETE' to confirm you want to permanently delete your account.");
      if (confirmation === 'DELETE' && auth.currentUser) {
          try {
              await deleteDoc(doc(db, "users", user.id));
              await deleteUser(auth.currentUser);
              alert("Account deleted.");
              onLogout();
          } catch (e: any) {
              console.error("Delete account error: " + (e?.message || String(e)));
              alert("Error deleting account. Please re-login and try again.");
          }
      }
  };

  return (
    <div className="animate-fade-in pb-20">
      <header className="flex items-center mb-6">
        <button onClick={() => onNavigate('account')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-black text-gray-800 dark:text-white ml-4 uppercase tracking-tighter">Settings</h1>
      </header>
      
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Appearance */}
        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="text-[10px] font-black text-primary dark:text-teal-400 uppercase tracking-widest mb-4">Appearance</h3>
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-gray-400 dark:text-gray-500 mr-4">
                {currentTheme === 'light' ? 
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> :
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                }
              </span>
              <span className="font-bold text-gray-700 dark:text-gray-200">Dark Mode</span>
            </div>
            <button onClick={toggleTheme} className="relative inline-flex items-center h-7 rounded-full w-12 transition-colors bg-gray-200 dark:bg-gray-700">
              <span className={`${currentTheme === 'dark' ? 'translate-x-6' : 'translate-x-1'} inline-block w-5 h-5 transform bg-white rounded-full transition-transform shadow-md`} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="text-[10px] font-black text-primary dark:text-teal-400 uppercase tracking-widest mb-4">Alerts System</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700 dark:text-gray-200">Push Notifications</span>
                <input type="checkbox" checked={notifications.push} onChange={() => toggleNotification('push')} className="h-6 w-6 text-primary rounded-lg" />
            </div>
            <hr className="border-gray-50 dark:border-gray-800" />
            <div className="text-center p-2 text-[10px] text-gray-400 uppercase font-black tracking-widest">
                Notifications Managed by System
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-3xl border border-red-100 dark:border-red-900/30">
             <button onClick={handleDeleteAccount} className="w-full text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-widest py-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors">
                 Delete Account Permanently
             </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
