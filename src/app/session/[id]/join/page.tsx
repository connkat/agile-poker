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
    let isJoining = false; // Prevent multiple simultaneous joins

    const joinSession = async () => {
      if (isJoining) {
        console.log("Join already in progress, skipping...");
        return;
      }

      const userId = localStorage.getItem("userId");
      const userName = localStorage.getItem("userName");

      if (!userId || !userName) {
        router.push("/auth");
        return;
      }

      isJoining = true;
      console.log("Starting join process for user:", userId, "session:", id);

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

        console.log("Session found:", session.name);

        // Check if already a participant
        const { data: existingParticipants, error: checkError } = await supabase
          .from("participants")
          .select("*")
          .eq("session_id", id)
          .eq("user_id", userId);

        if (checkError) {
          console.error("Error checking existing participant:", checkError);
          throw checkError;
        }

        console.log("Existing participants found:", existingParticipants?.length || 0);

        if (existingParticipants && existingParticipants.length > 0) {
          // Already joined, just update localStorage
          console.log("Using existing participant:", existingParticipants[0].id);
          localStorage.setItem("participantId", existingParticipants[0].id);
        } else {
          // Create participant with upsert to handle race conditions
          console.log("Creating new participant...");
          const { data: participant, error } = await supabase
            .from("participants")
            .upsert({
              session_id: id,
              user_id: userId,
            }, {
              onConflict: "session_id,user_id",
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (error) {
            console.error("Error creating participant:", error);
            // If it's a duplicate key error, try to get the existing participant
            if (error.code === "23505") {
              console.log("Duplicate key error, fetching existing participant...");
              const { data: existingParticipant, error: fetchError } = await supabase
                .from("participants")
                .select("*")
                .eq("session_id", id)
                .eq("user_id", userId)
                .single();

              if (fetchError) {
                console.error("Error fetching existing participant:", fetchError);
                throw error; // Throw original error if we can't fetch
              }

              console.log("Found existing participant after duplicate error:", existingParticipant.id);
              localStorage.setItem("participantId", existingParticipant.id);
            } else {
              throw error;
            }
          } else {
            console.log("Created new participant:", participant.id);
            localStorage.setItem("participantId", participant.id);
          }
        }

        // Redirect to voting page
        console.log("Redirecting to voting page...");
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
      } finally {
        isJoining = false;
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
