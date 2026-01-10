
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAfv3SjVOWJCbS-RB_cuHKSrQ0uv4kJ__s",
  authDomain: "rizqdaan.firebaseapp.com",
  projectId: "rizqdaan",
  storageBucket: "rizqdaan.firebasestorage.app",
  messagingSenderId: "6770003964",
  appId: "1:6770003964:web:3e47e1d4e4ba724c446c79"
});

const messaging = firebase.messaging();

// Background Notification Handler
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received ', payload);
  
  const notificationTitle = payload.notification.title || "RizqDaan Update";
  const notificationOptions = {
    body: payload.notification.body || "Check your app for details.",
    icon: '/icon.png',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200], // Mobile vibration pattern (buzz-buzz)
    tag: 'rizqdaan-alert', // Same tag prevents multiple entries for same alert
    renotify: true, // Buzz again even if same tag
    data: {
        url: '/' // Action URL
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click Handler: Notification par click karne se app khulegi
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
