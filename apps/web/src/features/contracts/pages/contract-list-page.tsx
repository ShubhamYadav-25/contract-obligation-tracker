import { Link } from "react-router-dom";
import { Upload } from "lucide-react";

import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { LoadingState } from "../../../components/feedback/loading-state.js";
import { RetryPanel } from "../../../components/feedback/retry-panel.js";
import { routePaths } from "../../../app/route-paths.js";
import { ContractList } from "../components/contract-list.js";
import { useContracts } from "../hooks/use-contracts.js";

export function ContractListPage() {
  const contracts = useContracts();

  return (
    <ContentContainer>
      <PageHeader
        actions={
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white transition hover:bg-teal-800 focus-visible:shadow-focus"
            to={routePaths.contractUpload}
          >
            <Upload aria-hidden size={16} />
            Upload
          </Link>
        }
        description="Track uploaded contracts through processing, review, and activation."
        title="Contracts"
      />
      {contracts.isLoading ? <LoadingState /> : null}
      {contracts.isError ? (
        <RetryPanel error={contracts.error} onRetry={() => void contracts.refetch()} />
      ) : null}
      {contracts.isSuccess ? <ContractList contracts={contracts.data} /> : null}
    </ContentContainer>
  );
}
