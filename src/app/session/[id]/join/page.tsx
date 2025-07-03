"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinSession({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    const joinSession = async () => {
      const userId = localStorage.getItem("userId");
      const userName = localStorage.getItem("userName");

      if (!userId || !userName) {
        router.push("/auth");
        return;
      }

      try {
        // Check if session exists
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", id)
          .eq("is_active", true)
          .single();

        if (sessionError || !session) {
          alert("Session not found or inactive");
          router.push("/");
          return;
        }

        // Check if already a participant
        const { data: existingParticipant } = await supabase
          .from("participants") // Use consistent table name
          .select("*")
          .eq("session_id", id)
          .eq("user_id", userId)
          .single();

        if (existingParticipant) {
          // Already joined, just update localStorage
          localStorage.setItem("participantId", existingParticipant.id);
        } else {
          // Create participant
          const { data: participant, error } = await supabase
            .from("participants") // Use consistent table name
            .insert({
              session_id: id,
              user_id: userId, // Use user_id, not name
            })
            .select()
            .single();

          if (error) throw error;

          localStorage.setItem("participantId", participant.id);
        }

        // Redirect to voting page
        router.push(`/session/${id}/vote`);
      } catch (error: any) {
        console.error("Error joining session:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        alert("Failed to join session");
        router.push("/");
      }
    };

    joinSession();
  }, [id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-600">Joining session...</p>
      </div>
    </div>
  );
}
