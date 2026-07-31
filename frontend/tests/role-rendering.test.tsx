import { render, screen } from '@testing-library/react'
import { Badge } from '../src/components/ui'

test('renders normalized workflow status labels', () => {
  render(<Badge value="pending_approval" />)
  expect(screen.getByText('Pending Approval')).toBeInTheDocument()
})
