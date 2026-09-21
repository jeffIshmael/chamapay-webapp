"use client";

import AuthScreen from "./Components/AuthScreen";
import OnboardingScreen, {
  hasSeenOnboarding,
} from "./Components/OnboardingScreen";
import { useAuth } from "./context/AuthContext";
import { useRouter } from "next/navigation";
import { getPostAuthRedirect } from "@/lib/pendingInvite";
import { useEffect, useState } from "react";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    setShowOnboarding(!hasSeenOnboarding());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(getPostAuthRedirect());
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !ready) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-downy-50">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-downy-800">Loading…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-downy-50">
        <div className="h-9 w-9 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-downy-800">
          Taking you home…
        </p>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  return <AuthScreen />;
}
