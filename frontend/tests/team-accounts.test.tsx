import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { TeamAccounts } from '../src/pages/TeamAccounts'

test('admin can create a separate authorized team account', async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 'team-2',
          full_name: 'New Administrator',
          email: 'new-admin@example.com',
          role: 'admin',
          is_active: true,
        }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => [{
        id: 'team-1',
        full_name: 'Existing Administrator',
        email: 'admin@example.com',
        role: 'admin',
        is_active: true,
      }],
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter><TeamAccounts /></BrowserRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Existing Administrator')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Add team account' }))
  await userEvent.type(screen.getByLabelText('Full name'), 'New Administrator')
  await userEvent.selectOptions(screen.getByLabelText('Access role'), 'admin')
  await userEvent.type(screen.getByLabelText('Email address'), 'new-admin@example.com')
  await userEvent.type(screen.getByLabelText('Temporary password'), 'AdminSecure@123')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'AdminSecure@123')
  await userEvent.click(screen.getByRole('button', { name: 'Create team account' }))

  expect(await screen.findByText('Team account created')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/team', expect.objectContaining({ method: 'POST' }))
  vi.unstubAllGlobals()
})
