"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setUserName(localStorage.getItem("userName"));
  }, [pathname]);

  const handleSignOut = () => {
    localStorage.clear();
    window.location.href = "/auth";
  };

  // Don't show header on auth page
  if (pathname === "/auth") return null;

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="font-semibold text-lg text-gray-900">
              Agile Poker
            </Link>
            <nav className="flex space-x-4">
              <Link
                href="/"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Home
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {userName && (
              <span className="text-sm text-gray-600">{userName}</span>
            )}
            <button
              onClick={handleSignOut}
              className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
