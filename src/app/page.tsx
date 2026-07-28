"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { LoadingScreen } from "@/components/Guard";

export default function RootPage() {
  const { hydrated, session } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(session ? "/dashboard" : "/login");
  }, [hydrated, session, router]);

  return <LoadingScreen />;
}
