import {
  collection, doc, setDoc, getDocs,
  query, where, orderBy, limit,
  updateDoc, deleteDoc, getDoc,
  serverTimestamp, QueryDocumentSnapshot,
  getCountFromServer, startAfter,
} from "firebase/firestore";
import db from "./firebase";

export interface Notification {
  id: string;
  type: 'transfer_request' | 'transfer_completed' | 'transfer_cancelled' | 'stock_alert' | 'system';
  title: string;
  message: string;
  transferId?: string;
  transferNumber?: string;
  fromWarehouse?: string;
  toWarehouse?: string;
  items?: any[];
  totalItems?: number;
  notes?: string;
  status: 'unread' | 'read';
  createdAt: any;
  createdBy: string;
  readAt: any | null;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  totalCount: number;
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export const NotificationService = {
  /**
   * Create a new notification
   */
  async create(companyId: string, data: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
    try {
      const ref = doc(collection(db, "companies", companyId, "notifications"));
      const notification = {
        ...data,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, notification);
      return ref.id;
    } catch (error) {
      console.error("[NotificationService] Failed to create notification:", error);
      throw error;
    }
  },

  /**
   * Get all notifications for a company with pagination
   */
  async list(
    companyId: string,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot,
    statusFilter?: 'unread' | 'read' | 'all'
  ): Promise<PaginatedNotifications> {
    try {
      const ref = collection(db, "companies", companyId, "notifications");
      
      let q = query(
        ref,
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );

      if (statusFilter && statusFilter !== 'all') {
        q = query(q, where("status", "==", statusFilter));
      }

      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      let countQuery: any = ref;
      if (statusFilter && statusFilter !== 'all') {
        countQuery = query(ref, where("status", "==", statusFilter));
      }
      const countSnapshot = await getCountFromServer(countQuery);
      const totalCount = countSnapshot.data().count;

      const snap = await getDocs(q);
      const notifications = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Notification[];

      const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

      return {
        notifications,
        totalCount,
        lastVisible: lastDoc,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (error) {
      console.error("[NotificationService] Failed to list notifications:", error);
      // Return empty result instead of throwing
      return {
        notifications: [],
        totalCount: 0,
        lastVisible: null,
        hasMore: false,
      };
    }
  },

  /**
   * Get unread notifications count with error handling
   */
  async getUnreadCount(companyId: string): Promise<number> {
    try {
      console.log(`📝 [NotificationService] Getting unread count for company: ${companyId}`);
      const ref = collection(db, "companies", companyId, "notifications");
      const q = query(ref, where("status", "==", "unread"));
      const snap = await getCountFromServer(q);
      const count = snap.data().count;
      console.log(`📝 [NotificationService] Unread count: ${count}`);
      return count;
    } catch (error) {
      console.error("[NotificationService] Error getting unread count:", error);
      // Return 0 instead of throwing to prevent UI errors
      return 0;
    }
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(companyId: string, notificationId: string): Promise<void> {
    try {
      const ref = doc(db, "companies", companyId, "notifications", notificationId);
      await updateDoc(ref, {
        status: 'read',
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[NotificationService] Failed to mark notification as read:", error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(companyId: string): Promise<void> {
    try {
      const ref = collection(db, "companies", companyId, "notifications");
      const q = query(ref, where("status", "==", "unread"));
      const snap = await getDocs(q);
      
      const updates = snap.docs.map((doc) => 
        updateDoc(doc.ref, {
          status: 'read',
          readAt: serverTimestamp(),
        })
      );
      
      await Promise.all(updates);
    } catch (error) {
      console.error("[NotificationService] Failed to mark all notifications as read:", error);
      throw error;
    }
  },

  /**
   * Delete a notification
   */
  async delete(companyId: string, notificationId: string): Promise<void> {
    try {
      const ref = doc(db, "companies", companyId, "notifications", notificationId);
      await deleteDoc(ref);
    } catch (error) {
      console.error("[NotificationService] Failed to delete notification:", error);
      throw error;
    }
  },

  /**
   * Delete all notifications
   */
  async deleteAll(companyId: string): Promise<void> {
    try {
      const ref = collection(db, "companies", companyId, "notifications");
      const snap = await getDocs(ref);
      const deletions = snap.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletions);
    } catch (error) {
      console.error("[NotificationService] Failed to delete all notifications:", error);
      throw error;
    }
  },
};