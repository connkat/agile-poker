"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Session, Ticket, SessionParticipant } from "@/lib/types";

// Type for ticket data visible to voters (excluding sensitive fields)
type VoterTicket = {
  id: string;
  ticket_number: string;
  title: string;
  jira_link?: string;
  total_votes: number;
};

const VOTE_OPTIONS = [0, 0.5, 1, 2, 3, 5, 8, "?"];

export default function VotingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const [isSessionCreator, setIsSessionCreator] = useState(false);
  const [showTicketManager, setShowTicketManager] = useState(false);
  const [newTicket, setNewTicket] = useState({
    ticket_number: "",
    title: "",
    jira_link: "",
  });
  const [isAddingTicket, setIsAddingTicket] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const pid = localStorage.getItem("participantId");
    const userId = localStorage.getItem("userId");

    if (!pid) {
      router.push(`/session/${id}/join`);
      return;
    }
    setParticipantId(pid);

    loadData();
    checkSessionCreator(userId);

    // Subscribe to tickets updates
    const subscription = supabase
      .channel("session-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `session_id=eq.${id}`,
        },
        () => loadTickets()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id, router]);

  const checkSessionCreator = async (userId: string | null) => {
    if (!userId) return;

    const { data: sessionData, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && sessionData && sessionData.created_by === userId) {
      setIsSessionCreator(true);
      setSession(sessionData);
    }
  };

  const loadData = async () => {
    await Promise.all([loadTickets(), loadMyVotes(), loadParticipants()]);
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
      .select(
        `
        *,
        user:users(*)
      `
      )
      .eq("session_id", id)
      .order("joined_at", { ascending: true });

    if (!error && data) {
      setParticipants(data);
    }
  };

  const loadMyVotes = async () => {
    const pid = localStorage.getItem("participantId");
    if (!pid) return;

    const { data, error } = await supabase
      .from("votes")
      .select("ticket_id, value")
      .eq("participant_id", pid);

    if (!error && data) {
      const votesMap = data.reduce((acc, vote) => {
        acc[vote.ticket_id] = vote.value;
        return acc;
      }, {} as Record<string, number>);
      setMyVotes(votesMap);
    }
  };

  const addTicket = async () => {
    if (!newTicket.ticket_number || !newTicket.title) return;

    setIsAddingTicket(true);
    try {
      const { error } = await supabase.from("tickets").insert({
        session_id: id,
        ...newTicket,
      });

      if (error) throw error;

      setNewTicket({ ticket_number: "", title: "", jira_link: "" });
      await loadTickets();
    } catch (error) {
      console.error("Error adding ticket:", error);
      alert("Failed to add ticket");
    } finally {
      setIsAddingTicket(false);
    }
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

  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;

    try {
      const { error } = await supabase
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (error) throw error;
      await loadTickets();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      alert("Failed to delete ticket");
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

  const submitVote = async (ticketId: string, value: number | string) => {
    if (!participantId || value === "?") return;

    const numValue = typeof value === "number" ? value : 0;

    try {
      const { error } = await supabase.from("votes").upsert(
        {
          ticket_id: ticketId,
          participant_id: participantId,
          value: numValue,
        },
        {
          onConflict: "ticket_id,participant_id",
        }
      );

      if (error) throw error;

      setMyVotes({ ...myVotes, [ticketId]: numValue });

      // Auto-advance to next ticket
      if (currentTicketIndex < tickets.length - 1) {
        setTimeout(() => setCurrentTicketIndex(currentTicketIndex + 1), 500);
      }
    } catch (error) {
      console.error("Error submitting vote:", error);
      alert("Failed to submit vote");
    }
  };

  const handleFinish = () => {
    window.location.href = "/";
  };

  // Filter tickets for voting (exclude sensitive fields)
  const voterTickets: VoterTicket[] = tickets.map((ticket) => ({
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    title: ticket.title,
    jira_link: ticket.jira_link,
    total_votes: ticket.total_votes,
  }));

  if (voterTickets.length === 0) {
    // If session creator wants to manage tickets, show the manager
    if (isSessionCreator && showTicketManager) {
      return (
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {session?.name || "Voting Session"}
              </h1>
              <p className="text-gray-600 mt-2">No tickets yet</p>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setShowTicketManager(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Hide Ticket Manager
              </button>
              <button
                onClick={endSession}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                End Session
              </button>
            </div>
          </div>

          {/* Ticket Manager */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Ticket</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Ticket #"
                value={newTicket.ticket_number}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, ticket_number: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Title"
                value={newTicket.title}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, title: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Jira Link (optional)"
                value={newTicket.jira_link}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, jira_link: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={addTicket}
              disabled={
                isAddingTicket || !newTicket.ticket_number || !newTicket.title
              }
              className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              Add Ticket
            </button>

            {/* Participants Section */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                Participants ({participants.length})
              </h3>
              <ul className="space-y-2">
                {participants.map((participant) => (
                  <li
                    key={participant.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-gray-900">
                      {participant.user?.name || "Unknown User"}
                      {session?.created_by === participant.user_id && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Creator
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Show empty state
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center max-w-md">
          <p className="text-gray-600 mb-4">No tickets to vote on yet.</p>
          {isSessionCreator ? (
            <div className="space-y-4">
              <p className="text-gray-500">
                As the session creator, you can add tickets to get started.
              </p>
              <button
                onClick={() => setShowTicketManager(true)}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Add First Ticket
              </button>
            </div>
          ) : (
            <p className="text-gray-500">
              Waiting for session creator to add tickets...
            </p>
          )}
        </div>
      </div>
    );
  }

  const currentTicket = voterTickets[currentTicketIndex];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {session?.name || "Voting Session"}
          </h1>
          <p className="text-gray-600 mt-2">
            Progress: {currentTicketIndex + 1} / {voterTickets.length}
          </p>
        </div>
        <div className="space-x-2">
          {isSessionCreator && (
            <>
              <button
                onClick={() => setShowTicketManager(!showTicketManager)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {showTicketManager ? "Hide" : "Manage"} Tickets
              </button>
              <button
                onClick={endSession}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                End Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ticket Manager for Session Creator */}
      {isSessionCreator && showTicketManager && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Ticket</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Ticket #"
              value={newTicket.ticket_number}
              onChange={(e) =>
                setNewTicket({ ...newTicket, ticket_number: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Title"
              value={newTicket.title}
              onChange={(e) =>
                setNewTicket({ ...newTicket, title: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Jira Link (optional)"
              value={newTicket.jira_link}
              onChange={(e) =>
                setNewTicket({ ...newTicket, jira_link: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={addTicket}
            disabled={
              isAddingTicket || !newTicket.ticket_number || !newTicket.title
            }
            className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            Add Ticket
          </button>

          {/* Tickets Table */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">All Tickets</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Votes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Median
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Final
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {ticket.jira_link ? (
                          <a
                            href={ticket.jira_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {ticket.ticket_number}
                          </a>
                        ) : (
                          ticket.ticket_number
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {ticket.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {ticket.total_votes}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {ticket.median_value}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <input
                          type="number"
                          value={ticket.final_value}
                          onChange={(e) =>
                            updateFinalValue(
                              ticket.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => deleteTicket(ticket.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Participants Section */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">
              Participants ({participants.length})
            </h3>
            <ul className="space-y-2">
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-gray-900">
                    {participant.user?.name || "Unknown User"}
                    {session?.created_by === participant.user_id && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Creator
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${((currentTicketIndex + 1) / voterTickets.length) * 100}%`,
          }}
        />
      </div>

      {/* Current Ticket */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentTicket.ticket_number}
          </h2>
          <p className="text-lg text-gray-700">{currentTicket.title}</p>
          {currentTicket.jira_link && (
            <a
              href={currentTicket.jira_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline mt-2 inline-block"
            >
              View in Jira →
            </a>
          )}
          <p className="text-sm text-gray-500 mt-4">
            {currentTicket.total_votes} vote
            {currentTicket.total_votes !== 1 ? "s" : ""} submitted
          </p>
        </div>

        {/* Vote Options */}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
          {VOTE_OPTIONS.map((value) => (
            <button
              key={value}
              onClick={() => submitVote(currentTicket.id, value)}
              className={`
                py-4 px-2 rounded-lg font-semibold text-lg transition-all
                ${
                  myVotes[currentTicket.id] === value
                    ? "bg-blue-600 text-white shadow-lg scale-105"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }
              `}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() =>
            setCurrentTicketIndex(Math.max(0, currentTicketIndex - 1))
          }
          disabled={currentTicketIndex === 0}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        <div className="flex space-x-2">
          {voterTickets.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentTicketIndex(index)}
              className={`
                w-3 h-3 rounded-full transition-all
                ${
                  index === currentTicketIndex
                    ? "bg-blue-600"
                    : myVotes[voterTickets[index].id] !== undefined
                    ? "bg-green-500"
                    : "bg-gray-300"
                }
              `}
            />
          ))}
        </div>

        {currentTicketIndex === voterTickets.length - 1 ? (
          <button
            onClick={handleFinish}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Finish ✓
          </button>
        ) : (
          <button
            onClick={() =>
              setCurrentTicketIndex(
                Math.min(voterTickets.length - 1, currentTicketIndex + 1)
              )
            }
            disabled={currentTicketIndex === voterTickets.length - 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Your Votes Summary</h3>
        <div className="space-y-2">
          {voterTickets.map((ticket) => (
            <div key={ticket.id} className="flex justify-between items-center">
              <span className="text-gray-700">
                {ticket.ticket_number}: {ticket.title}
              </span>
              <span
                className={`font-semibold ${
                  myVotes[ticket.id] !== undefined
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {myVotes[ticket.id] !== undefined
                  ? myVotes[ticket.id]
                  : "Not voted"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
