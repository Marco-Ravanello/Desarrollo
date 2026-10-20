"use client";

import { CloseReopenCaseButton } from "@/components/cases/close-reopen-case";

export function CloseCaseButton({ caseId }: { caseId: string }) {
  return <CloseReopenCaseButton caseId={caseId} mode="close" compact />;
}
