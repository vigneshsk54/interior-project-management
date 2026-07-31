import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ClientAccounts } from '../src/pages/ClientAccounts'

test('admin can create a client sign-in for an existing customer', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/users') && !init?.method) {
      return { ok: true, status: 200, json: async () => [] }
    }
    if (url.includes('/customers?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{
            id: 'customer-1',
            name: 'Aarav Client',
            email: 'aarav@example.com',
            phone: '9876543210',
          }],
          total: 1,
          page: 1,
          page_size: 100,
        }),
      }
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 'user-1',
        full_name: 'Aarav Client',
        email: 'aarav@example.com',
        role: 'client',
        is_active: true,
      }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter><ClientAccounts /></BrowserRouter>
    </QueryClientProvider>,
  )

  await screen.findByText('No client sign-ins yet')
  await userEvent.click(screen.getByRole('button', { name: /create client sign-in/i }))
  await userEvent.selectOptions(screen.getByLabelText('Customer'), 'customer-1')
  await userEvent.type(screen.getByLabelText('Temporary password'), 'ClientPass@123')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'ClientPass@123')
  await userEvent.click(screen.getByRole('button', { name: /^create sign-in$/i }))

  expect(await screen.findByText('Client sign-in created')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/users/clients',
    expect.objectContaining({ method: 'POST' }),
  )
  vi.unstubAllGlobals()
})
