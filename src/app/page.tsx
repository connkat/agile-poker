'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [sessionName, setSessionName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const createSession = async () => {
    if (!sessionName.trim()) return

    setIsCreating(true)
    try {
      // Generate a unique user ID for the admin
      const adminId = crypto.randomUUID()
      
      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          name: sessionName,
          created_by: adminId
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Create admin participant
      const { error: participantError } = await supabase
        .from('participants')
        .insert({
          session_id: session.id,
          name: 'Admin',
          is_admin: true
        })

      if (participantError) throw participantError

      // Store admin ID in localStorage
      localStorage.setItem('adminId', adminId)
      
      router.push(`/session/${session.id}/admin`)
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Failed to create session')
    } finally {
      setIsCreating(false)
    }
  }

  const joinSession = () => {
    if (!joinCode.trim()) return
    router.push(`/session/${joinCode}/join`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">Agile Poker</h1>
          <p className="mt-2 text-gray-600">Planning poker for agile teams</p>
        </div>

        <div className="space-y-6">
          {/* Create Session */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Session</h2>
            <input
              type="text"
              placeholder="Session name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={createSession}
              disabled={isCreating || !sessionName.trim()}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Session'}
            </button>
          </div>

          {/* Join Session */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Join Existing Session</h2>
            <input
              type="text"
              placeholder="Session ID"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={joinSession}
              disabled={!joinCode.trim()}
              className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Join Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}