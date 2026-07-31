import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Home } from '../src/pages/Home'

test('public home explains the product and provides responsive navigation', async () => {
  render(<BrowserRouter><Home /></BrowserRouter>)

  expect(screen.getByRole('heading', { name: /every interior project/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'From first enquiry to final handover' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'One workflow. Seven focused experiences.' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /start your project|start a project|create client account/i }).length).toBeGreaterThan(0)

  const desktopNav = screen.getByRole('navigation', { name: 'Primary navigation' })
  const mobileButton = screen.getByRole('button', { name: 'Open navigation' })
  expect(desktopNav).toHaveClass('md:flex')
  expect(mobileButton).toHaveClass('md:hidden')

  await userEvent.click(mobileButton)
  expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
})
