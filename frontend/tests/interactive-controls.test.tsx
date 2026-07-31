import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { Customers } from '../src/pages/Customers'

test('customer action opens a working create form', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ items: [], total: 0, page: 1, page_size: 20 }),
  }))
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter><Customers /></BrowserRouter>
    </QueryClientProvider>,
  )
  await screen.findByText('No customers found')
  await userEvent.click(screen.getByRole('button', { name: /add customer/i }))
  expect(screen.getByRole('heading', { name: 'Add customer' })).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toBeRequired()
  vi.unstubAllGlobals()
})
