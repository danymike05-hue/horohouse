import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface BaseTemplateParams {
  brandName: string;
  recipientName: string;
  frontendUrl: string;
}

interface PasswordResetTemplateParams extends BaseTemplateParams {
  resetUrl: string;
  resetToken: string;
}

interface SavedSearchTemplateParams extends BaseTemplateParams {
  searchName: string;
  newProperties: any[];
  searchUrl: string;
  manageSearchesUrl: string;
}

interface VerificationTemplateParams extends BaseTemplateParams {
  verificationUrl: string;
}

interface OnboardingCompleteTemplateParams extends BaseTemplateParams {
  userRole: string;
}

interface OnboardingWelcomeTemplateParams extends BaseTemplateParams {
  onboardingUrl: string;
}

interface PropertyRemovedTemplateParams extends BaseTemplateParams {
  propertyTitle: string;
  supportEmail: string;
}

interface PropertyWarningTemplateParams extends BaseTemplateParams {
  propertyTitle: string;
  warningMessage: string;
  isFinal: boolean;
  supportEmail: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) { }

  // ─── Config helpers ──────────────────────────────────────────────────────────

  private get brandName(): string {
    return this.configService.get<string>('BRAND_NAME', 'HoroHouse');
  }

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'https://horohouse.com');
  }

  private get apiUrl(): string {
    return this.configService.get<string>('API_URL', 'https://backend-horohouse-production-c006.up.railway.app');
  }

  private get supportEmail(): string {
    return this.configService.get<string>('SUPPORT_EMAIL', 'support@horohouse.com');
  }

  private baseParams(): BaseTemplateParams {
    return {
      brandName: this.brandName,
      recipientName: '',  // overridden per call
      frontendUrl: this.frontendUrl,
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async sendWelcomeEmail(recipientEmail: string, recipientName?: string): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Welcome to ${this.brandName}!`,
      text: `Hi ${displayName},\n\nWelcome to ${this.brandName}! Your account has been created successfully.\n\nGet started here: ${this.frontendUrl}\n\nIf you have any questions, just reply to this email.\n\n— The ${this.brandName} Team`,
      html: this.buildWelcomeTemplate({ ...this.baseParams(), recipientName: displayName }),
    });
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    recipientName: string,
    resetToken: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${resetToken}`;
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Reset Your ${this.brandName} Password`,
      text: `Hi ${displayName},\n\nWe received a request to reset your password.\n\nReset link: ${resetUrl}\n\nReset token: ${resetToken}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— The ${this.brandName} Team`,
      html: this.buildPasswordResetTemplate({ ...this.baseParams(), recipientName: displayName, resetUrl, resetToken }),
    });
  }

  async sendPasswordResetConfirmation(
    recipientEmail: string,
    recipientName: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Your ${this.brandName} Password Has Been Reset`,
      text: `Hi ${displayName},\n\nYour ${this.brandName} password has been successfully reset.\n\nIf you did not make this change, contact support immediately.\n\nSign in: ${this.frontendUrl}/auth/signin\n\n— The ${this.brandName} Team`,
      html: this.buildPasswordResetConfirmationTemplate({ ...this.baseParams(), recipientName: displayName }),
    });
  }

  async sendEmailVerification(
    recipientEmail: string,
    recipientName: string,
    verificationToken: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    const verificationUrl = `${this.apiUrl}/api/v1/auth/verify-email?token=${verificationToken}`;
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Verify your email address — ${this.brandName}`,
      text: `Hi ${displayName},\n\nVerify your email: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, ignore this email.\n\n— The ${this.brandName} Team`,
      html: this.buildVerificationTemplate({ ...this.baseParams(), recipientName: displayName, verificationUrl }),
    });
  }

  async sendOnboardingWelcome(
    recipientEmail: string,
    recipientName: string,
    onboardingUrl: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Complete Your ${this.brandName} Profile — Let's Get Started!`,
      text: `Hi ${displayName},\n\nWelcome to ${this.brandName}! Complete your profile here: ${onboardingUrl}\n\n— The ${this.brandName} Team`,
      html: this.buildOnboardingWelcomeTemplate({ ...this.baseParams(), recipientName: displayName, onboardingUrl }),
    });
  }

  async sendOnboardingComplete(
    recipientEmail: string,
    recipientName: string,
    userRole: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Welcome to ${this.brandName} — You're All Set!`,
      text: `Hi ${displayName},\n\nYour ${this.brandName} profile is complete. Get started: ${this.frontendUrl}\n\n— The ${this.brandName} Team`,
      html: this.buildOnboardingCompleteTemplate({ ...this.baseParams(), recipientName: displayName, userRole }),
    });
  }

  async sendSavedSearchNotification(
    recipientEmail: string,
    recipientName: string,
    searchName: string,
    newProperties: any[],
    searchId: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    const count = newProperties.length;
    const searchUrl = `${this.frontendUrl}/saved-searches/${searchId}`;
    const manageSearchesUrl = `${this.frontendUrl}/saved-searches`;

    const propertyList = newProperties
      .map((p, i) =>
        `${i + 1}. ${p.title}\n   ${p.type} - ${p.listingType}\n   ${p.city}, ${p.state}\n   Price: ${p.currency || 'XAF'} ${p.price.toLocaleString()}\n   View: ${this.frontendUrl}/properties/${p._id}`,
      )
      .join('\n\n');

    await this.safeSendMail({
      to: recipientEmail,
      subject: `${count} New ${count === 1 ? 'Property' : 'Properties'} Match Your "${searchName}" Search`,
      text: `Hi ${displayName},\n\nWe found ${count} new ${count === 1 ? 'property' : 'properties'} matching "${searchName}"!\n\n${propertyList}\n\nView all: ${searchUrl}\nManage searches: ${manageSearchesUrl}\n\n— The ${this.brandName} Team`,
      html: this.buildSavedSearchNotificationTemplate({
        ...this.baseParams(),
        recipientName: displayName,
        searchName,
        newProperties,
        searchUrl,
        manageSearchesUrl,
      }),
    });
  }

  async sendPropertyRemovedEmail(
    recipientEmail: string,
    recipientName: string,
    propertyTitle: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Your listing "${propertyTitle}" has been removed — ${this.brandName}`,
      text: `Hi ${displayName},\n\nYour listing "${propertyTitle}" has been removed following a community guidelines review.\n\nTo appeal, contact: ${this.supportEmail}\n\n— The ${this.brandName} Team`,
      html: this.buildPropertyRemovedTemplate({
        ...this.baseParams(),
        recipientName: displayName,
        propertyTitle,
        supportEmail: this.supportEmail,
      }),
    });
  }

  async sendPropertyWarningEmail(
    recipientEmail: string,
    recipientName: string,
    propertyTitle: string,
    warningMessage: string,
    severity: 'warning' | 'final_warning',
  ): Promise<void> {
    const displayName = this.display(recipientName);
    const isFinal = severity === 'final_warning';
    await this.safeSendMail({
      to: recipientEmail,
      subject: isFinal
        ? `Final Warning: Action required on your ${this.brandName} listing`
        : `Warning regarding your ${this.brandName} listing`,
      text: `Hi ${displayName},\n\n${isFinal ? 'Final warning' : 'Warning'} regarding "${propertyTitle}".\n\n${warningMessage}\n\nContact support: ${this.supportEmail}\n\n— The ${this.brandName} Team`,
      html: this.buildPropertyWarningTemplate({
        ...this.baseParams(),
        recipientName: displayName,
        propertyTitle,
        warningMessage,
        isFinal,
        supportEmail: this.supportEmail,
      }),
    });
  }

  async sendBookingConfirmationEmail(
    recipientEmail: string,
    recipientName: string,
    params: {
      propertyTitle: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      totalAmount: number;
      currency: string;
      bookingId: string;
    },
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Booking confirmed — ${params.propertyTitle}`,
      text: `Booking confirmed for ${params.propertyTitle}. Check-in: ${params.checkIn}, Check-out: ${params.checkOut}. Total: ${params.currency} ${params.totalAmount}.`,
      html: this.buildBookingConfirmationTemplate({ displayName, ...params }),
    });
  }

  async sendPaymentRequestEmail(
    recipientEmail: string,
    recipientName: string,
    params: {
      propertyTitle: string;
      checkIn: string;
      checkOut: string;
      totalAmount: number;
      currency: string;
      paymentLink: string;
      expiresInHours: number;
    },
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `Complete your payment — ${params.propertyTitle}`,
      text: `Complete your payment of ${params.currency} ${params.totalAmount} for ${params.propertyTitle}. Pay here: ${params.paymentLink}`,
      html: this.buildPaymentRequestTemplate({ displayName, ...params }),
    });
  }

  async sendHostNewBookingEmail(
    recipientEmail: string,
    recipientName: string,
    params: {
      propertyTitle: string;
      guestName: string;
      checkIn: string;
      checkOut: string;
      totalAmount: number;
      currency: string;
      bookingId: string;
    },
  ): Promise<void> {
    const displayName = this.display(recipientName);
    await this.safeSendMail({
      to: recipientEmail,
      subject: `New booking request — ${params.propertyTitle}`,
      text: `${params.guestName} requested to book ${params.propertyTitle} from ${params.checkIn} to ${params.checkOut}.`,
      html: this.buildHostNewBookingTemplate({ displayName, ...params }),
    });
  }

// ─── Transport ───────────────────────────────────────────────────────────────

private getResendClient(): Resend {
  const apiKey = this.configService.get<string>('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(apiKey);
}

private async safeSendMail(options: SendMailOptions): Promise<void> {
  this.logger.log(`Sending email to: ${options.to} | Subject: ${options.subject}`);
  try {
    const resend = this.getResendClient();
    const from = this.configService.get<string>('FROM_EMAIL', 'HoroHouse <onboarding@resend.dev>');
    
    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      this.logger.error(`❌ Resend error: ${error.message}`);
      return;
    }

    this.logger.log(`✅ Email sent: ${data?.id}`);
  } catch (error) {
    this.logger.error(`❌ Failed to send email: ${(error as Error).message}`, (error as Error).stack);
  }
}

  // ─── Shared layout ───────────────────────────────────────────────────────────

  private layout(brandName: string, body: string, footer = ''): string {
    return `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f9fc;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:24px;background:#0f172a;color:#fff;">
        <h1 style="margin:0;font-size:20px;">${brandName}</h1>
      </td>
    </tr>
    <tr><td style="padding:24px;color:#0f172a;">${body}</td></tr>
    ${footer ? `<tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">${footer}</td></tr>` : ''}
  </table>
</div>`;
  }

  private btn(href: string, label: string, color = '#2563eb'): string {
    return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">${label}</a>`;
  }

  private display(name?: string): string {
    return name?.trim() || 'there';
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  private buildWelcomeTemplate(p: BaseTemplateParams): string {
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">Welcome, ${p.recipientName}!</h2>
      <p style="line-height:1.6;">We're excited to have you on board. Your ${p.brandName} account is ready.</p>
      <p style="line-height:1.6;">Start exploring properties, saving favourites, and managing your listings.</p>
      <div style="margin-top:24px;">${this.btn(p.frontendUrl, 'Get Started')}</div>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">If you have any questions, just reply to this email.</p>
      <p style="margin-top:8px;">— The ${p.brandName} Team</p>
    `);
  }

  private buildPasswordResetTemplate(p: PasswordResetTemplateParams): string {
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">Reset Your Password</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">We received a request to reset your ${p.brandName} password. Click below to create a new one.</p>
      <div style="margin-top:24px;">${this.btn(p.resetUrl, 'Reset Password')}</div>
      <p style="line-height:1.6;margin-top:16px;font-size:14px;color:#475569;">This link expires in <strong>1 hour</strong>.</p>
      <p style="line-height:1.6;font-size:14px;color:#475569;">If the button doesn't work, copy and paste this link:</p>
      <p style="font-size:14px;color:#2563eb;word-break:break-all;">${p.resetUrl}</p>
      <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Mobile App Reset Token</p>
        <p style="margin:0;font-family:monospace;font-size:13px;color:#0f172a;word-break:break-all;">${p.resetToken}</p>
      </div>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
        <p style="font-size:14px;color:#475569;margin:0;"><strong>Didn't request this?</strong> You can safely ignore this email.</p>
      </div>
      <p style="margin-top:24px;">— The ${p.brandName} Team</p>
    `, `<p style="margin:0;">This link can only be used once and expires in 1 hour.</p>`);
  }

  private buildPasswordResetConfirmationTemplate(p: BaseTemplateParams): string {
    const loginUrl = `${p.frontendUrl}/auth/signin`;
    return this.layout(p.brandName, `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#10b981;color:#fff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:32px;">✓</div>
      </div>
      <h2 style="margin-top:0;text-align:center;">Password Successfully Reset</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">Your ${p.brandName} password has been successfully reset. You can now sign in with your new password.</p>
      <div style="margin-top:24px;text-align:center;">${this.btn(loginUrl, 'Sign In Now')}</div>
      <div style="margin-top:32px;padding:16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;"><strong>Security alert:</strong> If you did not make this change, contact support immediately.</p>
      </div>
      <p style="margin-top:24px;">— The ${p.brandName} Team</p>
    `);
  }

  private buildVerificationTemplate(p: VerificationTemplateParams): string {
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">Verify your email address</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">Please verify your email address to secure your ${p.brandName} account.</p>
      <div style="margin-top:24px;">${this.btn(p.verificationUrl, 'Verify Email Address')}</div>
      <p style="line-height:1.6;margin-top:16px;font-size:14px;color:#475569;">This link expires in <strong>24 hours</strong>.</p>
      <p style="font-size:14px;color:#475569;">If the button doesn't work, copy and paste this link:</p>
      <p style="font-size:14px;color:#2563eb;word-break:break-all;">${p.verificationUrl}</p>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">If you didn't create an account, you can safely ignore this email.</p>
      <p style="margin-top:8px;">— The ${p.brandName} Team</p>
    `);
  }

  private buildOnboardingWelcomeTemplate(p: OnboardingWelcomeTemplateParams): string {
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">Complete Your Profile Setup</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">Welcome to ${p.brandName}! To get the most out of the platform, please complete your profile — it only takes a few minutes.</p>
      <div style="margin-top:24px;">${this.btn(p.onboardingUrl, 'Complete Profile Setup', '#10b981')}</div>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">This will help us personalise your experience and show you the best matching properties.</p>
      <p style="margin-top:8px;">— The ${p.brandName} Team</p>
    `);
  }

  private buildOnboardingCompleteTemplate(p: OnboardingCompleteTemplateParams): string {
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">You're All Set!</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">Your ${p.brandName} profile is complete. As a <strong>${p.userRole}</strong>, you can now:</p>
      <ul style="line-height:1.6;padding-left:20px;">
        <li>Browse and search properties</li>
        <li>Save favourites and get notifications</li>
        <li>Contact agents and schedule viewings</li>
        <li>Manage your preferences</li>
      </ul>
      <div style="margin-top:24px;">${this.btn(p.frontendUrl, 'Start Exploring', '#10b981')}</div>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">Our support team is here if you need anything.</p>
      <p style="margin-top:8px;">— The ${p.brandName} Team</p>
    `);
  }

  private buildSavedSearchNotificationTemplate(p: SavedSearchTemplateParams): string {
    const count = p.newProperties.length;
    const propertiesHtml = p.newProperties.map((prop) => `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;background:#f8fafc;">
        <h3 style="margin:0 0 8px;font-size:16px;">
          <a href="${p.frontendUrl}/properties/${prop._id}" style="color:#2563eb;text-decoration:none;">${prop.title}</a>
        </h3>
        <p style="margin:4px 0;font-size:14px;color:#64748b;"><strong>${prop.type}</strong> · ${prop.listingType}</p>
        <p style="margin:4px 0;font-size:14px;color:#64748b;">📍 ${prop.city}${prop.state ? ', ' + prop.state : ''}</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:600;color:#10b981;">${prop.currency || 'XAF'} ${prop.price.toLocaleString()}</p>
        ${prop.amenities?.bedrooms || prop.amenities?.bathrooms ? `
          <p style="margin:8px 0 0;font-size:14px;color:#64748b;">
            ${prop.amenities.bedrooms ? `🛏 ${prop.amenities.bedrooms} bed` : ''}
            ${prop.amenities.bathrooms ? `🚿 ${prop.amenities.bathrooms} bath` : ''}
          </p>` : ''}
      </div>`).join('');

    return this.layout(p.brandName, `
      <h2 style="margin-top:0;text-align:center;">${count} New ${count === 1 ? 'Property' : 'Properties'} Found!</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">We found ${count} new ${count === 1 ? 'property' : 'properties'} matching your saved search "<strong>${p.searchName}</strong>".</p>
      <div style="margin:24px 0;">${propertiesHtml}</div>
      <div style="text-align:center;">${this.btn(p.searchUrl, 'View All Matches')}</div>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
        <p style="font-size:14px;color:#475569;margin:0;">You can adjust or delete this search at any time.</p>
        <p style="margin:8px 0 0;"><a href="${p.manageSearchesUrl}" style="color:#2563eb;font-size:14px;">Manage Saved Searches →</a></p>
      </div>
      <p style="margin-top:24px;">— The ${p.brandName} Team</p>
    `, `
      <p style="margin:0;">You're receiving this because you saved a search on ${p.brandName}.</p>
      <p style="margin:8px 0 0;"><a href="${p.manageSearchesUrl}" style="color:#64748b;">Update preferences</a></p>
    `);
  }

  private buildPropertyRemovedTemplate(p: PropertyRemovedTemplateParams): string {
    return this.layout(p.brandName, `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background:#ef4444;color:#fff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">✕</div>
      </div>
      <h2 style="margin-top:0;text-align:center;color:#dc2626;">Listing Removed</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">Your listing <strong>"${p.propertyTitle}"</strong> has been permanently removed following a community guidelines review.</p>
      <div style="margin:24px 0;padding:16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">If you believe this was a mistake, please contact our support team.</p>
      </div>
      <div style="margin-top:24px;text-align:center;">${this.btn(`mailto:${p.supportEmail}`, 'Contact Support', '#0f172a')}</div>
      <p style="margin-top:24px;">— The ${p.brandName} Team</p>
    `);
  }

  private buildPropertyWarningTemplate(p: PropertyWarningTemplateParams): string {
    const accent = p.isFinal ? '#dc2626' : '#d97706';
    const bg = p.isFinal ? '#fef2f2' : '#fffbeb';
    const border = p.isFinal ? '#ef4444' : '#f59e0b';
    const label = p.isFinal ? 'Final Warning' : 'Warning';

    return this.layout(p.brandName, `
      <p style="line-height:1.6;margin:0 0 16px;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;">
        ${p.isFinal ? 'This is a <strong>final warning</strong> regarding' : 'We are issuing a <strong>warning</strong> regarding'}
        your listing <strong>"${p.propertyTitle}"</strong>.
      </p>
      <div style="margin:20px 0;padding:16px;background:${bg};border-left:4px solid ${border};border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${p.warningMessage}</p>
      </div>
      <p style="font-size:14px;color:#475569;line-height:1.6;">
        ${p.isFinal
        ? 'Please take <strong>immediate action</strong>. Continued non-compliance may result in permanent removal of your listing.'
        : 'Please review your listing and make the necessary updates to comply with our community guidelines.'}
      </p>
      <div style="margin-top:24px;">
        ${this.btn(`${p.frontendUrl}/dashboard/properties`, 'Review My Listings')}
        <a href="mailto:${p.supportEmail}" style="display:inline-block;background:#f1f5f9;color:#0f172a;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-left:8px;">Contact Support</a>
      </div>
      <p style="margin-top:24px;">— The ${p.brandName} Trust &amp; Safety Team</p>
    `, `<p style="margin:0;">This message was sent because a report was filed against one of your listings on ${p.brandName}.</p>`,
      // severity banner injected via wrapper override below
    );
  }

  private buildBookingConfirmationTemplate(p: {
    displayName: string; propertyTitle: string; checkIn: string;
    checkOut: string; nights: number; totalAmount: number; currency: string; bookingId: string;
  }): string {
    return this.layout(this.brandName, `
      <h2 style="color:#10b981;">Your booking is confirmed!</h2>
      <p>Hi ${p.displayName},</p>
      <p>Your stay at <strong>${p.propertyTitle}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Check-in</td><td style="padding:10px;font-weight:600;">${p.checkIn}</td></tr>
        <tr><td style="padding:10px;font-size:14px;">Check-out</td><td style="padding:10px;font-weight:600;">${p.checkOut}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Nights</td><td style="padding:10px;font-weight:600;">${p.nights}</td></tr>
        <tr><td style="padding:10px;font-size:14px;">Total paid</td><td style="padding:10px;font-weight:600;color:#10b981;">${p.currency} ${p.totalAmount.toLocaleString()}</td></tr>
      </table>
      ${this.btn(`${this.frontendUrl}/bookings/${p.bookingId}`, 'View Booking')}
      <p style="margin-top:24px;">— The ${this.brandName} Team</p>
    `);
  }

  private buildPaymentRequestTemplate(p: {
    displayName: string; propertyTitle: string; checkIn: string; checkOut: string;
    totalAmount: number; currency: string; paymentLink: string; expiresInHours: number;
  }): string {
    return this.layout(this.brandName, `
      <h2>Complete your booking payment</h2>
      <p>Hi ${p.displayName},</p>
      <p>Your booking for <strong>${p.propertyTitle}</strong> (${p.checkIn} → ${p.checkOut}) is pending payment.</p>
      <p style="font-size:22px;font-weight:700;color:#0f172a;">${p.currency} ${p.totalAmount.toLocaleString()}</p>
      <p style="color:#ef4444;font-size:14px;">This link expires in ${p.expiresInHours} hours.</p>
      ${this.btn(p.paymentLink, 'Pay Now', '#10b981')}
      <p style="margin-top:24px;font-size:13px;color:#64748b;">If you did not make this booking, ignore this email.</p>
    `);
  }

  private buildHostNewBookingTemplate(p: {
    displayName: string; propertyTitle: string; guestName: string;
    checkIn: string; checkOut: string; totalAmount: number; currency: string; bookingId: string;
  }): string {
    return this.layout(this.brandName, `
      <h2>New booking request</h2>
      <p>Hi ${p.displayName},</p>
      <p><strong>${p.guestName}</strong> has requested to book <strong>${p.propertyTitle}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Check-in</td><td style="padding:10px;font-weight:600;">${p.checkIn}</td></tr>
        <tr><td style="padding:10px;font-size:14px;">Check-out</td><td style="padding:10px;font-weight:600;">${p.checkOut}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Amount</td><td style="padding:10px;font-weight:600;color:#10b981;">${p.currency} ${p.totalAmount.toLocaleString()}</td></tr>
      </table>
      ${this.btn(`${this.frontendUrl}/hosting/bookings/${p.bookingId}`, 'Review Request')}
    `);
  }

  async sendNewsletterWelcome(recipientEmail: string): Promise<void> {
  await this.safeSendMail({
    to: recipientEmail,
    subject: `Welcome to the ${this.brandName} Newsletter!`,
    text: `Thanks for subscribing! You'll now receive the latest property listings and exclusive deals from ${this.brandName}.`,
    html: this.layout(this.brandName, `
      <h2 style="margin-top:0;">You're on the list! 🎉</h2>
      <p style="line-height:1.6;">Thanks for subscribing to the <strong>${this.brandName}</strong> newsletter.</p>
      <p style="line-height:1.6;">You'll be the first to hear about:</p>
      <ul style="line-height:1.8;padding-left:20px;">
        <li>New property listings across Africa</li>
        <li>Exclusive deals and price drops</li>
        <li>Market insights and real estate tips</li>
      </ul>
      <div style="margin-top:24px;">${this.btn(this.frontendUrl, 'Browse Properties')}</div>
      <p style="margin-top:24px;font-size:13px;color:#64748b;">
        You can unsubscribe at any time by clicking 
        <a href="${this.frontendUrl}/unsubscribe?email=${recipientEmail}" style="color:#2563eb;">here</a>.
      </p>
      <p style="margin-top:8px;">— The ${this.brandName} Team</p>
    `),
  });
}

  // ─── Admin Notification Email ───────────────────────────────────────────────

  async sendAdminNotificationEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    const displayName = this.display(recipientName);
    const ctaHtml = link
      ? `<div style="margin-top:24px;">${this.btn(`${this.frontendUrl}${link}`, 'View Details')}</div>`
      : '';

    await this.safeSendMail({
      to: recipientEmail,
      subject: `${title} — ${this.brandName}`,
      text: `Hi ${displayName},\n\n${message}\n\n${link ? `View more: ${this.frontendUrl}${link}` : ''}\n\n— The ${this.brandName} Team`,
      html: this.buildAdminNotificationTemplate({
        ...this.baseParams(),
        recipientName: displayName,
        title,
        message,
        ctaHtml,
      }),
    });
  }

  private buildAdminNotificationTemplate(p: BaseTemplateParams & {
    title: string;
    message: string;
    ctaHtml: string;
  }): string {
    return this.layout(p.brandName, `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background:#155dfc;color:#fff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:24px;">📢</div>
      </div>
      <h2 style="margin-top:0;text-align:center;">${p.title}</h2>
      <p style="line-height:1.6;">Hi ${p.recipientName},</p>
      <p style="line-height:1.6;white-space:pre-wrap;">${p.message}</p>
      ${p.ctaHtml}
      <p style="margin-top:24px;">— The ${p.brandName} Team</p>
    `);
  }
}