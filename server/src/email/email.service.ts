import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

const API_BASE_URL = 'https://api.mail.hostinger.com';
const DEFAULT_FROM = 'Mythrion <noreply@mythrion.com>';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Gmail renders remote HTTPS images through its proxy but does NOT support
 * data: URIs in <img src> — a base64-inlined logo shows up as a broken image
 * with the alt text. Reference the publicly-served client asset (public/logo.png)
 * with an absolute HTTPS URL instead. FRONTEND_URL is the canonical production
 * frontend base the server already uses for redirects and CORS.
 */
const rawFrontendUrl = process.env.FRONTEND_URL ?? 'https://mythrion.com.br';
let frontendUrlEnd = rawFrontendUrl.length;
while (frontendUrlEnd > 0 && rawFrontendUrl[frontendUrlEnd - 1] === '/') frontendUrlEnd--;
const FRONTEND_URL = rawFrontendUrl.slice(0, frontendUrlEnd);
const EMAIL_LOGO_URL = `${FRONTEND_URL}/logo.png`;

/** Extract the display-name portion of a "Name <addr>" From string. */
function parseDisplayName(from: string | undefined): string {
  if (!from) return 'Mythrion';
  const match = /^([^<]*?)<[^>]+>/.exec(from);
  return match?.[1].trim() || 'Mythrion';
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly token: string | undefined;
  private readonly mailboxId: string | undefined;
  private readonly displayName: string;

  constructor(private readonly i18n: I18nService) {
    this.token = process.env.HOSTINGER_MAIL_API_TOKEN;
    this.mailboxId = process.env.HOSTINGER_MAILBOX_ID;
    this.displayName = parseDisplayName(process.env.EMAIL_FROM ?? DEFAULT_FROM);

    if (!this.token || !this.mailboxId) {
      this.logger.warn(
        'HOSTINGER_MAIL_API_TOKEN / HOSTINGER_MAILBOX_ID not set — email sending is disabled. Transactional emails will not be delivered.',
      );
    }
  }

  async sendInvitation(params: {
    to: string;
    campaignName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: Date;
  }) {
    await this.dispatch({
      to: params.to,
      subject: `${params.inviterName} invited you to ${params.campaignName}`,
      html: this.buildInviteTemplate(params),
      text: this.buildTextTemplate(params),
      label: 'Invitation email',
      devDetail: params.inviteUrl,
    });
  }

  async sendTwoFactorCode(params: {
    to: string
    code: string
    expiresInMinutes: number
  }) {
    await this.dispatch({
      to: params.to,
      subject: 'Mythrion — your verification code',
      html: this.buildTwoFactorHtmlTemplate(params),
      text: this.buildTwoFactorTextTemplate(params),
      label: '2FA code',
      devDetail: `code ${params.code}`,
    });
  }

  async sendEmailVerification(params: {
    to: string;
    verificationUrl: string;
    language: string;
  }) {
    const t = (key: string) =>
      this.i18n.t(`emails.${key}`, { lang: params.language });

    await this.dispatch({
      to: params.to,
      subject: t('verifyEmailSubject'),
      html: this.buildLocalizedHtml({
        title: t('verifyEmailTitle'),
        body: t('verifyEmailBody'),
        cta: t('verifyEmailCta'),
        url: params.verificationUrl,
        footer: t('verifyEmailFooter'),
      }),
      text: [
        t('verifyEmailBody'),
        '',
        params.verificationUrl,
        '',
        t('verifyEmailFooter'),
      ].join('\n'),
      label: 'Verification email',
      devDetail: params.verificationUrl,
    });
  }

  async sendPasswordReset(params: {
    to: string;
    resetUrl: string;
    language: string;
  }) {
    const t = (key: string) =>
      this.i18n.t(`emails.${key}`, { lang: params.language });

    await this.dispatch({
      to: params.to,
      subject: t('resetPasswordSubject'),
      html: this.buildLocalizedHtml({
        title: t('resetPasswordTitle'),
        body: t('resetPasswordBody'),
        cta: t('resetPasswordCta'),
        url: params.resetUrl,
        footer: t('resetPasswordFooter'),
      }),
      text: [
        t('resetPasswordBody'),
        '',
        params.resetUrl,
        '',
        t('resetPasswordFooter'),
      ].join('\n'),
      label: 'Password reset',
      devDetail: params.resetUrl,
    });
  }

  /**
   * Shared Hostinger send pipeline. When the Hostinger env vars are unset
   * (local development) it logs a [DEV] hint — including the code/URL — so
   * flows can be exercised without delivering mail. Failures rethrow so the
   * caller can surface the error (and roll back any dependent write).
   */
  private async dispatch(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    label: string;
    devDetail?: string;
  }) {
    if (!this.token || !this.mailboxId) {
      const detail = params.devDetail ? ` - ${params.devDetail}` : '';
      this.logger.log(
        `[DEV] ${params.label} would be sent to ${params.to}${detail}`,
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/mailboxes/${this.mailboxId}/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: [params.to],
            displayName: this.displayName,
            subject: params.subject,
            text: params.text,
            html: params.html,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        throw new Error(await this.describeError(response));
      }

      this.logger.log(`${params.label} sent to ${params.to}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send ${params.label} to ${params.to}: ${message}`,
      );
      throw err;
    }
  }

  /** Dark-theme action-email layout shared by verification and password-reset. */
  private buildLocalizedHtml(params: {
    title: string;
    body: string;
    cta: string;
    url: string;
    footer: string;
  }) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: #0d0a14; font-family: system-ui, sans-serif; }
        .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
        .card { background: linear-gradient(135deg, #15101f 0%, #1c1630 100%); border: 1px solid #2a2240; border-radius: 12px; padding: 32px; }
        .logo { text-align: center; margin-bottom: 24px; }
        h1 { color: #e8e2d9; font-size: 20px; margin: 0 0 8px; }
        .subtitle { color: #a098b0; font-size: 14px; margin: 0 0 24px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #c9a44b, #d4b35e); color: #0d0a14; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 24px 0; }
        .footer { color: #4a4060; font-size: 12px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <img src="${EMAIL_LOGO_URL}" alt="Mythrion" style="max-width: 200px; width: 100%; height: auto; display: inline-block;" />
          </div>
          <h1>${params.title}</h1>
          <p class="subtitle">${params.body}</p>
          <center><a href="${params.url}" class="btn">${params.cta}</a></center>
          <div class="footer">${params.footer}</div>
        </div>
      </div>
    </body>
    </html>`;
  }

  private buildTwoFactorTextTemplate(params: {
    code: string
    expiresInMinutes: number
  }) {
    return [
      'Your Mythrion verification code is:',
      '',
      params.code,
      '',
      `This code expires in ${params.expiresInMinutes} minutes.`,
      'If you didn\'t request this, you can safely ignore this email.',
    ].join('\n');
  }

  private buildTwoFactorHtmlTemplate(params: {
    code: string
    expiresInMinutes: number
  }) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: #0d0a14; font-family: system-ui, sans-serif; }
        .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
        .card { background: linear-gradient(135deg, #15101f 0%, #1c1630 100%); border: 1px solid #2a2240; border-radius: 12px; padding: 32px; }
        .logo { text-align: center; margin-bottom: 24px; }
        h1 { color: #e8e2d9; font-size: 20px; margin: 0 0 8px; }
        .subtitle { color: #a098b0; font-size: 14px; margin: 0 0 24px; }
        .code { color: #e8e2d9; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: ui-monospace, monospace; text-align: center; margin: 24px 0; }
        .hint { color: #a098b0; font-size: 14px; margin: 0; }
        .footer { color: #4a4060; font-size: 12px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <img src="${EMAIL_LOGO_URL}" alt="Mythrion" style="max-width: 200px; width: 100%; height: auto; display: inline-block;" />
          </div>
          <h1>Your verification code</h1>
          <p class="subtitle">Use this code to complete your sign-in to Mythrion.</p>
          <div class="code">${params.code}</div>
          <p class="hint">This code expires in ${params.expiresInMinutes} minutes.</p>
          <div class="footer">If you didn't request this, you can safely ignore this email.</div>
        </div>
      </div>
    </body>
    </html>`;
  }

  /** Read the API error envelope ({ error, code }) and fall back to the status. */
  private async describeError(response: Response): Promise<string> {
    let body: { error?: string; code?: string } | null = null;
    try {
      body = (await response.json()) as { error?: string; code?: string };
    } catch {
      // non-JSON body — use the HTTP status below
    }
    const detail = body?.code || body?.error;
    return detail
      ? `Hostinger Mail API error (HTTP ${response.status}): ${detail}`
      : `Hostinger Mail API error (HTTP ${response.status})`;
  }

  private buildTextTemplate(params: {
    campaignName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: Date;
  }) {
    const expiryDate = params.expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return [
      `${params.inviterName} invited you to join the campaign "${params.campaignName}".`,
      `Role: ${params.role}`,
      `This invitation expires on ${expiryDate}.`,
      '',
      `Accept the invitation: ${params.inviteUrl}`,
    ].join('\n');
  }

  private buildInviteTemplate(params: {
    campaignName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: Date;
  }) {
    const expiryDate = params.expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background: #0d0a14; font-family: system-ui, sans-serif; }
        .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
        .card { background: linear-gradient(135deg, #15101f 0%, #1c1630 100%); border: 1px solid #2a2240; border-radius: 12px; padding: 32px; }
        .logo { text-align: center; margin-bottom: 24px; }
        h1 { color: #e8e2d9; font-size: 20px; margin: 0 0 8px; }
        .subtitle { color: #a098b0; font-size: 14px; margin: 0 0 24px; }
        .detail { color: #e8e2d9; font-size: 14px; margin: 0 0 4px; }
        .detail-label { color: #6e6878; }
        .btn { display: inline-block; background: linear-gradient(135deg, #c9a44b, #d4b35e); color: #0d0a14; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 24px 0; }
        .footer { color: #4a4060; font-size: 12px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <img src="${EMAIL_LOGO_URL}" alt="Mythrion" style="max-width: 200px; width: 100%; height: auto; display: inline-block;" />
          </div>
          <h1>${params.inviterName} invited you</h1>
          <p class="subtitle">You've been invited to join a campaign.</p>
          <p class="detail"><span class="detail-label">Campaign: </span>${params.campaignName}</p>
          <p class="detail"><span class="detail-label">Role: </span>${params.role}</p>
          <p class="detail"><span class="detail-label">Expires: </span>${expiryDate}</p>
          <center><a href="${params.inviteUrl}" class="btn">Accept Invitation</a></center>
          <div class="footer">This invitation expires in 7 days. If you didn't expect this, you can ignore it.</div>
        </div>
      </div>
    </body>
    </html>`;
  }
}
