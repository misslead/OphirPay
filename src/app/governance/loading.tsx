// SPDX-License-Identifier: MIT

import { Breadcrumb } from "@/components/Breadcrumb";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

/**
 * Route-level loading fallback for /governance.
 *
 * Without this file the route falls through to the root loading state
 * (`src/app/loading.tsx`), which does not match this page's shape. The
 * placeholder below mirrors it, so the transition does not shift the layout
 * (issue #786).
 */
export default function GovernanceLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb items={[{ label: "Governance" }]} />
      <LoadingSkeleton variant="card" lines={3} />
    </div>
  );
}
