import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { WorkProfile } from '../src/pages/WorkProfile'

afterEach(() => vi.unstubAllGlobals())

test('personal profile shows shared messages and updates their completion status', async () => {
  const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve({
    ok: true,
    status: init?.method === 'PATCH' ? 200 : 200,
    json: async () => init?.method === 'PATCH' ? ({ status: 'completed' }) : ({
      user: {
        id: 'user-1',
        full_name: 'Team Member',
        email: 'team@example.com',
        role: 'project_manager',
      },
      summary: {
        total_actions: 2,
        enquiry_messages: 1,
        status_updates: 1,
        open_messages: 1,
      },
      messages: [{
        id: 'message-1',
        subject: 'Question about ENQ-2026-0001',
        message: 'Please confirm the kitchen measurements.',
        status: 'open',
        sender: { id: 'user-1', full_name: 'Team Member', role: 'project_manager' },
        client: { id: 'client-1', full_name: 'Client Name', email: 'client@example.com' },
        created_at: '2026-07-30T10:00:00Z',
        updated_at: '2026-07-30T10:00:00Z',
      }],
      activities: [{
        id: 'activity-1',
        action: 'team_message',
        title: 'ENQ-2026-0001 · Client Residence',
        description: 'Please confirm the kitchen measurements.',
        entity_type: 'enquiry',
        link: '/enquiries/enquiry-1',
        created_at: '2026-07-30T10:00:00Z',
      }],
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><WorkProfile /></MemoryRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Team Member')).toBeInTheDocument()
  expect(screen.getAllByText('Please confirm the kitchen measurements.')).toHaveLength(2)
  expect(screen.getByText('2')).toBeInTheDocument()
  await userEvent.selectOptions(
    screen.getByLabelText('Completion status for Question about ENQ-2026-0001'),
    'completed',
  )
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/communications/message-1/status',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'completed' }) }),
  )
})
