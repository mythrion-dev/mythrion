import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly resend: Resend | null

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    this.resend = apiKey ? new Resend(apiKey) : null
  }

  async sendInvitation(params: {
    to: string
    campaignName: string
    inviterName: string
    role: string
    inviteUrl: string
    expiresAt: Date
  }) {
    if (!this.resend) {
      this.logger.log(
        `[DEV] Invitation email would be sent to ${params.to} - ${params.inviteUrl}`,
      )
      return
    }

    const html = this.buildInviteTemplate(params)

    try {
      const result = await this.resend.emails.send({
        from: 'Mythrion <noreply@mythrion.com>',
        to: params.to,
        subject: `${params.inviterName} invited you to ${params.campaignName}`,
        html,
      })
      this.logger.log(`Invitation email sent to ${params.to}: ${result.data?.id}`)
    } catch (err) {
      this.logger.error(
        `Failed to send invitation email: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private buildInviteTemplate(params: {
    campaignName: string
    inviterName: string
    role: string
    inviteUrl: string
    expiresAt: Date
  }) {
    const expiryDate = params.expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

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
    </html>`
  }
}