export type AppLanguage = "en" | "ka";

export function toNumber(value: number | string | null | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toLocale(language: AppLanguage) {
  return language === "ka" ? "ka-GE" : "en-US";
}

export function formatMoney(value: number | string | null | undefined, language: AppLanguage, currency = "USD") {
  return new Intl.NumberFormat(toLocale(language), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatDateTime(value: string | null | undefined, language: AppLanguage) {
  if (!value) {
    return language === "ka" ? "დრო არ არის მითითებული" : "No timestamp";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(toLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getOrderStatusTone(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "DELIVERED":
      return "success";
    case "PICKED_UP":
    case "OFFERED":
    case "ON_ROUTE":
    case "ASSIGNED":
      return "warning";
    case "FAILED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatOrderStatus(status?: string | null, language: AppLanguage = "en") {
  const ka = language === "ka";

  switch ((status ?? "").toUpperCase()) {
    case "MARKET_PENDING":
      return ka ? "მარკეტს ელოდება" : "Waiting for market";
    case "MARKET_ACCEPTED":
      return ka ? "მარკეტმა მიიღო" : "Market accepted";
    case "READY_FOR_PICKUP":
      return ka ? "აყვანისთვის მზადაა" : "Ready for pickup";
    case "OFFERED":
      return ka ? "მძღოლს შეთავაზება გაეგზავნა" : "Driver offer sent";
    case "ASSIGNED":
      return ka ? "მძღოლი მინიჭებულია" : "Driver assigned";
    case "PICKED_UP":
      return ka ? "აღებულია" : "Picked up";
    case "DELIVERED":
      return ka ? "მიტანილია" : "Delivered";
    case "FAILED":
      return ka ? "ვერ შესრულდა" : "Failed";
    case "CANCELLED":
      return ka ? "გაუქმებულია" : "Cancelled";
    default:
      return status?.trim() || (ka ? "უცნობი" : "Unknown");
  }
}
