function getCurrentLocale() {
  return "en-US";
}

export function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatMoney(value: number | string | null | undefined, currency = "USD") {
  return new Intl.NumberFormat(getCurrentLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "No timestamp";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getCurrentLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function getOrderStatusTone(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "DELIVERED":
      return "success";
    case "PICKED_UP":
    case "OFFERED":
    case "ON_ROUTE":
      return "warning";
    case "FAILED":
    case "CANCELLED":
      return "danger";
    case "ASSIGNED":
    case "PLANNED":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatOrderStatus(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "MARKET_PENDING":
      return "Waiting for market";
    case "MARKET_ACCEPTED":
      return "Market accepted";
    case "READY_FOR_PICKUP":
      return "Ready for pickup";
    case "OFFERED":
      return "Driver offer sent";
    case "ASSIGNED":
      return "Driver assigned";
    case "PICKED_UP":
      return "Picked up";
    case "DELIVERED":
      return "Delivered";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status?.trim() || "Unknown";
  }
}
