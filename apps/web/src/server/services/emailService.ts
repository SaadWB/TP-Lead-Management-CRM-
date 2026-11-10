import { Resend } from 'resend';
import { config } from '../config';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (config.resendApiKey && config.resendApiKey.startsWith('re_') && !config.resendApiKey.includes('mock')) {
      try {
        this.resend = new Resend(config.resendApiKey);
      } catch (err) {
        console.warn('[EmailService] Failed to initialize Resend, falling back to simulated logger');
      }
    }
  }

  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string }> {
    const { to, subject, html, text } = params;

    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: config.emailFrom,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>?/gm, ''),
        });
        return { success: true, messageId: result.data?.id };
      } catch (error) {
        console.error('[EmailService] Resend send error:', error);
        return { success: false };
      }
    }

    // Development / fallback simulation
    console.log(`[EMAIL SIMULATION] To: ${Array.isArray(to) ? to.join(', ') : to} | Subject: "${subject}"`);
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  async sendAssignmentNotification(recipientEmail: string, userName: string, leadCompany: string, leadContact?: string | null, assignedBy?: string) {
    return this.sendEmail({
      to: recipientEmail,
      subject: `New Lead Assignment: ${leadCompany}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
          <h2 style="color: #0f172a; margin-top: 0;">New Lead Assigned to You</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>A new lead has been assigned to your queue by <strong>${assignedBy || 'Admin'}</strong>:</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px 0;"><strong>Company:</strong> ${leadCompany}</p>
            <p style="margin: 0;"><strong>Contact Person:</strong> ${leadContact || '-'}</p>
          </div>
          <p>Please log in to your CRM workspace to review company notes and plan your next contact activity.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b;">TenderProcure Lead Management System</p>
        </div>
      `,
    });
  }

  async sendFollowUpReminder(recipientEmail: string, userName: string, leadCompany: string, taskType: string, dueDate: string, dueTime?: string | null, isOverdue = false) {
    const title = isOverdue ? `OVERDUE Reminder: ${taskType} with ${leadCompany}` : `Upcoming ${taskType}: ${leadCompany}`;
    return this.sendEmail({
      to: recipientEmail,
      subject: title,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
          <h2 style="color: ${isOverdue ? '#dc2626' : '#0f172a'}; margin-top: 0;">${title}</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>${isOverdue ? 'This follow-up task is past its scheduled time:' : 'You have a scheduled follow-up coming up soon:'}</p>
          <div style="background-color: ${isOverdue ? '#fef2f2' : '#f8fafc'}; border-left: 4px solid ${isOverdue ? '#ef4444' : '#0284c7'}; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px 0;"><strong>Task Type:</strong> ${taskType}</p>
            <p style="margin: 0 0 8px 0;"><strong>Company:</strong> ${leadCompany}</p>
            <p style="margin: 0;"><strong>Due:</strong> ${dueDate} ${dueTime || ''}</p>
          </div>
          <p>Please log in to update the task outcome or reschedule as necessary.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b;">TenderProcure CRM Notifications</p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
