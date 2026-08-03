import { Injectable, Logger } from '@nestjs/common';

const API_BASE_URL = 'https://api.mail.hostinger.com';
const DEFAULT_FROM = 'Mythrion <noreply@mythrion.com>';
const REQUEST_TIMEOUT_MS = 10_000;

/** Extract the display-name portion of a "Name <addr>" From string. */
function parseDisplayName(from: string | undefined): string {
  if (!from) return 'Mythrion';
  const match = /^\s*(.*?)\s*<[^>]+>/.exec(from);
  return match?.[1] || 'Mythrion';
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly token: string | undefined;
  private readonly mailboxId: string | undefined;
  private readonly displayName: string;

  constructor() {
    this.token = process.env.HOSTINGER_MAIL_API_TOKEN;
    this.mailboxId = process.env.HOSTINGER_MAILBOX_ID;
    this.displayName = parseDisplayName(process.env.EMAIL_FROM ?? DEFAULT_FROM);

    if (!this.token || !this.mailboxId) {
      this.logger.warn(
        'HOSTINGER_MAIL_API_TOKEN / HOSTINGER_MAILBOX_ID not set — email sending is disabled. Invitation emails will not be delivered.',
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
    if (!this.token || !this.mailboxId) {
      this.logger.log(
        `[DEV] Invitation email would be sent to ${params.to} - ${params.inviteUrl}`,
      );
      return;
    }

    const html = this.buildInviteTemplate(params);
    const text = this.buildTextTemplate(params);

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
            subject: `${params.inviterName} invited you to ${params.campaignName}`,
            text,
            html,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        throw new Error(await this.describeError(response));
      }

      this.logger.log(`Invitation email sent to ${params.to}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send invitation email to ${params.to}: ${message}`,
      );
      // Rethrow so the caller can surface the failure (and roll back the invitation).
      throw err;
    }
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
        .logo-text { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #c9a44b 0%, #e0c470 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
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
            <span class="logo-text">⭑ Mythrion</span>
          </div>
          <h1>${params.inviterName} invited you</h1>
          <p class="subtitle">You've been invited to join an adventure.</p>
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
