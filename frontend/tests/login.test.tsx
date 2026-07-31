import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../src/lib/auth'
import { Login, Signup } from '../src/pages/Login'

function renderLogin() {
  return render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><AuthProvider><Login /></AuthProvider></BrowserRouter></QueryClientProvider>)
}

test('validates the login form before submitting', async () => {
  renderLogin()
  const user = userEvent.setup()
  const email = screen.getByLabelText('Email address')
  const password = screen.getByLabelText('Password')
  await user.clear(email)
  await user.type(email, 'not-an-email')
  await user.clear(password)
  await user.type(password, 'short')
  await user.click(screen.getByRole('button', { name: /log in/i }))
  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument()
})

test('keeps sign up on its own validated form', async () => {
  render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><AuthProvider><Signup /></AuthProvider></BrowserRouter></QueryClientProvider>)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Full name'), 'New Client')
  await user.type(screen.getByLabelText('Phone number'), '9876543210')
  await user.type(screen.getByLabelText('Email address'), 'client@example.com')
  await user.type(screen.getByLabelText('Password'), 'NewClient@123')
  await user.type(screen.getByLabelText('Confirm password'), 'Different@123')
  await user.click(screen.getByRole('button', { name: /^sign up$/i }))
  expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Client login' })).toHaveAttribute('href', '/login/client')
})

test('requires exactly 10 digits for a client phone number', async () => {
  render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><AuthProvider><Signup /></AuthProvider></BrowserRouter></QueryClientProvider>)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Full name'), 'New Client')
  await user.type(screen.getByLabelText('Phone number'), '987654321')
  await user.type(screen.getByLabelText('Email address'), 'client@example.com')
  await user.type(screen.getByLabelText('Password'), 'NewClient@123')
  await user.type(screen.getByLabelText('Confirm password'), 'NewClient@123')
  await user.click(screen.getByRole('button', { name: /^sign up$/i }))
  expect(await screen.findByText('Phone number must contain exactly 10 digits')).toBeInTheDocument()
})

test('rejects a common mistyped Gmail domain', async () => {
  render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><AuthProvider><Signup /></AuthProvider></BrowserRouter></QueryClientProvider>)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Full name'), 'New Client')
  await user.type(screen.getByLabelText('Phone number'), '9123456789')
  const email = screen.getByLabelText('Email address')
  await user.type(email, 'Ithurs123@Gmail.co')
  expect(email).toHaveValue('ithurs123@gmail.co')
  await user.type(screen.getByLabelText('Password'), 'NewClient@123')
  await user.type(screen.getByLabelText('Confirm password'), 'NewClient@123')
  await user.click(screen.getByRole('button', { name: /^sign up$/i }))
  expect(
    await screen.findByText('Email domain looks incorrect; did you mean gmail.com?'),
  ).toBeInTheDocument()
})

test('shows separate client and admin login experiences', () => {
  render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><AuthProvider><Login mode="workspace" /></AuthProvider></BrowserRouter></QueryClientProvider>)
  expect(screen.getByRole('heading', { name: 'Log in to the studio workspace' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Client' })).toHaveAttribute('href', '/login/client')
  expect(screen.getByRole('link', { name: /admin \/ team/i })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Log in to workspace' })).toBeInTheDocument()
})
