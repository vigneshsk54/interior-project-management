import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { SettingsPage } from '../src/pages/Settings'

test('settings uses structured fields instead of a JSON editor', async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'setting-1', key: 'company_profile', value: JSON.parse(String(init.body)).value }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => [{
        id: 'setting-1',
        key: 'company_profile',
        value: { studioName: 'Existing Studio', email: 'hello@example.com' },
      }],
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter><SettingsPage /></BrowserRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByDisplayValue('Existing Studio')).toBeInTheDocument()
  expect(screen.getByLabelText('Business email')).toHaveValue('hello@example.com')
  expect(screen.queryByText(/JSON value/i)).not.toBeInTheDocument()

  await userEvent.clear(screen.getByLabelText('Studio name'))
  await userEvent.type(screen.getByLabelText('Studio name'), 'Updated Studio')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Changes saved')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/settings/company_profile',
    expect.objectContaining({ method: 'PUT' }),
  )
  vi.unstubAllGlobals()
})
