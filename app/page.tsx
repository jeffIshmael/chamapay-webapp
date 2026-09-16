"use client";

import AuthScreen from "./Components/AuthScreen";
import OnboardingScreen, {
  hasSeenOnboarding,
} from "./Components/OnboardingScreen";
import { useAuth } from "./context/AuthContext";
import { useRouter } from "next/navigation";
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
      router.replace("/MyChamas");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-downy-50">
        <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-downy-50">
        <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  return <AuthScreen />;
}
