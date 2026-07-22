import { useMemo } from "react";
import { useReviewCandidates } from "../../extraction-review/hooks/use-review-candidates.js";
import { ReviewCandidateCard } from "../../extraction-review/components/review-candidate-card.js";
import { approveReviewCandidate } from "../../extraction-review/api/approve-review-candidate.js";

export function CandidatesForContract({ contractId }: { readonly contractId: string }) {
  const all = useReviewCandidates();

  const candidates = useMemo(() => {
    if (!all.data) return [];
    return all.data.filter((c: any) => c.contractId === contractId);
  }, [all.data, contractId]);

  if (all.isLoading) return <div>Loading candidates...</div>;
  if (all.isError) return <div>Error loading candidates</div>;

  return (
    <div className="space-y-3">
      {candidates.length === 0 ? (
        <div className="text-sm text-muted">No extraction candidates for this contract.</div>
      ) : (
        candidates.map((c: any) => (
          <div key={c.id} className="grid gap-2 sm:grid-cols-[1fr_80px]">
            <ReviewCandidateCard candidate={c} />
            <div className="flex items-start gap-2">
              {c.sourceAnchors && c.sourceAnchors.length > 0 ? (
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => {
                    const a = c.sourceAnchors[0];
                    const id = `page-${a.pageNumber}-line-${a.startLine}`;
                    const el = document.getElementById(id);
                    if (el && typeof (el as any).scrollIntoView === 'function') {
                      (el as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
                      (el as any).style.outline = '3px solid rgba(14,165,233,0.6)';
                      setTimeout(() => ((el as any).style.outline = ''), 3000);
                    } else {
                      alert('Target text not found in document viewer');
                    }
                  }}
                >
                  Jump to source
                </button>
              ) : null}
              <button
                className="rounded-md bg-teal-600 px-3 py-2 text-sm text-white"
                onClick={async () => {
                  try {
                    await approveReviewCandidate(c.id, {} as any);
                    // crude: reload page
                    window.location.reload();
                  } catch (e) {
                    // swallow for now
                    // eslint-disable-next-line no-console
                    console.error(e);
                    alert('Failed to approve candidate');
                  }
                }}
              >
                Approve
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
