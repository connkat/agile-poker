"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Session, Ticket, Participant } from "@/lib/types";

export default function AdminDashboard({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newTicket, setNewTicket] = useState({
    ticket_number: "",
    title: "",
    jira_link: "",
  });
  const [isAddingTicket, setIsAddingTicket] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Verify admin
    const adminId = localStorage.getItem("adminId");
    if (!adminId) {
      router.push("/");
      return;
    }

    loadSessionData();

    // Subscribe to real-time updates
    const ticketsSubscription = supabase
      .channel("tickets-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `session_id=eq.${params.id}`,
        },
        () => loadTickets()
      )
      .subscribe();

    const participantsSubscription = supabase
      .channel("participants-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${params.id}`,
        },
        () => loadParticipants()
      )
      .subscribe();

    return () => {
      ticketsSubscription.unsubscribe();
      participantsSubscription.unsubscribe();
    };
  }, [params.id, router]);

  const loadSessionData = async () => {
    await Promise.all([loadSession(), loadTickets(), loadParticipants()]);
  };

  const loadSession = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!error && data) {
      setSession(data);
    }
  };

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("session_id", params.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setTickets(data);
    }
  };

  const loadParticipants = async () => {
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .eq("session_id", params.id)
      .order("joined_at", { ascending: true });

    if (!error && data) {
      setParticipants(data);
    }
  };

  const addTicket = async () => {
    if (!newTicket.ticket_number || !newTicket.title) return;

    setIsAddingTicket(true);
    try {
      const { error } = await supabase.from("tickets").insert({
        session_id: params.id,
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

  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{session.name}</h1>
        <p className="text-gray-600 mt-2">
          Session ID:{" "}
          <code className="bg-gray-100 px-2 py-1 rounded">{params.id}</code>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets Section */}
        <div className="lg:col-span-2 space-y-6">
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
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                placeholder="Title"
                value={newTicket.title}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, title: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                placeholder="Jira Link (optional)"
                value={newTicket.jira_link}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, jira_link: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-md"
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
          </div>

          <div className="bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold p-6 pb-4">Tickets</h2>
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
                    </tr>
                  ))}
                </tbody>
              </table>
              {tickets.length === 0 && (
                <p className="text-center py-8 text-gray-500">No tickets yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Participants ({participants.length})
          </h2>
          <ul className="space-y-2">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center justify-between py-2"
              >
                <span className="text-gray-900">
                  {participant.name}
                  {participant.is_admin && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Admin
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
