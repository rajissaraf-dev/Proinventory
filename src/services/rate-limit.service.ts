// services/rate-limit.service.ts
import { doc, setDoc, getDoc, updateDoc, increment, Timestamp } from "firebase/firestore";
import db from "./firebase";

const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  reset: { maxAttempts: 3, windowMs: 30 * 60 * 1000 },
  verification: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
};

type RateLimitType = keyof typeof RATE_LIMITS;

export const RateLimitService = {
  async check(identifier: string, type: RateLimitType): Promise<{ allowed: boolean; waitTime?: number }> {
    const docRef = doc(db, "rateLimits", `${type}_${identifier}`);
    const now = Date.now();
    
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        count: 1,
        firstAttempt: Timestamp.now(),
        lastAttempt: Timestamp.now(),
      });
      return { allowed: true };
    }

    const data = snap.data();
    const firstAttempt = data.firstAttempt.toMillis();
    const windowMs = RATE_LIMITS[type].windowMs;
    const maxAttempts = RATE_LIMITS[type].maxAttempts;

    if (now - firstAttempt > windowMs) {
      await setDoc(docRef, {
        count: 1,
        firstAttempt: Timestamp.now(),
        lastAttempt: Timestamp.now(),
      });
      return { allowed: true };
    }

    if (data.count >= maxAttempts) {
      const waitTime = Math.ceil((firstAttempt + windowMs - now) / 1000);
      return { allowed: false, waitTime };
    }

    await updateDoc(docRef, {
      count: increment(1),
      lastAttempt: Timestamp.now(),
    });
    return { allowed: true };
  },

  async reset(identifier: string, type: RateLimitType): Promise<void> {
    const docRef = doc(db, "rateLimits", `${type}_${identifier}`);
    await setDoc(docRef, {
      count: 0,
      firstAttempt: Timestamp.now(),
      lastAttempt: Timestamp.now(),
    });
  }
};