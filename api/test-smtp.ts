import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import type { SmtpConfig } from '../src/lib/types'

interface TestSmtpBody {
  smtpConfig: SmtpConfig
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { smtpConfig } = req.body as TestSmtpBody

  if (!smtpConfig) {
    return res.status(400).json({ error: 'Missing smtpConfig' })
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

  try {
    await transporter.verify()
    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ status: 'failed', error })
  }
}
