"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const [tickets, setTickets] = useState<VoterTicket[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const pid = localStorage.getItem("participantId");
    if (!pid) {
      router.push(`/session/${id}/join`);
      return;
    }
    setParticipantId(pid);

    loadData();

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

  const loadData = async () => {
    await Promise.all([loadTickets(), loadMyVotes()]);
  };

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("id, ticket_number, title, jira_link, total_votes")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setTickets(data as VoterTicket[]);
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

  if (tickets.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">No tickets to vote on yet.</p>
          <p className="text-gray-500 mt-2">
            Waiting for admin to add tickets...
          </p>
        </div>
      </div>
    );
  }

  const currentTicket = tickets[currentTicketIndex];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Vote on Tickets</h1>
        <p className="text-gray-600 mt-2">
          Progress: {currentTicketIndex + 1} / {tickets.length}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${((currentTicketIndex + 1) / tickets.length) * 100}%`,
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
          {tickets.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentTicketIndex(index)}
              className={`
                w-3 h-3 rounded-full transition-all
                ${
                  index === currentTicketIndex
                    ? "bg-blue-600"
                    : myVotes[tickets[index].id] !== undefined
                    ? "bg-green-500"
                    : "bg-gray-300"
                }
              `}
            />
          ))}
        </div>

        <button
          onClick={() =>
            setCurrentTicketIndex(
              Math.min(tickets.length - 1, currentTicketIndex + 1)
            )
          }
          disabled={currentTicketIndex === tickets.length - 1}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>

      {/* Summary */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Your Votes Summary</h3>
        <div className="space-y-2">
          {tickets.map((ticket) => (
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
