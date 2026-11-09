// 動くナンプレ（NumPre Shift）- Firebase Cloud Config
const firebaseConfig = {
  apiKey: "AIzaSyB_w0aHKcyTpWoL6kfZzG91ICZ-LUjjjNs",
  authDomain: "numpre-shift.firebaseapp.com",
  projectId: "numpre-shift",
  storageBucket: "numpre-shift.firebasestorage.app",
  messagingSenderId: "959129258146",
  appId: "1:959129258146:web:69bafb01d82687dc12effb",
  measurementId: "G-XY9DD1E0S3"
};

let cloudDb = null;

// Firebase初期化 & Cloud Firestore接続
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    cloudDb = firebase.firestore();
    console.log('[NumPre Shift] Firebase Cloud Firestore Initialized Successfully!');
  } catch (err) {
    console.warn('[NumPre Shift] Firebase initialization warning:', err);
  }
}
