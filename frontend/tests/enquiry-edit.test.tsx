import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '../src/lib/auth'
import { EnquiryDetail } from '../src/pages/EnquiryDetail'

const enquiry = {
  id: 'enquiry-1',
  reference: 'ENQ-2026-0001',
  client_reference: 'ENQ-2026-0001',
  title: 'Client Residence',
  contact_name: 'Client Name',
  email: 'client@example.com',
  phone: '9876543210',
  property_type: 'Apartment',
  location: 'Bengaluru',
  area_sqft: 1200,
  budget_min: 1500000,
  budget_max: 2500000,
  expected_start_date: '2026-09-01',
  requirements: 'Modern interiors with additional storage.',
  source: 'Client portal',
  status: 'new',
  created_at: '2026-07-30T10:00:00Z',
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

test('admin can open and save the complete client enquiry edit form', async () => {
  localStorage.setItem('atelier_access_token', 'admin-token')
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'admin-1',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
        }),
      })
    }
    if (init?.method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ...enquiry, location: 'Whitefield, Bengaluru' }),
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ enquiry, activities: [], quotations: [] }),
    })
  })
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/enquiries/enquiry-1']}>
          <Routes><Route path="/enquiries/:id" element={<EnquiryDetail />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )

  await userEvent.click(await screen.findByRole('button', { name: 'Edit enquiry' }))
  expect(screen.getByText('Studio enquiry number')).toBeInTheDocument()
  expect(screen.getByText("Client Name's enquiry number")).toBeInTheDocument()
  const location = screen.getByLabelText('Location')
  await userEvent.clear(location)
  await userEvent.type(location, 'Whitefield, Bengaluru')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/enquiries/enquiry-1',
    expect.objectContaining({ method: 'PATCH' }),
  )
})

test('team member has view-only details and can update only the status', async () => {
  localStorage.setItem('atelier_access_token', 'team-token')
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'sales-1',
          email: 'sales@example.com',
          full_name: 'Sales User',
          role: 'sales_manager',
          is_active: true,
        }),
      })
    }
    if (init?.method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ...enquiry, status: 'contacted' }),
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ enquiry, activities: [], quotations: [] }),
    })
  })
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/enquiries/enquiry-1']}>
          <Routes><Route path="/enquiries/:id" element={<EnquiryDetail />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )

  const status = await screen.findByLabelText('Update enquiry status')
  expect(screen.queryByRole('button', { name: 'Edit enquiry' })).not.toBeInTheDocument()
  expect(screen.getByText('Enquiry details are view-only; you can update work status.')).toBeInTheDocument()
  await userEvent.selectOptions(status, 'contacted')
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/enquiries/enquiry-1',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'contacted' }) }),
  )
})
