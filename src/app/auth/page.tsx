"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate email domain
    if (!email.endsWith("@metalab.com")) {
      setError("Incorrect email domain");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      // Check if user exists
      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email);

      if (checkError) {
        console.error("Error checking existing user:", checkError);
        throw checkError;
      }

      if (existingUsers && existingUsers.length > 0) {
        // User exists, update name if different
        const existingUser = existingUsers[0];
        if (existingUser.name !== name) {
          await supabase
            .from("users")
            .update({ name })
            .eq("id", existingUser.id);
        }
        localStorage.setItem("userId", existingUser.id);
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userName", name);
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({ email, name })
          .select()
          .single();

        if (createError) throw createError;

        localStorage.setItem("userId", newUser.id);
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userName", name);
      }

      router.push("/");
    } catch (err) {
      console.error("Auth error:", err);
      setError("Failed to authenticate");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Welcome to Agile Poker
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? "Loading..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
