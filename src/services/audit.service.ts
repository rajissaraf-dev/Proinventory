// services/audit.service.ts
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  DocumentData,
  QueryDocumentSnapshot,
  FirestoreError,
} from "firebase/firestore";
import db from "./firebase";
// ✅ Removed unused import: getSecureToken

export type AuditAction = 
  | 'login' | 'logout' | 'register'
  | 'create' | 'update' | 'delete'
  | 'view' | 'export' | 'import'
  | 'transfer' | 'sale' | 'purchase'
  | 'adjust_stock'
  | 'change_role' | 'change_status'
  | 'permission_change'
  | 'settings_change'
  | 'failed_login' | 'failed_attempt'
  | 'suspicious_activity';

// ✅ Define specific types for audit details instead of using any
export type AuditDetails = Record<string, unknown>;

export interface AuditLog {
  id?: string; // ✅ Made optional for creation
  userId: string;
  userEmail: string;
  userRole: string;
  companyId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details: AuditDetails; // ✅ Changed from any to unknown
  ipAddress?: string;
  userAgent: string;
  timestamp: Date;
  status: 'success' | 'failure' | 'warning';
}

// ✅ Helper function to safely convert Firestore document to AuditLog
function documentToAuditLog(doc: QueryDocumentSnapshot<DocumentData, DocumentData>): AuditLog {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId ?? 'unknown',
    userEmail: data.userEmail ?? 'unknown',
    userRole: data.userRole ?? 'unknown',
    companyId: data.companyId,
    action: data.action ?? 'view',
    resourceType: data.resourceType ?? 'unknown',
    resourceId: data.resourceId,
    details: data.details ?? {},
    ipAddress: data.ipAddress,
    userAgent: data.userAgent ?? 'unknown',
    timestamp: data.timestamp?.toDate?.() ?? new Date(),
    status: data.status ?? 'success',
  };
}

export const AuditService = {
  async log(data: Omit<AuditLog, 'timestamp' | 'userAgent' | 'id'>): Promise<void> {
    try {
      const companyId = data.companyId || 'system';
      
      await addDoc(collection(db, "companies", companyId, "auditLogs"), {
        ...data,
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      const errorMessage = error instanceof FirestoreError 
        ? error.message 
        : 'Unknown error occurred';
      console.error('Failed to log audit:', errorMessage);
      // Don't throw - audit logging should not break the app
    }
  },

  async getLogs(companyId: string, limitCount: number = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, "companies", companyId, "auditLogs"),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(documentToAuditLog);
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  },

  async getLogsByUser(companyId: string, userId: string, limitCount: number = 50): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, "companies", companyId, "auditLogs"),
        where("userId", "==", userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(documentToAuditLog);
    } catch (error) {
      console.error('Failed to get logs by user:', error);
      return [];
    }
  },

  async getSuspiciousActivity(companyId: string, hours: number = 24): Promise<AuditLog[]> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const q = query(
        collection(db, "companies", companyId, "auditLogs"),
        where("status", "in", ['failure', 'warning']),
        where("timestamp", ">=", cutoffTime),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(documentToAuditLog);
    } catch (error) {
      console.error('Failed to get suspicious activity:', error);
      return [];
    }
  },

  // ✅ New helper method to get recent logs by action type
  async getLogsByAction(companyId: string, action: AuditAction, limitCount: number = 50): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, "companies", companyId, "auditLogs"),
        where("action", "==", action),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(documentToAuditLog);
    } catch (error) {
      console.error('Failed to get logs by action:', error);
      return [];
    }
  },

  // ✅ New helper method to get logs within a date range
  async getLogsByDateRange(
    companyId: string, 
    startDate: Date, 
    endDate: Date, 
    limitCount: number = 100
  ): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, "companies", companyId, "auditLogs"),
        where("timestamp", ">=", startDate),
        where("timestamp", "<=", endDate),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(documentToAuditLog);
    } catch (error) {
      console.error('Failed to get logs by date range:', error);
      return [];
    }
  },

  // ✅ Helper to get audit statistics
  async getAuditStats(companyId: string, hours: number = 24): Promise<{
    total: number;
    byStatus: Record<AuditLog['status'], number>;
    byAction: Record<AuditAction, number>;
    suspicious: number;
  }> {
    try {
      const logs = await this.getLogs(companyId, 1000);
      const recentLogs = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return Date.now() - logTime < hours * 60 * 60 * 1000;
      });

      const stats = {
        total: recentLogs.length,
        byStatus: {
          success: 0,
          failure: 0,
          warning: 0,
        },
        byAction: {} as Record<AuditAction, number>,
        suspicious: 0,
      };

      recentLogs.forEach(log => {
        stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
        if (log.status === 'failure' || log.status === 'warning') {
          stats.suspicious++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return {
        total: 0,
        byStatus: { success: 0, failure: 0, warning: 0 },
        byAction: {} as Record<AuditAction, number>,
        suspicious: 0,
      };
    }
  }
};