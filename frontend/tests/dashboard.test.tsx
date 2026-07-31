import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { ClientScheduledProjects } from '../src/pages/Dashboard'

test('admin dashboard shows projects scheduled from the client portal', async () => {
  render(
    <MemoryRouter>
      <ClientScheduledProjects items={[{
        id: 'enquiry-1',
        reference: 'ENQ-2026-0001',
        client_reference: 'ENQ-2026-0001',
        title: 'Client Residence',
        client_name: 'Client Name',
        email: 'client@example.com',
        property_type: 'Apartment',
        location: 'Bengaluru',
        expected_start_date: '2026-09-15',
        status: 'new',
        created_at: '2026-07-30T10:00:00Z',
      }]} />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Client-scheduled projects')).toBeInTheDocument()
  expect(screen.getByText('Client Residence')).toBeInTheDocument()
  expect(screen.getByText('Studio:')).toBeInTheDocument()
  expect(screen.getByText('Client Name:')).toBeInTheDocument()
  expect(screen.getByText(/Client Name · Apartment · Bengaluru/)).toBeInTheDocument()
  expect(screen.getByText('15/9/2026')).toBeInTheDocument()
})
