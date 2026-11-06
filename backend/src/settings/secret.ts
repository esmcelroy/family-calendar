import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function encryptSecret(value: string, key: Buffer): string {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [nonce, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(value: string, key: Buffer): string {
  const [nonceValue, tagValue, encryptedValue] = value.split('.')
  if (!nonceValue || !tagValue || !encryptedValue) throw new Error('Stored SMTP credential is invalid.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonceValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
