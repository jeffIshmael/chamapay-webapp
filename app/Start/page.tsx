"use client";

import AuthScreen from "../Components/AuthScreen";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Start = authenticated home entry; unauthenticated users see auth. */
const Page = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/MyChamas");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-downy-100 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return null;
};

export default Page;
