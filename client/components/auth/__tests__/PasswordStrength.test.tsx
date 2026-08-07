import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PasswordStrength } from '../PasswordStrength'

describe('PasswordStrength', () => {
  it('renders nothing while the password field is empty', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the full requirement checklist and a strong label for a compliant password', () => {
    render(<PasswordStrength password="Abcd1234!" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('At least one lowercase letter')).toBeInTheDocument()
    expect(screen.getByText('At least one uppercase letter')).toBeInTheDocument()
    expect(screen.getByText('At least one number')).toBeInTheDocument()
    expect(screen.getByText('At least one special character')).toBeInTheDocument()
  })

  it('labels a weak password as weak', () => {
    render(<PasswordStrength password="abc" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
    expect(screen.queryByText('Strong')).not.toBeInTheDocument()
  })
})
