// services/session.service.ts
import { 
  collection,
  deleteDoc,
  doc, 
  getDoc,
  getDocs,
  query, 
  Timestamp, 
  where, 
  DocumentData,
  QueryDocumentSnapshot,
  setDoc,
} from "firebase/firestore";
import db from "./firebase";
// ✅ Removed unused import: getSecureToken

export interface Session {
  id: string;
  userId: string;
  deviceInfo: string;
  userAgent: string;
  ipAddress?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  active: boolean;
  lastActivity: Timestamp;
}

// ✅ Helper function to safely convert Firestore document to Session
function documentToSession(doc: QueryDocumentSnapshot<DocumentData, DocumentData>): Session {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId ?? '',
    deviceInfo: data.deviceInfo ?? 'Unknown Device',
    userAgent: data.userAgent ?? 'Unknown Browser',
    ipAddress: data.ipAddress,
    createdAt: data.createdAt ?? Timestamp.now(),
    expiresAt: data.expiresAt ?? Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    active: data.active ?? true,
    lastActivity: data.lastActivity ?? Timestamp.now(),
  };
}

export const SessionService = {
  async create(userId: string, deviceInfo: string, ipAddress?: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

    await setDoc(doc(db, "sessions", sessionId), {
      userId,
      deviceInfo,
      userAgent: navigator.userAgent,
      ipAddress: ipAddress || 'unknown',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      lastActivity: Timestamp.now(),
      active: true,
    });

    // Store session ID in secure storage
    sessionStorage.setItem('session_id', sessionId);
    return sessionId;
  },

  async validate(): Promise<boolean> {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) return false;

      const snap = await getDoc(doc(db, "sessions", sessionId));
      if (!snap.exists()) return false;
      
      const data = snap.data();
      if (!data.active) return false;
      
      const expiresAt = data.expiresAt?.toDate?.();
      if (!expiresAt || expiresAt < new Date()) {
        // Session expired, clean up
        await this.revokeCurrent();
        return false;
      }

      // ✅ Update last activity
      await setDoc(doc(db, "sessions", sessionId), {
        lastActivity: Timestamp.now()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  },

  async validateWithUser(userId: string): Promise<boolean> {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) return false;

      const snap = await getDoc(doc(db, "sessions", sessionId));
      if (!snap.exists()) return false;
      
      const data = snap.data();
      const expiresAt = data.expiresAt?.toDate?.();
      
      return data.active && 
             data.userId === userId && 
             expiresAt && 
             expiresAt > new Date();
    } catch (error) {
      console.error('Session validation with user error:', error);
      return false;
    }
  },

  async revokeAll(userId: string): Promise<void> {
    try {
      const q = query(collection(db, "sessions"), where("userId", "==", userId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch (error) {
      console.error('Failed to revoke all sessions:', error);
      throw error;
    }
  },

  async revokeCurrent(): Promise<void> {
    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (sessionId) {
        await deleteDoc(doc(db, "sessions", sessionId));
        sessionStorage.removeItem('session_id');
      }
    } catch (error) {
      console.error('Failed to revoke current session:', error);
      throw error;
    }
  },

  async getActiveSessions(userId: string): Promise<Session[]> {
    try {
      const q = query(
        collection(db, "sessions"), 
        where("userId", "==", userId),
        where("active", "==", true)
      );
      const snap = await getDocs(q);
      return snap.docs.map(documentToSession);
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  },

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    try {
      const q = query(
        collection(db, "sessions"), 
        where("userId", "==", userId),
        where("active", "==", true)
      );
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs
          .filter(d => d.id !== currentSessionId)
          .map(d => deleteDoc(d.ref))
      );
    } catch (error) {
      console.error('Failed to revoke other sessions:', error);
      throw error;
    }
  },

  // ✅ New helper: Get session by ID
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const snap = await getDoc(doc(db, "sessions", sessionId));
      if (!snap.exists()) return null;
      return documentToSession(snap as QueryDocumentSnapshot<DocumentData, DocumentData>);
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  },

  async deleteGuestData(uid: string): Promise<void> {
    try {
      const guestDocRef = doc(db, "guests", uid);
      const collectionsSnapshot = await getDocs(collection(guestDocRef, "sample"));
      if (!collectionsSnapshot.empty) {
        await Promise.all(collectionsSnapshot.docs.map((docSnapshot) => deleteDoc(docSnapshot.ref)));
      }
      console.log(`✅ [SessionService] cleaned guest data for uid=${uid}`);
    } catch (error) {
      console.error('Failed to delete guest data:', error);
      throw error;
    }
  },

  // ✅ New helper: Extend session expiration
  async extendSession(sessionId: string, hours: number = 24): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + hours);
      
      await setDoc(doc(db, "sessions", sessionId), {
        expiresAt: Timestamp.fromDate(expiresAt),
        lastActivity: Timestamp.now(),
      }, { merge: true });
    } catch (error) {
      console.error('Failed to extend session:', error);
      throw error;
    }
  },

  // ✅ New helper: Clean up expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const q = query(
        collection(db, "sessions"),
        where("active", "==", true)
      );
      const snap = await getDocs(q);
      
      let cleanedCount = 0;
      for (const docSnapshot of snap.docs) {
        const data = docSnapshot.data();
        const expiresAt = data.expiresAt?.toDate?.();
        if (!expiresAt || expiresAt < now) {
          await deleteDoc(docSnapshot.ref);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  },

  // ✅ New helper: Get session count for a user
  async getSessionCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "sessions"), 
        where("userId", "==", userId),
        where("active", "==", true)
      );
      const snap = await getDocs(q);
      return snap.size;
    } catch (error) {
      console.error('Failed to get session count:', error);
      return 0;
    }
  }
};