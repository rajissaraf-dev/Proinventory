// services/firebase.ts - BACK TO BASICS
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { useEffect, useState } from "react";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID as string,
};

console.info("🔥 [Firebase] Project:", firebaseConfig.projectId);

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const provider = new EmailAuthProvider();
export const auth = getAuth(app);
export const storage = getStorage(app);

export const db = getFirestore(app);
export default db;

export async function logOut(): Promise<void> {
  if (auth.currentUser?.isAnonymous && auth.currentUser.uid) {
    try {
      const mod = await import("./session.service");
      await mod.SessionService.deleteGuestData(auth.currentUser.uid).catch((error) => {
        console.warn("⚠️ [firebase] Guest cleanup failed:", error);
      });
    } catch (e) {
      console.warn("⚠️ [firebase] Failed to load session service for guest cleanup:", e);
    }
  }
  return signOut(auth);
}

export function useAuth(): User | null | undefined {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("🔐 [useAuth] User:", user?.uid || 'null');
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);
  
  return currentUser;
}
