import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resend } from 'resend';
import { User, UserDocument } from '../users/schemas/user.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Picks the English or French version of a piece of text. */
type T = (en: string, fr: string) => string;

interface BaseTemplateParams {
  brandName: string;
  recipientName: string;
  frontendUrl: string;
  t: T;
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

/**
 * Every email is written in the recipient's app language: French when the account with
 * that address has its app in French (users.appLanguage), English otherwise, including
 * for addresses that aren't an account, like newsletter sign-ups.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @InjectModel(User.name) private readonly userModel?: Model<UserDocument>,
  ) { }

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

  /** The text picker for this recipient: French if their app is in French. */
  async translatorFor(recipientEmail: string): Promise<T> {
    let fr = false;
    try {
      const email = String(recipientEmail ?? '').trim().toLowerCase();
      if (email && this.userModel) {
        const user: any = await this.userModel.findOne({ email }).select('appLanguage').lean().exec();
        fr = user?.appLanguage === 'fr';
      }
    } catch (err: any) {
      this.logger.warn(`Language lookup failed for an email, sending in English: ${err?.message}`);
    }
    return (en, frText) => (fr ? frText : en);
  }

  private baseParams(t: T): BaseTemplateParams {
    return {
      brandName: this.brandName,
      recipientName: '',  // overridden per call
      frontendUrl: this.frontendUrl,
      t,
    };
  }

  private signoff(t: T): string {
    return t(`— The ${this.brandName} Team`, `— L'équipe ${this.brandName}`);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async sendWelcomeEmail(recipientEmail: string, recipientName?: string): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Welcome to ${this.brandName}!`, `Bienvenue sur ${this.brandName} !`),
      text: t(
        `Hi ${displayName},\n\nWelcome to ${this.brandName}! Your account has been created successfully.\n\nGet started here: ${this.frontendUrl}\n\nIf you have any questions, just reply to this email.\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nBienvenue sur ${this.brandName} ! Votre compte a bien été créé.\n\nCommencez ici : ${this.frontendUrl}\n\nPour toute question, répondez simplement à cet e-mail.\n\n${this.signoff(t)}`,
      ),
      html: this.buildWelcomeTemplate({ ...this.baseParams(t), recipientName: displayName }),
    });
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    recipientName: string,
    resetToken: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${resetToken}`;
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Reset Your ${this.brandName} Password`, `Réinitialisez votre mot de passe ${this.brandName}`),
      text: t(
        `Hi ${displayName},\n\nWe received a request to reset your password.\n\nReset link: ${resetUrl}\n\nReset token: ${resetToken}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nNous avons reçu une demande de réinitialisation de votre mot de passe.\n\nLien : ${resetUrl}\n\nCode : ${resetToken}\n\nCe lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\n${this.signoff(t)}`,
      ),
      html: this.buildPasswordResetTemplate({ ...this.baseParams(t), recipientName: displayName, resetUrl, resetToken }),
    });
  }

  async sendPasswordResetConfirmation(
    recipientEmail: string,
    recipientName: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Your ${this.brandName} Password Has Been Reset`, `Votre mot de passe ${this.brandName} a été réinitialisé`),
      text: t(
        `Hi ${displayName},\n\nYour ${this.brandName} password has been successfully reset.\n\nIf you did not make this change, contact support immediately.\n\nSign in: ${this.frontendUrl}/auth/signin\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nVotre mot de passe ${this.brandName} a bien été réinitialisé.\n\nSi vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.\n\nConnexion : ${this.frontendUrl}/auth/signin\n\n${this.signoff(t)}`,
      ),
      html: this.buildPasswordResetConfirmationTemplate({ ...this.baseParams(t), recipientName: displayName }),
    });
  }

  async sendEmailVerification(
    recipientEmail: string,
    recipientName: string,
    verificationToken: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    const verificationUrl = `${this.apiUrl}/api/v1/auth/verify-email?token=${verificationToken}`;
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Verify your email address — ${this.brandName}`, `Confirmez votre adresse e-mail — ${this.brandName}`),
      text: t(
        `Hi ${displayName},\n\nVerify your email: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, ignore this email.\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nConfirmez votre adresse e-mail : ${verificationUrl}\n\nCe lien expire dans 24 heures.\n\nSi vous n'avez pas créé de compte, ignorez cet e-mail.\n\n${this.signoff(t)}`,
      ),
      html: this.buildVerificationTemplate({ ...this.baseParams(t), recipientName: displayName, verificationUrl }),
    });
  }

  async sendOnboardingWelcome(
    recipientEmail: string,
    recipientName: string,
    onboardingUrl: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Complete Your ${this.brandName} Profile — Let's Get Started!`, `Complétez votre profil ${this.brandName} — c'est parti !`),
      text: t(
        `Hi ${displayName},\n\nWelcome to ${this.brandName}! Complete your profile here: ${onboardingUrl}\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nBienvenue sur ${this.brandName} ! Complétez votre profil ici : ${onboardingUrl}\n\n${this.signoff(t)}`,
      ),
      html: this.buildOnboardingWelcomeTemplate({ ...this.baseParams(t), recipientName: displayName, onboardingUrl }),
    });
  }

  async sendOnboardingComplete(
    recipientEmail: string,
    recipientName: string,
    userRole: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Welcome to ${this.brandName} — You're All Set!`, `Bienvenue sur ${this.brandName} — tout est prêt !`),
      text: t(
        `Hi ${displayName},\n\nYour ${this.brandName} profile is complete. Get started: ${this.frontendUrl}\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nVotre profil ${this.brandName} est complet. Commencez ici : ${this.frontendUrl}\n\n${this.signoff(t)}`,
      ),
      html: this.buildOnboardingCompleteTemplate({ ...this.baseParams(t), recipientName: displayName, userRole }),
    });
  }

  async sendSavedSearchNotification(
    recipientEmail: string,
    recipientName: string,
    searchName: string,
    newProperties: any[],
    searchId: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    const count = newProperties.length;
    const searchUrl = `${this.frontendUrl}/saved-searches/${searchId}`;
    const manageSearchesUrl = `${this.frontendUrl}/saved-searches`;
    const one = count === 1;

    const propertyList = newProperties
      .map((p, i) =>
        `${i + 1}. ${p.title}\n   ${p.type} - ${p.listingType}\n   ${p.city}, ${p.state}\n   ${t('Price', 'Prix')}: ${p.currency || 'XAF'} ${p.price.toLocaleString(t('en-US', 'fr-FR'))}\n   ${t('View', 'Voir')}: ${this.frontendUrl}/properties/${p._id}`,
      )
      .join('\n\n');

    await this.safeSendMail({
      to: recipientEmail,
      subject: t(
        `${count} New ${one ? 'Property' : 'Properties'} Match Your "${searchName}" Search`,
        `${count} ${one ? 'nouveau logement correspond' : 'nouveaux logements correspondent'} à votre recherche « ${searchName} »`,
      ),
      text: t(
        `Hi ${displayName},\n\nWe found ${count} new ${one ? 'property' : 'properties'} matching "${searchName}"!\n\n${propertyList}\n\nView all: ${searchUrl}\nManage searches: ${manageSearchesUrl}\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nNous avons trouvé ${count} ${one ? 'nouveau logement' : 'nouveaux logements'} pour « ${searchName} » !\n\n${propertyList}\n\nTout voir : ${searchUrl}\nGérer mes recherches : ${manageSearchesUrl}\n\n${this.signoff(t)}`,
      ),
      html: this.buildSavedSearchNotificationTemplate({
        ...this.baseParams(t),
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
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(
        `Your listing "${propertyTitle}" has been removed — ${this.brandName}`,
        `Votre annonce « ${propertyTitle} » a été retirée — ${this.brandName}`,
      ),
      text: t(
        `Hi ${displayName},\n\nYour listing "${propertyTitle}" has been removed following a community guidelines review.\n\nTo appeal, contact: ${this.supportEmail}\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\nVotre annonce « ${propertyTitle} » a été retirée après un examen au regard de nos règles communautaires.\n\nPour contester, écrivez à : ${this.supportEmail}\n\n${this.signoff(t)}`,
      ),
      html: this.buildPropertyRemovedTemplate({
        ...this.baseParams(t),
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
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    const isFinal = severity === 'final_warning';
    await this.safeSendMail({
      to: recipientEmail,
      subject: isFinal
        ? t(`Final Warning: Action required on your ${this.brandName} listing`, `Dernier avertissement : action requise sur votre annonce ${this.brandName}`)
        : t(`Warning regarding your ${this.brandName} listing`, `Avertissement concernant votre annonce ${this.brandName}`),
      text: t(
        `Hi ${displayName},\n\n${isFinal ? 'Final warning' : 'Warning'} regarding "${propertyTitle}".\n\n${warningMessage}\n\nContact support: ${this.supportEmail}\n\n${this.signoff(t)}`,
        `${this.hi(t, displayName)}\n\n${isFinal ? 'Dernier avertissement' : 'Avertissement'} concernant « ${propertyTitle} ».\n\n${warningMessage}\n\nContacter le support : ${this.supportEmail}\n\n${this.signoff(t)}`,
      ),
      html: this.buildPropertyWarningTemplate({
        ...this.baseParams(t),
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
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Booking confirmed — ${params.propertyTitle}`, `Réservation confirmée — ${params.propertyTitle}`),
      text: t(
        `Booking confirmed for ${params.propertyTitle}. Check-in: ${params.checkIn}, Check-out: ${params.checkOut}. Total: ${params.currency} ${params.totalAmount}.`,
        `Réservation confirmée pour ${params.propertyTitle}. Arrivée : ${params.checkIn}, départ : ${params.checkOut}. Total : ${params.currency} ${params.totalAmount}.`,
      ),
      html: this.buildBookingConfirmationTemplate({ displayName, t, ...params }),
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
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`Complete your payment — ${params.propertyTitle}`, `Finalisez votre paiement — ${params.propertyTitle}`),
      text: t(
        `Complete your payment of ${params.currency} ${params.totalAmount} for ${params.propertyTitle}. Pay here: ${params.paymentLink}`,
        `Finalisez votre paiement de ${params.currency} ${params.totalAmount} pour ${params.propertyTitle}. Payer ici : ${params.paymentLink}`,
      ),
      html: this.buildPaymentRequestTemplate({ displayName, t, ...params }),
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
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    await this.safeSendMail({
      to: recipientEmail,
      subject: t(`New booking request — ${params.propertyTitle}`, `Nouvelle demande de réservation — ${params.propertyTitle}`),
      text: t(
        `${params.guestName} requested to book ${params.propertyTitle} from ${params.checkIn} to ${params.checkOut}.`,
        `${params.guestName} souhaite réserver ${params.propertyTitle} du ${params.checkIn} au ${params.checkOut}.`,
      ),
      html: this.buildHostNewBookingTemplate({ displayName, t, ...params }),
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

  /** The greeting name; without one, "Hi there" / "Bonjour". */
  private display(name: string | undefined, t: T): string {
    return name?.trim() || t('there', '');
  }

  /** "Hi Ana," / "Bonjour Ana," — and "Bonjour," with no name. */
  private hi(t: T, name: string): string {
    return t(`Hi ${name},`, name ? `Bonjour ${name},` : 'Bonjour,');
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  private buildWelcomeTemplate(p: BaseTemplateParams): string {
    const { t } = p;
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">${t(`Welcome, ${p.recipientName}!`, p.recipientName ? `Bienvenue, ${p.recipientName} !` : 'Bienvenue !')}</h2>
      <p style="line-height:1.6;">${t(`We're excited to have you on board. Your ${p.brandName} account is ready.`, `Nous sommes ravis de vous compter parmi nous. Votre compte ${p.brandName} est prêt.`)}</p>
      <p style="line-height:1.6;">${t('Start exploring properties, saving favourites, and managing your listings.', 'Explorez les logements, enregistrez vos favoris et gérez vos annonces.')}</p>
      <div style="margin-top:24px;">${this.btn(p.frontendUrl, t('Get Started', 'Commencer'))}</div>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">${t('If you have any questions, just reply to this email.', 'Pour toute question, répondez simplement à cet e-mail.')}</p>
      <p style="margin-top:8px;">${this.signoff(t)}</p>
    `);
  }

  private buildPasswordResetTemplate(p: PasswordResetTemplateParams): string {
    const { t } = p;
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">${t('Reset Your Password', 'Réinitialisez votre mot de passe')}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`We received a request to reset your ${p.brandName} password. Click below to create a new one.`, `Nous avons reçu une demande de réinitialisation de votre mot de passe ${p.brandName}. Cliquez ci-dessous pour en créer un nouveau.`)}</p>
      <div style="margin-top:24px;">${this.btn(p.resetUrl, t('Reset Password', 'Réinitialiser le mot de passe'))}</div>
      <p style="line-height:1.6;margin-top:16px;font-size:14px;color:#475569;">${t('This link expires in <strong>1 hour</strong>.', 'Ce lien expire dans <strong>1 heure</strong>.')}</p>
      <p style="line-height:1.6;font-size:14px;color:#475569;">${t("If the button doesn't work, copy and paste this link:", 'Si le bouton ne fonctionne pas, copiez et collez ce lien :')}</p>
      <p style="font-size:14px;color:#2563eb;word-break:break-all;">${p.resetUrl}</p>
      <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">${t('Mobile App Reset Token', "Code de réinitialisation pour l'application")}</p>
        <p style="margin:0;font-family:monospace;font-size:13px;color:#0f172a;word-break:break-all;">${p.resetToken}</p>
      </div>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
        <p style="font-size:14px;color:#475569;margin:0;">${t("<strong>Didn't request this?</strong> You can safely ignore this email.", "<strong>Vous n'avez rien demandé ?</strong> Vous pouvez ignorer cet e-mail.")}</p>
      </div>
      <p style="margin-top:24px;">${this.signoff(t)}</p>
    `, `<p style="margin:0;">${t('This link can only be used once and expires in 1 hour.', "Ce lien n'est utilisable qu'une fois et expire dans 1 heure.")}</p>`);
  }

  private buildPasswordResetConfirmationTemplate(p: BaseTemplateParams): string {
    const { t } = p;
    const loginUrl = `${p.frontendUrl}/auth/signin`;
    return this.layout(p.brandName, `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#10b981;color:#fff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:32px;">✓</div>
      </div>
      <h2 style="margin-top:0;text-align:center;">${t('Password Successfully Reset', 'Mot de passe réinitialisé')}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`Your ${p.brandName} password has been successfully reset. You can now sign in with your new password.`, `Votre mot de passe ${p.brandName} a bien été réinitialisé. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.`)}</p>
      <div style="margin-top:24px;text-align:center;">${this.btn(loginUrl, t('Sign In Now', 'Se connecter'))}</div>
      <div style="margin-top:32px;padding:16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">${t('<strong>Security alert:</strong> If you did not make this change, contact support immediately.', "<strong>Alerte de sécurité :</strong> si vous n'êtes pas à l'origine de ce changement, contactez immédiatement le support.")}</p>
      </div>
      <p style="margin-top:24px;">${this.signoff(t)}</p>
    `);
  }

  private buildVerificationTemplate(p: VerificationTemplateParams): string {
    const { t } = p;
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">${t('Verify your email address', 'Confirmez votre adresse e-mail')}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`Please verify your email address to secure your ${p.brandName} account.`, `Confirmez votre adresse e-mail pour sécuriser votre compte ${p.brandName}.`)}</p>
      <div style="margin-top:24px;">${this.btn(p.verificationUrl, t('Verify Email Address', "Confirmer l'adresse e-mail"))}</div>
      <p style="line-height:1.6;margin-top:16px;font-size:14px;color:#475569;">${t('This link expires in <strong>24 hours</strong>.', 'Ce lien expire dans <strong>24 heures</strong>.')}</p>
      <p style="font-size:14px;color:#475569;">${t("If the button doesn't work, copy and paste this link:", 'Si le bouton ne fonctionne pas, copiez et collez ce lien :')}</p>
      <p style="font-size:14px;color:#2563eb;word-break:break-all;">${p.verificationUrl}</p>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">${t("If you didn't create an account, you can safely ignore this email.", "Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.")}</p>
      <p style="margin-top:8px;">${this.signoff(t)}</p>
    `);
  }

  private buildOnboardingWelcomeTemplate(p: OnboardingWelcomeTemplateParams): string {
    const { t } = p;
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">${t('Complete Your Profile Setup', 'Complétez votre profil')}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`Welcome to ${p.brandName}! To get the most out of the platform, please complete your profile — it only takes a few minutes.`, `Bienvenue sur ${p.brandName} ! Pour profiter pleinement de la plateforme, complétez votre profil : cela ne prend que quelques minutes.`)}</p>
      <div style="margin-top:24px;">${this.btn(p.onboardingUrl, t('Complete Profile Setup', 'Compléter mon profil'), '#10b981')}</div>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">${t('This will help us personalise your experience and show you the best matching properties.', 'Cela nous aide à personnaliser votre expérience et à vous montrer les logements qui vous correspondent le mieux.')}</p>
      <p style="margin-top:8px;">${this.signoff(t)}</p>
    `);
  }

  private buildOnboardingCompleteTemplate(p: OnboardingCompleteTemplateParams): string {
    const { t } = p;
    return this.layout(p.brandName, `
      <h2 style="margin-top:0;">${t("You're All Set!", 'Tout est prêt !')}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`Your ${p.brandName} profile is complete. As a <strong>${p.userRole}</strong>, you can now:`, `Votre profil ${p.brandName} est complet. En tant que <strong>${p.userRole}</strong>, vous pouvez maintenant :`)}</p>
      <ul style="line-height:1.6;padding-left:20px;">
        <li>${t('Browse and search properties', 'Parcourir et rechercher des logements')}</li>
        <li>${t('Save favourites and get notifications', 'Enregistrer vos favoris et recevoir des notifications')}</li>
        <li>${t('Contact agents and schedule viewings', 'Contacter des agents et planifier des visites')}</li>
        <li>${t('Manage your preferences', 'Gérer vos préférences')}</li>
      </ul>
      <div style="margin-top:24px;">${this.btn(p.frontendUrl, t('Start Exploring', 'Commencer à explorer'), '#10b981')}</div>
      <p style="line-height:1.6;margin-top:24px;color:#475569;">${t('Our support team is here if you need anything.', 'Notre équipe support est là si vous avez besoin de quoi que ce soit.')}</p>
      <p style="margin-top:8px;">${this.signoff(t)}</p>
    `);
  }

  private buildSavedSearchNotificationTemplate(p: SavedSearchTemplateParams): string {
    const { t } = p;
    const count = p.newProperties.length;
    const one = count === 1;
    const propertiesHtml = p.newProperties.map((prop) => `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;background:#f8fafc;">
        <h3 style="margin:0 0 8px;font-size:16px;">
          <a href="${p.frontendUrl}/properties/${prop._id}" style="color:#2563eb;text-decoration:none;">${prop.title}</a>
        </h3>
        <p style="margin:4px 0;font-size:14px;color:#64748b;"><strong>${prop.type}</strong> · ${prop.listingType}</p>
        <p style="margin:4px 0;font-size:14px;color:#64748b;">📍 ${prop.city}${prop.state ? ', ' + prop.state : ''}</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:600;color:#10b981;">${prop.currency || 'XAF'} ${prop.price.toLocaleString(t('en-US', 'fr-FR'))}</p>
        ${prop.amenities?.bedrooms || prop.amenities?.bathrooms ? `
          <p style="margin:8px 0 0;font-size:14px;color:#64748b;">
            ${prop.amenities.bedrooms ? `🛏 ${prop.amenities.bedrooms} ${t('bed', prop.amenities.bedrooms > 1 ? 'chambres' : 'chambre')}` : ''}
            ${prop.amenities.bathrooms ? `🚿 ${prop.amenities.bathrooms} ${t('bath', prop.amenities.bathrooms > 1 ? 'salles de bain' : 'salle de bain')}` : ''}
          </p>` : ''}
      </div>`).join('');

    return this.layout(p.brandName, `
      <h2 style="margin-top:0;text-align:center;">${t(`${count} New ${one ? 'Property' : 'Properties'} Found!`, `${count} ${one ? 'nouveau logement trouvé' : 'nouveaux logements trouvés'} !`)}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`We found ${count} new ${one ? 'property' : 'properties'} matching your saved search "<strong>${p.searchName}</strong>".`, `Nous avons trouvé ${count} ${one ? 'nouveau logement' : 'nouveaux logements'} pour votre recherche enregistrée « <strong>${p.searchName}</strong> ».`)}</p>
      <div style="margin:24px 0;">${propertiesHtml}</div>
      <div style="text-align:center;">${this.btn(p.searchUrl, t('View All Matches', 'Voir tous les résultats'))}</div>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
        <p style="font-size:14px;color:#475569;margin:0;">${t('You can adjust or delete this search at any time.', 'Vous pouvez modifier ou supprimer cette recherche à tout moment.')}</p>
        <p style="margin:8px 0 0;"><a href="${p.manageSearchesUrl}" style="color:#2563eb;font-size:14px;">${t('Manage Saved Searches →', 'Gérer mes recherches →')}</a></p>
      </div>
      <p style="margin-top:24px;">${this.signoff(t)}</p>
    `, `
      <p style="margin:0;">${t(`You're receiving this because you saved a search on ${p.brandName}.`, `Vous recevez cet e-mail car vous avez enregistré une recherche sur ${p.brandName}.`)}</p>
      <p style="margin:8px 0 0;"><a href="${p.manageSearchesUrl}" style="color:#64748b;">${t('Update preferences', 'Modifier mes préférences')}</a></p>
    `);
  }

  private buildPropertyRemovedTemplate(p: PropertyRemovedTemplateParams): string {
    const { t } = p;
    return this.layout(p.brandName, `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background:#ef4444;color:#fff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">✕</div>
      </div>
      <h2 style="margin-top:0;text-align:center;color:#dc2626;">${t('Listing Removed', 'Annonce retirée')}</h2>
      <p style="line-height:1.6;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">${t(`Your listing <strong>"${p.propertyTitle}"</strong> has been permanently removed following a community guidelines review.`, `Votre annonce <strong>« ${p.propertyTitle} »</strong> a été définitivement retirée après un examen au regard de nos règles communautaires.`)}</p>
      <div style="margin:24px 0;padding:16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">${t('If you believe this was a mistake, please contact our support team.', "Si vous pensez qu'il s'agit d'une erreur, contactez notre équipe support.")}</p>
      </div>
      <div style="margin-top:24px;text-align:center;">${this.btn(`mailto:${p.supportEmail}`, t('Contact Support', 'Contacter le support'), '#0f172a')}</div>
      <p style="margin-top:24px;">${this.signoff(t)}</p>
    `);
  }

  private buildPropertyWarningTemplate(p: PropertyWarningTemplateParams): string {
    const { t } = p;
    const bg = p.isFinal ? '#fef2f2' : '#fffbeb';
    const border = p.isFinal ? '#ef4444' : '#f59e0b';

    return this.layout(p.brandName, `
      <p style="line-height:1.6;margin:0 0 16px;">${this.hi(t, p.recipientName)}</p>
      <p style="line-height:1.6;">
        ${p.isFinal
        ? t('This is a <strong>final warning</strong> regarding', 'Ceci est un <strong>dernier avertissement</strong> concernant')
        : t('We are issuing a <strong>warning</strong> regarding', 'Nous vous adressons un <strong>avertissement</strong> concernant')}
        ${t(`your listing <strong>"${p.propertyTitle}"</strong>.`, `votre annonce <strong>« ${p.propertyTitle} »</strong>.`)}
      </p>
      <div style="margin:20px 0;padding:16px;background:${bg};border-left:4px solid ${border};border-radius:4px;">
        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${p.warningMessage}</p>
      </div>
      <p style="font-size:14px;color:#475569;line-height:1.6;">
        ${p.isFinal
        ? t('Please take <strong>immediate action</strong>. Continued non-compliance may result in permanent removal of your listing.', 'Merci d\'agir <strong>immédiatement</strong>. Sans mise en conformité, votre annonce pourra être définitivement retirée.')
        : t('Please review your listing and make the necessary updates to comply with our community guidelines.', 'Vérifiez votre annonce et apportez les modifications nécessaires pour respecter nos règles communautaires.')}
      </p>
      <div style="margin-top:24px;">
        ${this.btn(`${p.frontendUrl}/dashboard/properties`, t('Review My Listings', 'Voir mes annonces'))}
        <a href="mailto:${p.supportEmail}" style="display:inline-block;background:#f1f5f9;color:#0f172a;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-left:8px;">${t('Contact Support', 'Contacter le support')}</a>
      </div>
      <p style="margin-top:24px;">${t(`— The ${p.brandName} Trust &amp; Safety Team`, `— L'équipe Confiance et sécurité ${p.brandName}`)}</p>
    `, `<p style="margin:0;">${t(`This message was sent because a report was filed against one of your listings on ${p.brandName}.`, `Ce message vous est envoyé suite à un signalement concernant l'une de vos annonces sur ${p.brandName}.`)}</p>`,
    );
  }

  private buildBookingConfirmationTemplate(p: {
    displayName: string; t: T; propertyTitle: string; checkIn: string;
    checkOut: string; nights: number; totalAmount: number; currency: string; bookingId: string;
  }): string {
    const { t } = p;
    return this.layout(this.brandName, `
      <h2 style="color:#10b981;">${t('Your booking is confirmed!', 'Votre réservation est confirmée !')}</h2>
      <p>${this.hi(t, p.displayName)}</p>
      <p>${t(`Your stay at <strong>${p.propertyTitle}</strong> is confirmed.`, `Votre séjour à <strong>${p.propertyTitle}</strong> est confirmé.`)}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">${t('Check-in', 'Arrivée')}</td><td style="padding:10px;font-weight:600;">${p.checkIn}</td></tr>
        <tr><td style="padding:10px;font-size:14px;">${t('Check-out', 'Départ')}</td><td style="padding:10px;font-weight:600;">${p.checkOut}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">${t('Nights', 'Nuits')}</td><td style="padding:10px;font-weight:600;">${p.nights}</td></tr>
        <tr><td style="padding:10px;font-size:14px;">${t('Total paid', 'Total payé')}</td><td style="padding:10px;font-weight:600;color:#10b981;">${p.currency} ${p.totalAmount.toLocaleString(t('en-US', 'fr-FR'))}</td></tr>
      </table>
      ${this.btn(`${this.frontendUrl}/bookings/${p.bookingId}`, t('View Booking', 'Voir la réservation'))}
      <p style="margin-top:24px;">${this.signoff(t)}</p>
    `);
  }

  private buildPaymentRequestTemplate(p: {
    displayName: string; t: T; propertyTitle: string; checkIn: string; checkOut: string;
    totalAmount: number; currency: string; paymentLink: string; expiresInHours: number;
  }): string {
    const { t } = p;
    return this.layout(this.brandName, `
      <h2>${t('Complete your booking payment', 'Finalisez le paiement de votre réservation')}</h2>
      <p>${this.hi(t, p.displayName)}</p>
      <p>${t(`Your booking for <strong>${p.propertyTitle}</strong> (${p.checkIn} → ${p.checkOut}) is pending payment.`, `Votre réservation pour <strong>${p.propertyTitle}</strong> (${p.checkIn} → ${p.checkOut}) attend votre paiement.`)}</p>
      <p style="font-size:22px;font-weight:700;color:#0f172a;">${p.currency} ${p.totalAmount.toLocaleString(t('en-US', 'fr-FR'))}</p>
      <p style="color:#ef4444;font-size:14px;">${t(`This link expires in ${p.expiresInHours} hours.`, `Ce lien expire dans ${p.expiresInHours} heures.`)}</p>
      ${this.btn(p.paymentLink, t('Pay Now', 'Payer maintenant'), '#10b981')}
      <p style="margin-top:24px;font-size:13px;color:#64748b;">${t('If you did not make this booking, ignore this email.', "Si vous n'avez pas fait cette réservation, ignorez cet e-mail.")}</p>
    `);
  }

  private buildHostNewBookingTemplate(p: {
    displayName: string; t: T; propertyTitle: string; guestName: string;
    checkIn: string; checkOut: string; totalAmount: number; currency: string; bookingId: string;
  }): string {
    const { t } = p;
    return this.layout(this.brandName, `
      <h2>${t('New booking request', 'Nouvelle demande de réservation')}</h2>
      <p>${this.hi(t, p.displayName)}</p>
      <p>${t(`<strong>${p.guestName}</strong> has requested to book <strong>${p.propertyTitle}</strong>.`, `<strong>${p.guestName}</strong> souhaite réserver <strong>${p.propertyTitle}</strong>.`)}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">${t('Check-in', 'Arrivée')}</td><td style="padding:10px;font-weight:600;">${p.checkIn}</td></tr>
        <tr><td style="padding:10px;font-size:14px;">${t('Check-out', 'Départ')}</td><td style="padding:10px;font-weight:600;">${p.checkOut}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">${t('Amount', 'Montant')}</td><td style="padding:10px;font-weight:600;color:#10b981;">${p.currency} ${p.totalAmount.toLocaleString(t('en-US', 'fr-FR'))}</td></tr>
      </table>
      ${this.btn(`${this.frontendUrl}/hosting/bookings/${p.bookingId}`, t('Review Request', 'Voir la demande'))}
    `);
  }

  async sendNewsletterWelcome(recipientEmail: string): Promise<void> {
  const t = await this.translatorFor(recipientEmail);
  await this.safeSendMail({
    to: recipientEmail,
    subject: t(`Welcome to the ${this.brandName} Newsletter!`, `Bienvenue dans la newsletter ${this.brandName} !`),
    text: t(
      `Thanks for subscribing! You'll now receive the latest property listings and exclusive deals from ${this.brandName}.`,
      `Merci de votre inscription ! Vous recevrez désormais les dernières annonces et les offres exclusives de ${this.brandName}.`,
    ),
    html: this.layout(this.brandName, `
      <h2 style="margin-top:0;">${t("You're on the list! 🎉", 'Vous êtes inscrit ! 🎉')}</h2>
      <p style="line-height:1.6;">${t(`Thanks for subscribing to the <strong>${this.brandName}</strong> newsletter.`, `Merci de vous être inscrit à la newsletter <strong>${this.brandName}</strong>.`)}</p>
      <p style="line-height:1.6;">${t("You'll be the first to hear about:", 'Vous serez le premier informé de :')}</p>
      <ul style="line-height:1.8;padding-left:20px;">
        <li>${t('New property listings across Africa', 'Nouveaux logements partout en Afrique')}</li>
        <li>${t('Exclusive deals and price drops', 'Offres exclusives et baisses de prix')}</li>
        <li>${t('Market insights and real estate tips', 'Tendances du marché et conseils immobiliers')}</li>
      </ul>
      <div style="margin-top:24px;">${this.btn(this.frontendUrl, t('Browse Properties', 'Voir les logements'))}</div>
      <p style="margin-top:24px;font-size:13px;color:#64748b;">
        ${t('You can unsubscribe at any time by clicking', 'Vous pouvez vous désinscrire à tout moment en cliquant')}
        <a href="${this.frontendUrl}/unsubscribe?email=${recipientEmail}" style="color:#2563eb;">${t('here', 'ici')}</a>.
      </p>
      <p style="margin-top:8px;">${this.signoff(t)}</p>
    `),
  });
}

  // ─── Admin Notification Email ───────────────────────────────────────────────

  /** A message an admin wrote: their title and text stay as written, around them is translated. */
  async sendAdminNotificationEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    message: string,
    link?: string,
  ): Promise<void> {
    const t = await this.translatorFor(recipientEmail);
    const displayName = this.display(recipientName, t);
    const ctaHtml = link
      ? `<div style="margin-top:24px;">${this.btn(`${this.frontendUrl}${link}`, t('View Details', 'Voir les détails'))}</div>`
      : '';

    await this.safeSendMail({
      to: recipientEmail,
      subject: `${title} — ${this.brandName}`,
      text: `${this.hi(t, displayName)}\n\n${message}\n\n${link ? `${t('View more', 'En savoir plus')}: ${this.frontendUrl}${link}` : ''}\n\n${this.signoff(t)}`,
      html: this.buildAdminNotificationTemplate({
        ...this.baseParams(t),
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
      <p style="line-height:1.6;">${this.hi(p.t, p.recipientName)}</p>
      <p style="line-height:1.6;white-space:pre-wrap;">${p.message}</p>
      ${p.ctaHtml}
      <p style="margin-top:24px;">${this.signoff(p.t)}</p>
    `);
  }
}
