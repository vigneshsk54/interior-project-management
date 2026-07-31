export type Role =
  | 'admin' | 'sales_manager' | 'interior_designer' | 'project_manager'
  | 'site_supervisor' | 'client' | 'vendor'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
  is_active: boolean
  avatar_url?: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Enquiry {
  id: string
  reference: string
  client_reference: string
  title: string
  contact_name: string
  email: string
  phone: string
  property_type: string
  location: string
  area_sqft?: number
  budget_min?: number
  budget_max?: number
  expected_start_date?: string
  requirements: string
  source: string
  status: string
  assigned_to_id?: string
  created_at: string
}

export interface Project {
  id: string
  code: string
  name: string
  status: string
  stage: string
  health: string
  progress: number
  contract_value: number
  budget: number
  location: string
  expected_completion_date?: string
}

export interface Task {
  id: string
  title: string
  status: string
  priority: string
  project_id?: string
  assignee_id?: string
  due_date?: string
  estimated_hours?: number
}

export interface Quotation {
  id: string
  number: string
  enquiry_id: string
  title: string
  status: string
  current_version: number
  subtotal: number
  tax: number
  discount: number
  total: number
  valid_until?: string
}
