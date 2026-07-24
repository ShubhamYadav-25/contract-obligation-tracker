import { useMemo, useState } from "react";

import { InlineError } from "@/components/feedback/inline-error.js";
import { ContentContainer } from "@/components/layout/content-container.js";
import { PageHeader } from "@/components/layout/page-header.js";
import { Button } from "@/components/ui/button.js";
import { useContracts } from "@/features/contracts/hooks/use-contracts.js";
import {
  EmptyState,
  FilterBar,
  PaginationControls,
  SearchInput,
  SectionCard,
  TableSkeleton,
} from "../components.js";
import {
  RecentContractsTable,
  UploadContractDialog,
  contractToUploadRecord,
} from "../components/upload-contract-dialog.js";

const listPageSize = 10;

export function ContractsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const contracts = useContracts({
    search,
    limit: listPageSize + 1,
    offset: pageIndex * listPageSize,
  });
  const backendUploads = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const visibleUploads = backendUploads.slice(0, listPageSize);
  const hasUploads = visibleUploads.length > 0;
  const hasNextPage = backendUploads.length > listPageSize;
  const pageStart = pageIndex * listPageSize + 1;
  const pageEnd = pageIndex * listPageSize + visibleUploads.length;

  return (
    <ContentContainer>
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)} type="button">
            Upload Contract
          </Button>
        }
        description="Upload and monitor contracts through storage, parsing, OCR fallback, and text segmentation."
        title="Contracts"
      />
      <FilterBar>
        <SearchInput
          onChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          placeholder="Search contract name, file name, reference, or hash"
          value={search}
        />
        <Button
          disabled={!search && pageIndex === 0}
          onClick={() => {
            setSearch("");
            setPageIndex(0);
          }}
          type="button"
          variant="secondary"
        >
          Clear
        </Button>
      </FilterBar>
      <SectionCard
        description="Rows are loaded from the backend contract list endpoint for the current organization."
        title="Contracts"
      >
        {contracts.isLoading ? <TableSkeleton /> : null}
        {contracts.isError ? <InlineError error={contracts.error} /> : null}
        {!contracts.isLoading && hasUploads ? (
          <>
            <RecentContractsTable uploads={visibleUploads} />
            <PaginationControls
              label={`Showing ${pageStart}-${pageEnd}`}
              nextDisabled={!hasNextPage || contracts.isFetching}
              onNext={() => setPageIndex((current) => current + 1)}
              onPrevious={() => setPageIndex((current) => Math.max(current - 1, 0))}
              previousDisabled={pageIndex === 0 || contracts.isFetching}
            />
          </>
        ) : null}
        {!contracts.isLoading && !hasUploads ? (
          <EmptyState
            action={
              <Button onClick={() => setUploadOpen(true)} type="button">
                Upload Contract
              </Button>
            }
            title={search ? "No contracts match the current search." : "No contracts uploaded yet."}
          >
            {search
              ? "Change or clear the search to load other Postgres rows."
              : "Upload a PDF to begin tracking obligations."}
          </EmptyState>
        ) : null}
      </SectionCard>
      <UploadContractDialog onClose={() => setUploadOpen(false)} open={uploadOpen} />
    </ContentContainer>
  );
}
