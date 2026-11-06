import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serverApi } from '@/lib/server-api'
import { SettingsPanel } from './SettingsPanel'

vi.mock('@/lib/server-api', () => ({ serverApi: { request: vi.fn() } }))
vi.mock('./FeedSettings', () => ({ FeedSettings: () => null }))

describe('admin family settings', () => {
  beforeEach(() => {
    vi.mocked(serverApi.request).mockReset()
  })

  it('saves an emptied organizer email as null', async () => {
    const savedSettings = {
      organizerName: 'Family',
      organizerEmail: 'family@example.org',
      smtpConfigured: false,
      smtp: null,
    }
    vi.mocked(serverApi.request)
      .mockResolvedValueOnce(savedSettings as never)
      .mockResolvedValueOnce({ ...savedSettings, organizerEmail: null } as never)

    render(<SettingsPanel />)
    const email = await screen.findByLabelText('Organizer email')
    fireEvent.change(email, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(serverApi.request).toHaveBeenCalledTimes(2))
    const options = vi.mocked(serverApi.request).mock.calls[1]?.[1]
    expect(JSON.parse(options?.body as string).organizerEmail).toBeNull()
  })
})
