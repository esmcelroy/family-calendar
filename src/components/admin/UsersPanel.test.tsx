import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPanel } from './UsersPanel'

const request = vi.fn()

vi.mock('@/lib/server-api', () => ({
  serverApi: { request: (...args: unknown[]) => request(...args) },
}))

describe('administrator account management', () => {
  beforeEach(() => {
    request.mockReset()
    request
      .mockResolvedValueOnce({ users: [{ id: 'u1', username: 'admin', role: 'admin', createdAt: '2026-11-06T00:00:00Z' }] })
      .mockResolvedValueOnce({ id: 'u2', username: 'alex', role: 'member', createdAt: '2026-11-06T00:00:00Z' })
  })

  it('lists accounts and creates accounts through the authenticated admin API', async () => {
    render(<UsersPanel />)

    expect(await screen.findByRole('listitem')).toHaveTextContent('admin')
    fireEvent.change(screen.getByLabelText(/new username/i), { target: { value: 'alex' } })
    fireEvent.change(screen.getByLabelText(/temporary password/i), { target: { value: 'a-strong-password' } })
    fireEvent.change(screen.getByLabelText(/account role/i), { target: { value: 'member' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({ method: 'POST' }))
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Account created.')
  })

  it('shows server errors without pretending an account was created', async () => {
    request.mockReset().mockRejectedValueOnce(new Error('Administrator access is required.'))
    render(<UsersPanel />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access is required.')
    expect(screen.queryByText('alex')).not.toBeInTheDocument()
  })
})
