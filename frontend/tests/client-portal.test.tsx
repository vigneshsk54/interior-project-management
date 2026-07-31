import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider } from '../src/lib/auth'
import { ClientEnquiryConversation, ClientPortal } from '../src/pages/Portals'

test('new clients can start a project from the portal empty state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      customer: { name: 'Sruthi' },
      enquiries: [],
      projects: [],
      approvals: [],
      notifications: [],
    }),
  }))

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter><AuthProvider><ClientPortal /></AuthProvider></BrowserRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Let’s plan your first space')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Start a project' }))
  expect(screen.getByRole('heading', { name: 'Tell us about your space' })).toBeInTheDocument()
  expect(screen.getByLabelText('Project name')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Submit project request' })).toBeInTheDocument()

  vi.unstubAllGlobals()
})

test('client sees a targeted team question and can reply on the enquiry', async () => {
  const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve({
    ok: true,
    status: init?.method === 'POST' ? 201 : 200,
    json: async () => init?.method === 'POST' ? {} : ({
      enquiry: {
        id: 'enquiry-1',
        reference: 'ENQ-2026-0042',
        client_reference: 'ENQ-2026-0001',
        title: 'Sruthi Residence',
        property_type: 'Apartment',
        location: 'Bengaluru',
        status: 'new',
      },
      messages: [{
        id: 'message-1',
        activity_type: 'team_message',
        message: 'Could you confirm the kitchen layout?',
        created_at: '2026-07-30T10:00:00Z',
        metadata_json: { sender_name: 'Ananya Mehta', sender_role: 'admin' },
      }],
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/client-enquiries/enquiry-1']}>
          <Routes><Route path="/client-enquiries/:id" element={<ClientEnquiryConversation />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Could you confirm the kitchen layout?')).toBeInTheDocument()
  expect(screen.getByText(/Your enquiry no. · ENQ-2026-0001/)).toBeInTheDocument()
  expect(screen.queryByText(/ENQ-2026-0042/)).not.toBeInTheDocument()
  expect(screen.getByText('Ananya Mehta')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Reply about this enquiry'), 'Yes, use an open kitchen layout.')
  await userEvent.click(screen.getByRole('button', { name: 'Send reply' }))
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/portal/client/enquiries/enquiry-1/messages',
    expect.objectContaining({ method: 'POST' }),
  )

  vi.unstubAllGlobals()
})

test('client can contact the studio without accessing admin tools', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      customer: { name: 'Sruthi' },
      enquiries: [],
      projects: [],
      approvals: [],
      notifications: [],
    }),
  }))

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BrowserRouter><AuthProvider><ClientPortal /></AuthProvider></BrowserRouter>
    </QueryClientProvider>,
  )

  await screen.findByText('Let’s plan your first space')
  await userEvent.click(screen.getByRole('button', { name: 'Contact studio' }))
  expect(screen.getByRole('heading', { name: 'Contact the studio' })).toBeInTheDocument()
  expect(screen.getByLabelText('Subject')).toBeInTheDocument()
  expect(screen.getByLabelText('Message')).toBeInTheDocument()
  expect(screen.queryByText('Internal budget')).not.toBeInTheDocument()

  vi.unstubAllGlobals()
})
