import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewContractForm } from "./NewContractForm";

export default function NewContractPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.role !== "Sales" && session.role !== "Operations") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-df-text">New Contract Request</h1>
      <p className="text-sm text-slate-500 mt-1">
        Customer and vehicle data are pulled read-only from system records. Fill in the contract details below and
        save as Draft, or submit directly for Operations review.
      </p>
      <div className="mt-6">
        <NewContractForm role={session.role} />
      </div>
    </div>
  );
}
