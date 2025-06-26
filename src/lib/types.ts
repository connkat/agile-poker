export interface Session {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface Ticket {
  id: string
  session_id: string
  ticket_number: string
  title: string
  jira_link?: string
  total_votes: number
  median_value: number
  final_value: number
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  session_id: string
  name: string
  is_admin: boolean
  joined_at: string
}

export interface Vote {
  id: string
  ticket_id: string
  participant_id: string
  value: number
  created_at: string
  updated_at: string
}