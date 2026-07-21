import { ContentContainer } from "../../../components/layout/content-container.js";
import { PageHeader } from "../../../components/layout/page-header.js";
import { Card } from "../../../components/ui/card.js";
import { useUploadContract } from "../hooks/use-upload-contract.js";
import { UploadForm } from "../components/upload-form.js";

export function ContractUploadPage() {
  const upload = useUploadContract();

  return (
    <ContentContainer className="max-w-3xl">
      <PageHeader
        description="Upload a PDF for backend parsing, extraction, source anchoring, and review."
        title="Upload contract"
      />
      <Card>
        <UploadForm
          error={upload.error}
          isSubmitting={upload.isPending}
          onSubmit={(file) => upload.mutate(file)}
        />
      </Card>
    </ContentContainer>
  );
}
