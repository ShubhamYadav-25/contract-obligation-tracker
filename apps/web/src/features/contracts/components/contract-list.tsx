/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { EmptyState } from "@/components/feedback/empty-state.js";
import { ContractCard } from "./contract-card.js";
import type { ContractSummary } from "../types/contracts.js";

/**
 * @description Renders the contract list component for the contract tracker UI.
 * @param {{ readonly contracts: readonly ContractSummary[] }} { contracts } - Input value for { contracts }.
 * @returns {JSX.Element} Result of the contract list operation.
 */
export function ContractList({ contracts }: { readonly contracts: readonly ContractSummary[] }) {
  if (contracts.length === 0) {
    return (
      <EmptyState title="No contracts uploaded">
        Upload a contract PDF to start processing.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contracts.map((contract) => (
        <ContractCard contract={contract} key={contract.id} />
      ))}
    </div>
  );
}
