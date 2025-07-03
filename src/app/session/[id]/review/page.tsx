"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Session, Ticket, SessionParticipant } from "@/lib/types";

// Helper function to ensure URLs are absolute
const ensureAbsoluteUrl = (url: string): string => {
  if (!url) return url;
  
  // If it already has a protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it starts with www., add https://
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }
  
  // For other cases, add https://
  return `https://${url}`;
};

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [allVotes, setAllVotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionCreator, setIsSessionCreator] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      router.push("/auth");
      return;
    }

    loadData();
    checkSessionCreator(userId);
  }, [id, router]);

  const checkSessionCreator = async (userId: string) => {
    const { data: sessionData, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && sessionData && sessionData.created_by === userId) {
      setIsSessionCreator(true);
      setSession(sessionData);
    } else {
      // Not the session creator, redirect to voting page
      router.push(`/session/${id}/vote`);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([loadTickets(), loadParticipants()]);
    // Load votes after tickets are loaded
    await loadAllVotes();
    setIsLoading(false);
  };

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setTickets(data);
    }
  };

  const loadParticipants = async () => {
    const { data, error } = await supabase
      .from("participants")
      .select(`
        *,
        user:users(*)
      `)
      .eq("session_id", id)
      .order("joined_at", { ascending: true });

    if (!error && data) {
      setParticipants(data);
    }
  };

  const loadAllVotes = async () => {
    // Get tickets first if not already loaded
    let currentTickets = tickets;
    if (!currentTickets.length) {
      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("session_id", id)
        .order("created_at", { ascending: true });

      if (ticketError) {
        console.error("Error loading tickets for votes:", ticketError);
        return [];
      }

      currentTickets = ticketData || [];
    }

    if (!currentTickets.length) {
      console.log("No tickets found for session");
      setAllVotes([]);
      return [];
    }

    console.log("Loading votes for tickets:", currentTickets.map(t => t.id));

    // First, get all votes for the session's tickets
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .in("ticket_id", currentTickets.map(t => t.id));

    if (votesError) {
      console.error("Error loading votes:", votesError);
      setAllVotes([]);
      return [];
    }

    console.log("Found votes:", votes?.length || 0);

    if (!votes || votes.length === 0) {
      setAllVotes([]);
      return [];
    }

    // Get participant IDs from votes
    const participantIds = [...new Set(votes.map(v => v.participant_id))];

    // Get participant details
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select(`
        id,
        user:users(name)
      `)
      .in("id", participantIds);

    if (participantsError) {
      console.error("Error loading participants:", participantsError);
      setAllVotes(votes); // Set votes without participant names
      return votes;
    }

    // Create a map of participant ID to participant data
    const participantMap = participants?.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, any>) || {};

    // Combine votes with participant data
    const votesWithParticipants = votes.map(vote => ({
      ...vote,
      participant: participantMap[vote.participant_id] || null
    }));

    console.log("Votes with participants:", votesWithParticipants.length);
    setAllVotes(votesWithParticipants);
    return votesWithParticipants;
  };

  const getVotesForTicket = (ticketId: string) => {
    return allVotes.filter(vote => vote.ticket_id === ticketId);
  };

  const calculateMedian = (votes: number[]) => {
    if (votes.length === 0) return 0;
    const sorted = votes.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  const updateFinalValue = async (ticketId: string, value: number) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ final_value: value })
        .eq("id", ticketId);

      if (error) throw error;
      await loadTickets();
    } catch (error) {
      console.error("Error updating final value:", error);
    }
  };

  const endSession = async () => {
    if (
      !confirm(
        "Are you sure you want to end this session? This will prevent new participants from joining."
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("sessions")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      alert("Session ended successfully");
      router.push("/");
    } catch (error) {
      console.error("Error ending session:", error);
      alert("Failed to end session");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (!isSessionCreator) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Access denied. Only session creators can view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {session?.name || "Session Review"}
          </h1>
          <p className="text-gray-600 mt-2">
            Review all votes and results
          </p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => router.push(`/session/${id}/vote`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Voting
          </button>
          <button
            onClick={endSession}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Session Stats */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Session Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">Total Tickets</p>
            <p className="text-2xl font-bold text-blue-900">{tickets.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Participants</p>
            <p className="text-2xl font-bold text-green-900">{participants.length}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-600 font-medium">Total Votes</p>
            <p className="text-2xl font-bold text-purple-900">{allVotes.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-orange-600 font-medium">Voted Tickets</p>
            <p className="text-2xl font-bold text-orange-900">
              {tickets.filter(ticket => getVotesForTicket(ticket.id).length > 0).length}
            </p>
          </div>
        </div>
      </div>

      {/* Vote Review */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Vote Review</h2>
        
        {tickets.length === 0 ? (
          <p className="text-gray-600">No tickets to review.</p>
        ) : (
          <div className="space-y-6">
            {tickets.map((ticket) => {
              const ticketVotes = getVotesForTicket(ticket.id);
              const voteValues = ticketVotes.map(v => v.value);
              const median = calculateMedian(voteValues);
              
              return (
                <div key={ticket.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {ticket.ticket_number}: {ticket.title}
                      </h3>
                      {ticket.jira_link && (
                        <a
                          href={ensureAbsoluteUrl(ticket.jira_link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View in Jira →
                        </a>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">
                          {ticketVotes.length} vote{ticketVotes.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          Median: {median}
                        </p>
                        <div className="mt-2">
                          <label className="text-sm text-gray-600">Final Value:</label>
                          <input
                            type="number"
                            value={ticket.final_value || ''}
                            onChange={(e) =>
                              updateFinalValue(
                                ticket.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="ml-2 w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {ticketVotes.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {ticketVotes.map((vote) => (
                        <div key={vote.id} className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="font-semibold text-gray-900 text-sm mb-1">
                            {vote.participant?.user?.name || 'Unknown'}
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            {vote.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No votes submitted yet
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Participants ({participants.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.map((participant) => (
            <div key={participant.id} className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-900">
                {participant.user?.name || "Unknown User"}
              </p>
              {session?.created_by === participant.user_id && (
                <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Creator
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 