'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinSession({ params }: { params: { id: string } }) {
  const [name, setName] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const router = useRouter()

  const handleJoin = async () => {
    if (!name.trim()) return

    setIsJoining(true)
    try {
      // Check if session exists
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.id)
        .eq('is_active', true)
        .single()

      if (sessionError || !session) {
        alert('Session not found or inactive')
        return
      }

      // Create participant
      const { data: participant, error } = await supabase
        .from('participants')
        .insert({
          session_id: params.id,
          name: name.trim(),
          is_admin: false
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          alert('This name is already taken in this session')
        } else {
          throw error
        }
        return
      }

      // Store participant ID
      localStorage.setItem('participantId', participant.id)
      
      router.push(`/session/${params.id}/vote`)
    } catch (error) {
      console.error('Error joining session:', error)
      alert('Failed to join session')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Join Session</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={isJoining || !name.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}