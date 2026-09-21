"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { decryptChamaSlug } from "@/lib/encryption";
import { setPendingChamaInvite } from "@/lib/pendingInvite";

/**
 * Public invite entry: /invite/<encryptedToken>
 * - Logged in → open the chama details (join / request).
 * - Logged out → stash invite, send to signup / login.
 */
export default function ChamaInviteLanding() {
  const params = useParams<{ token: string }>();
  const encrypted = params?.token;
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [message, setMessage] = useState("Opening invite…");

  useEffect(() => {
    if (isLoading) return;
    if (!encrypted || typeof encrypted !== "string") {
      router.replace("/");
      return;
    }

    const token = decodeURIComponent(encrypted).trim();
    if (!token) {
      router.replace("/");
      return;
    }

    if (!isAuthenticated) {
      setPendingChamaInvite(token);
      setMessage("Sign in to view this chama…");
      router.replace("/");
      return;
    }

    const slug = (decryptChamaSlug(token) || token).trim();
    if (!slug) {
      router.replace("/MyChamas");
      return;
    }
    setMessage("Opening chama…");
    router.replace(`/Chama/${encodeURIComponent(slug)}`);
  }, [encrypted, isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-downy-50 px-6">
      <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      <p className="text-[13px] font-semibold text-downy-800 text-center">
        {message}
      </p>
    </div>
  );
}
