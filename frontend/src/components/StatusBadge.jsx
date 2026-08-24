import { STATUS_LABEL } from "../lib/api";

const styles = {
  pending: "bg-muted text-muted-foreground border-border",
  ordered_to_company: "bg-blue-50 text-blue-700 border-blue-200",
  received: "bg-amber-50 text-amber-700 border-amber-200",
  partial: "bg-orange-50 text-orange-700 border-orange-200",
  dispatched: "bg-emerald-50 text-emerald-700 border-emerald-200",
  placed: "bg-blue-50 text-blue-700 border-blue-200",
};

export const StatusBadge = ({ status, testId }) => (
  <span
    data-testid={testId}
    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs whitespace-nowrap ${
      styles[status] || styles.pending
    }`}
  >
    {STATUS_LABEL[status] || status}
  </span>
);
