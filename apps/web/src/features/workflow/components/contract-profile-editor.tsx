import { useEffect, useState } from "react";

import { InlineError } from "@/components/feedback/inline-error.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { useSaveContractProfile } from "../hooks/use-operations.js";
import type { z } from "zod";
import { contractProfileSchema } from "../api/operations.js";

type ContractProfile = z.infer<typeof contractProfileSchema>;

export function ContractProfileEditor({
  contractId,
  profile,
}: {
  readonly contractId: string;
  readonly profile?: ContractProfile | undefined;
}) {
  const save = useSaveContractProfile(contractId);
  const [editing, setEditing] = useState(false);
  const [parties, setParties] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [currency, setCurrency] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [renewalType, setRenewalType] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState("");

  useEffect(() => {
    setParties(profile?.parties.join(", ") ?? "");
    setContractValue(profile?.contractValue ?? "");
    setCurrency(profile?.currency ?? "");
    setEffectiveDate(profile?.effectiveDate ?? "");
    setExpirationDate(profile?.expirationDate ?? "");
    setRenewalType(profile?.renewalType ?? "");
    setNoticePeriodDays(profile?.noticePeriodDays?.toString() ?? "");
  }, [profile]);

  if (!editing) {
    return (
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setEditing(true)} type="button" variant="secondary">
          Customize contract profile
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(
          {
            contractId,
            create: !profile,
            parties: parties.split(",").map((item) => item.trim()).filter(Boolean),
            contractValue: contractValue || null,
            currency: currency ? currency.toUpperCase() : null,
            effectiveDate: effectiveDate || null,
            expirationDate: expirationDate || null,
            renewalType: renewalType || null,
            noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : null,
            nextObligationSummary: profile?.nextObligationSummary ?? null,
            extractionConfidence: profile?.extractionConfidence ?? null,
          },
          { onSuccess: () => setEditing(false) },
        );
      }}
    >
      <div className="mb-4">
        <h2 className="font-bold text-slate-950">Contract profile customization</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use comma-separated parties. Date ranges and currency codes are validated by the API.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Input aria-label="Contract parties" onChange={(e) => setParties(e.target.value)} placeholder="Supplier, Customer" value={parties} />
        <Input aria-label="Contract value" inputMode="decimal" onChange={(e) => setContractValue(e.target.value)} placeholder="Contract value" value={contractValue} />
        <Input aria-label="Currency" maxLength={3} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" value={currency} />
        <Input aria-label="Effective date" onChange={(e) => setEffectiveDate(e.target.value)} type="date" value={effectiveDate} />
        <Input aria-label="Expiration date" onChange={(e) => setExpirationDate(e.target.value)} type="date" value={expirationDate} />
        <Input aria-label="Renewal type" onChange={(e) => setRenewalType(e.target.value)} placeholder="Automatic / Manual" value={renewalType} />
        <Input aria-label="Notice period days" min={0} onChange={(e) => setNoticePeriodDays(e.target.value)} placeholder="Notice days" type="number" value={noticePeriodDays} />
      </div>
      {save.error ? <div className="mt-3"><InlineError error={save.error} /></div> : null}
      <div className="mt-4 flex gap-2">
        <Button disabled={save.isPending} type="submit">
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
        <Button disabled={save.isPending} onClick={() => setEditing(false)} type="button" variant="secondary">
          Cancel
        </Button>
      </div>
    </form>
  );
}
