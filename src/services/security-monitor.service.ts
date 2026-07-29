// services/security-monitor.service.ts
import { AuditService, AuditLog } from "./audit.service";
import { SessionService } from "./session.service";

// ✅ Define specific types for alert details
export interface MultipleFailuresDetails {
  failureCount: number;
  timeWindow: string;
  actions: string[];
}

export interface UnusualHoursDetails {
  loginCount: number;
  hours: number[];
}

export interface SuspiciousLoginDetails {
  ipAddress?: string;
  location?: string;
  deviceInfo?: string;
  previousIp?: string;
}

export interface RapidActionsDetails {
  actionCount: number;
  timeWindow: string;
  actions: string[];
  resourceTypes: string[];
}

export interface IpChangeDetails {
  newIp: string;
  oldIp: string;
  timestamp: Date;
}

// ✅ Union type for all possible details
export type SecurityAlertDetails = 
  | MultipleFailuresDetails
  | UnusualHoursDetails
  | SuspiciousLoginDetails
  | RapidActionsDetails
  | IpChangeDetails
  | Record<string, unknown>;

// ✅ Security Alert with proper typing
export interface SecurityAlert {
  id: string;
  userId: string;
  userEmail: string;
  type: 'suspicious_login' | 'multiple_failures' | 'unusual_hours' | 'rapid_actions' | 'ip_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: SecurityAlertDetails;
  timestamp: Date;
  resolved: boolean;
  actionTaken?: string;
}

// ✅ Type guard functions for checking alert types
function isMultipleFailuresDetails(details: SecurityAlertDetails): details is MultipleFailuresDetails {
  return 'failureCount' in details && 'actions' in details;
}

function isUnusualHoursDetails(details: SecurityAlertDetails): details is UnusualHoursDetails {
  return 'loginCount' in details && 'hours' in details;
}

// ✅ Main service with proper typing
export const SecurityMonitorService = {
  async detectSuspiciousActivity(companyId: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    const hours = 24;
    
    // ✅ Get recent suspicious logs
    const suspiciousLogs = await AuditService.getSuspiciousActivity(companyId, hours);
    
    // ✅ Group by user with proper typing
    const userGroups = suspiciousLogs.reduce<Record<string, AuditLog[]>>((acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = [];
      }
      acc[log.userId].push(log);
      return acc;
    }, {});

    // ✅ Process each user's logs
    for (const [userId, logs] of Object.entries(userGroups)) {
      // ✅ Check for multiple failures
      const failures = logs.filter(log => log.status === 'failure');
      if (failures.length >= 5) {
        const details: MultipleFailuresDetails = {
          failureCount: failures.length,
          timeWindow: '24h',
          actions: failures.map(f => f.action),
        };
        
        alerts.push({
          id: `alert_${Date.now()}_${userId}`,
          userId,
          userEmail: logs[0]?.userEmail ?? 'unknown',
          type: 'multiple_failures',
          severity: 'high',
          details,
          timestamp: new Date(),
          resolved: false,
        });
      }

      // ✅ Check for unusual hours logins (2-5 AM)
      const unusualLogins = logs.filter(log => {
        const hour = new Date(log.timestamp).getHours();
        return log.action === 'login' && (hour >= 0 && hour < 6);
      });
      
      if (unusualLogins.length > 2) {
        const details: UnusualHoursDetails = {
          loginCount: unusualLogins.length,
          hours: unusualLogins.map(log => new Date(log.timestamp).getHours()),
        };
        
        alerts.push({
          id: `alert_${Date.now()}_${userId}`,
          userId,
          userEmail: logs[0]?.userEmail ?? 'unknown',
          type: 'unusual_hours',
          severity: 'medium',
          details,
          timestamp: new Date(),
          resolved: false,
        });
      }

      // ✅ Check for rapid actions (more than 10 actions in 5 minutes)
      const sortedLogs = [...logs].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      for (let i = 0; i < sortedLogs.length - 1; i++) {
        const startTime = new Date(sortedLogs[i].timestamp).getTime();
        const endTime = new Date(sortedLogs[i + 9]?.timestamp ?? sortedLogs[i].timestamp).getTime();
        
        if (endTime - startTime < 5 * 60 * 1000 && i + 9 < sortedLogs.length) {
          const rapidActions = sortedLogs.slice(i, i + 10);
          const details: RapidActionsDetails = {
            actionCount: rapidActions.length,
            timeWindow: '5 minutes',
            actions: rapidActions.map(log => log.action),
            resourceTypes: rapidActions.map(log => log.resourceType),
          };
          
          alerts.push({
            id: `alert_${Date.now()}_${userId}_rapid`,
            userId,
            userEmail: logs[0]?.userEmail ?? 'unknown',
            type: 'rapid_actions',
            severity: 'medium',
            details,
            timestamp: new Date(),
            resolved: false,
          });
          break; // Only one alert per user for rapid actions
        }
      }
    }

    return alerts;
  },

  async handleAlert(alert: SecurityAlert): Promise<void> {
    // ✅ Log the alert with proper details
    const alertDetails: Record<string, unknown> = {
      alertType: alert.type,
      severity: alert.severity,
    };

    // ✅ Safely copy details without using any
    if (isMultipleFailuresDetails(alert.details)) {
      alertDetails.failureCount = alert.details.failureCount;
      alertDetails.actions = alert.details.actions;
    } else if (isUnusualHoursDetails(alert.details)) {
      alertDetails.loginCount = alert.details.loginCount;
      alertDetails.hours = alert.details.hours;
    } else {
      // For other details, copy known properties safely
      alertDetails.details = alert.details;
    }

    console.warn(`⚠️ Security Alert [${alert.severity}]: ${alert.type}`, alert);
    
    // ✅ Log the alert with correct AuditAction type
    await AuditService.log({
      userId: alert.userId,
      userEmail: alert.userEmail,
      userRole: 'system',
      action: 'suspicious_activity', // ✅ This is a valid AuditAction
      resourceType: 'security',
      details: alertDetails,
      status: 'warning',
    });

    // ✅ Take action based on severity
    if (alert.severity === 'critical' || alert.severity === 'high') {
      try {
        // ✅ Revoke all sessions
        await SessionService.revokeAll(alert.userId);
        
        // ✅ Log the action taken - using existing AuditAction
        await AuditService.log({
          userId: alert.userId,
          userEmail: alert.userEmail,
          userRole: 'system',
          action: 'suspicious_activity', // ✅ Use existing action
          resourceType: 'security',
          details: {
            action: 'revoked_all_sessions',
            reason: 'Suspicious activity detected',
            alertType: alert.type,
            severity: alert.severity,
          },
          status: 'success',
        });
        
        // ✅ Additional actions could be added here
        // await UserService.lockAccount(alert.userId, 'Suspicious activity detected');
        // await NotificationService.sendAdminAlert(alert);
      } catch (error) {
        console.error('Failed to handle security alert:', error);
        
        // ✅ Log the error
        await AuditService.log({
          userId: alert.userId,
          userEmail: alert.userEmail,
          userRole: 'system',
          action: 'suspicious_activity', // ✅ Valid AuditAction
          resourceType: 'security',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            alertType: alert.type,
            actionFailed: 'revoke_sessions',
          },
          status: 'failure',
        });
      }
    }
  },

  // ✅ Helper method to get alert summary - fixed unused parameter
  async getAlertSummary(companyId: string): Promise<{
    total: number;
    bySeverity: Record<SecurityAlert['severity'], number>;
    byType: Record<SecurityAlert['type'], number>;
    unresolved: number;
  }> {
    const alerts = await this.detectSuspiciousActivity(companyId);
    
    const summary = {
      total: alerts.length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      byType: {
        suspicious_login: 0,
        multiple_failures: 0,
        unusual_hours: 0,
        rapid_actions: 0,
        ip_change: 0,
      },
      unresolved: alerts.filter(a => !a.resolved).length,
    };

    alerts.forEach(alert => {
      summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
      summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
    });

    return summary;
  },

  // ✅ Helper to resolve an alert
  async resolveAlert(alertId: string, actionTaken?: string): Promise<void> {
    console.log(`✅ Resolving alert ${alertId} with action: ${actionTaken ?? 'No action taken'}`);
    
    await AuditService.log({
      userId: 'system',
      userEmail: 'system@proinventory.com',
      userRole: 'system',
      action: 'suspicious_activity', // ✅ Using existing AuditAction
      resourceType: 'security',
      details: {
        action: 'resolved_alert',
        alertId,
        actionTaken: actionTaken ?? 'No action taken',
        resolved: true,
      },
      status: 'success',
    });
  }
};