export interface SmtpSettings {
  host: string
  port: number
  secure: boolean
  username: string | null
  password: string | null
  fromName: string | null
  fromAddress: string
}

export interface MailTransport {
  verify(): Promise<unknown>
  sendMail(message: Record<string, unknown>): Promise<{ accepted?: unknown[]; rejected?: unknown[] }>
}

export type MailTransportFactory = (settings: SmtpSettings) => MailTransport
