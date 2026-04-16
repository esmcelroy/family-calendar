import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import type { SmtpConfig, Invitation } from '../src/lib/types'

interface SendInvitationBody {
  invitation: Invitation
  smtpConfig: SmtpConfig
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { invitation, smtpConfig } = req.body as SendInvitationBody

  if (!invitation || !smtpConfig) {
    return res.status(400).json({ error: 'Missing invitation or smtpConfig' })
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
  })

  const isCancel = invitation.method === 'CANCEL'
  const subject = isCancel ? `Cancelled: Calendar event` : `You're invited: Calendar event`

  const gcalSection = invitation.gcalUrl
    ? `<p><a href="${invitation.gcalUrl}" style="color:#4285F4;font-weight:bold;">Add to Google Calendar</a></p>`
    : ''

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>${subject}</h2>
      <p>Hi ${invitation.recipientName},</p>
      <p>${isCancel ? 'An event you were invited to has been cancelled.' : 'You have been invited to a new event.'}</p>
      ${gcalSection}
      <p style="color:#666;font-size:0.9em">An .ics file is attached — open it to add or update this event in your calendar app.</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`,
      to: `"${invitation.recipientName}" <${invitation.recipientEmail}>`,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: 'event.ics',
          content: invitation.icsPayload,
          contentType: `text/calendar; method=${invitation.method}; charset=UTF-8`,
        },
      ],
    })

    return res.status(200).json({ status: 'sent' })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ status: 'failed', error })
  }
}
