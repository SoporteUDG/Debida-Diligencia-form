"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccessRestricted from "@/components/AccessRestricted";

export default function WelcomeHub() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const naturalToken = localStorage.getItem("udg_due_diligence_natural_token");
      const juridicaToken = localStorage.getItem("udg_due_diligence_juridica_token");

      if (naturalToken && !naturalToken.startsWith("draft-nat-")) {
        router.replace(`/persona-natural?token=${encodeURIComponent(naturalToken)}`);
        return;
      }

      if (juridicaToken && !juridicaToken.startsWith("draft-jur-")) {
        router.replace(`/persona-juridica?token=${encodeURIComponent(juridicaToken)}`);
        return;
      }

      setIsChecking(false);
    }
  }, [router]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#002b49] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c8a788] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <AccessRestricted />;
}
