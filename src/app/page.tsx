"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [sessionName, setSessionName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeSessions, setActiveSessions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/auth");
    } else {
      loadActiveSessions();
    }
  }, [router]);

  const createSession = async () => {
    if (!sessionName.trim()) return;

    setIsCreating(true);
    try {
      const userId = localStorage.getItem("userId");

      if (!userId) {
        router.push("/auth");
        return;
      }

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          name: sessionName,
          created_by: userId,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          session_id: session.id,
          user_id: userId,
        })
        .select()
        .single();

      if (participantError) {
        console.log("Detailed error:", participantError);
        throw participantError;
      }

      // Store session info
      localStorage.setItem("participantId", participant.id);

      // Navigate to voting page
      router.push(`/session/${session.id}/vote`);
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Failed to create session");
    } finally {
      setIsCreating(false);
    }
  };

  // Remove the unused joinSession function

  const loadActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setActiveSessions(data);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Session
            </h2>
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
              {isCreating ? "Creating..." : "Create Session"}
            </button>
          </div>

          {/* Join Session */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Join Existing Session
            </h2>

            {isLoadingSessions ? (
              <p className="text-gray-500 text-center py-4">
                Loading sessions...
              </p>
            ) : activeSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No active sessions available
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => router.push(`/session/${session.id}/join`)}
                    className="w-full text-left px-4 py-3 rounded-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{session.name}</p>
                    <p className="text-sm text-gray-500">
                      ID: {session.id.slice(0, 8)}...
                    </p>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={loadActiveSessions}
              className="mt-4 w-full text-sm text-blue-600 hover:text-blue-700"
            >
              Refresh list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
