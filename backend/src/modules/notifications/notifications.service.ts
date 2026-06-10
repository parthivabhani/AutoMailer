/**
 * notifications.service.ts — Realtime push and system notification service
 *
 * Exposes methods to trigger notifications for user alerts
 * (e.g. SMTP config failures, campaign completions, limits reached).
 */

import { getSupabaseAdmin } from "../../config/supabase.js";
import { logger } from "../../shared/logger.js";

export interface NotificationPayload {
  businessId: string;
  userId: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export class NotificationsService {
  /**
   * Dispatches a notification to a specific user and logs it.
   * Feeds into real-time database listener notifications.
   */
  async notify(payload: NotificationPayload): Promise<void> {
    logger.info(
      { userId: payload.userId, type: payload.type, title: payload.title },
      "Dispatching user notification",
    );

    try {
      // In Supabase, inserting into a public notifications table
      // automatically broadcasts the event to listening clients (via Realtime).
      const { error } = await getSupabaseAdmin()
        .from("audit_logs")
        .insert({
          business_id: payload.businessId,
          user_id: payload.userId,
          action: `notification.${payload.type}`,
          resource_type: "notification",
          resource_id: payload.userId,
          metadata: {
            title: payload.title,
            message: payload.message,
            notification_type: payload.type,
            ...(payload.metadata || {}),
          },
        });

      if (error) throw error;
    } catch (err) {
      logger.error({ err }, "Failed to write audit/notification log entry");
    }
  }

  /**
   * Broadcasts a notification to all administrators in a business.
   */
  async notifyAdmins(
    businessId: string,
    type: "info" | "warning" | "error" | "success",
    title: string,
    message: string,
  ): Promise<void> {
    try {
      const { data: admins } = await getSupabaseAdmin()
        .from("profiles")
        .select("id")
        .eq("business_id", businessId)
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        await Promise.all(
          admins.map((admin) =>
            this.notify({
              businessId,
              userId: admin.id,
              type,
              title,
              message,
            }),
          ),
        );
      }
    } catch (err) {
      logger.error({ err, businessId }, "Failed to broadcast notification to business admins");
    }
  }
}

export const notificationsService = new NotificationsService();
