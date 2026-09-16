"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Public chama explore is retired — chamas + goals live on Home. */
export default function ExploreRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/MyChamas");
  }, [router]);

  return (
    <div className="min-h-screen bg-downy-100 flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-downy-600 border-t-transparent animate-spin" />
    </div>
  );
}
