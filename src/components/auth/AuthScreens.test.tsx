import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthGate, type AuthUser } from './AuthGate'
import { AuthScreens } from './AuthScreens'

describe('authentication screens', () => {
  it('provides an accessible first-run administrator bootstrap form', () => {
    const onSubmit = vi.fn()
    render(<AuthScreens mode="bootstrap" onSubmit={onSubmit} />)

    expect(screen.getByRole('heading', { name: /create administrator/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('minLength', '8')

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'a-strong-password' } })
    fireEvent.click(screen.getByRole('button', { name: /create administrator/i }))

    expect(onSubmit).toHaveBeenCalledWith({ username: 'admin', password: 'a-strong-password' })
  })

  it('shows login failures accessibly and submits credentials', () => {
    const onSubmit = vi.fn()
    render(<AuthScreens mode="login" onSubmit={onSubmit} error="Invalid username or password." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.')
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alex' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(onSubmit).toHaveBeenCalledWith({ username: 'alex', password: 'password-123' })
  })

  it('keeps protected content hidden until authenticated and supports logout', () => {
    const onLogout = vi.fn()
    const { rerender } = render(
      <AuthGate user={null} bootstrapRequired={false} loading={false} onLogout={onLogout}>
        <p>Private calendar</p>
      </AuthGate>,
    )

    expect(screen.queryByText('Private calendar')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()

    const user: AuthUser = { id: 'user-1', username: 'alex', role: 'member', createdAt: new Date().toISOString() }
    rerender(
      <AuthGate user={user} bootstrapRequired={false} loading={false} onLogout={onLogout}>
        <p>Private calendar</p>
      </AuthGate>,
    )

    expect(screen.getByText('Private calendar')).toBeInTheDocument()
    expect(document.activeElement).toHaveAttribute('tabindex', '-1')
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('shows a loading state instead of exposing protected content during session checks', () => {
    render(
      <AuthGate user={null} bootstrapRequired={false} loading onLogout={vi.fn()}>
        <p>Private calendar</p>
      </AuthGate>,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/checking session/i)
    expect(screen.queryByText('Private calendar')).not.toBeInTheDocument()
  })
})
