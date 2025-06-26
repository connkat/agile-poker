'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ticket, Vote } from '@/lib/types'


const VOTE_OPTIONS = [0, 0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?']

export default function VotingPage({ params }: { params: { id: string } }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [myVotes, setMyVotes] = useState<Record<string, number>>({})
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const pid = localStorage.getItem('participantId')
    if (!pid) {
      router.push(`/session/${params.id}/join`)
      return
    }
    setParticipantId(pid)

    loadData()

    // Subscribe to tickets updates
    const subscription = supabase
      .channel('session-tickets')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `session_id=eq.${params.id}` },
        () => loadTickets()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [params.id, router])

  const loadData = async () => {
    await Promise.all([
      loadTickets(),
      loadMyVotes()
    ])
  }

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, ticket_number, title, jira_link, total_votes')
      .eq('session_id', params.id)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setTickets(data)
    }
  }

  const loadMyVotes = async () => {
    const pid = localStorage.getItem('participantId')
    if (!pid) return

    const { data, error } = await supabase
      .from('votes')
      .select('ticket_id, value')
      .eq('participant_id', pid)

    if (!error && data) {
      const votesMap = data.reduce((acc, vote) => {
        acc[vote.ticket_id] = vote.value
        return acc
      }, {} as Record<string, number>)
      setMyVotes(votesMap)
    }
  }

  const submitVote = async (ticketId: string, value: number | string) => {
    if (!participantId || value === '?') return

    const numValue = typeof value === 'number' ? value : 0

    try {
      const { error } = await supabase
        .from('votes')
        .upsert({
          ticket_id: ticketId,
          participant_id: participantId,
          value: numValue
        }, {
          onConflict: 'ticket_id,participant_id'
        })

      if (error) throw error

      setMyVotes({ ...myVotes, [ticketId]: numValue })
      
      // Auto-advance to next ticket
      if (currentTicketIndex < tickets.length - 1) {
        setTimeout(() => setCurrentTicketIndex(currentTicketIndex + 1), 500)
      }
    } catch (error) {
      console.error('Error submitting vote:', error)
      alert('Failed to submit vote')
    }
  }

  if (tickets.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">No tickets to vote on yet.</p>
          <p className="text-gray-500 mt-