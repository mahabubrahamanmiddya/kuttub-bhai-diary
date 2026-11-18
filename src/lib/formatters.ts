/**
 * Formats a number to Indian Rupee currency style (e.g. ₹1,25,000 or ₹1,000)
 */
export function formatCurrency(amount: number | null | undefined, showDecimals = false): string {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showDecimals && val % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: showDecimals && val % 1 !== 0 ? 2 : 0,
  }).format(val);
}

/**
 * Formats date into Indian-friendly format (e.g. 17 Nov 2026)
 */
export function formatDate(dateStringOrDate: string | Date | null | undefined): string {
  if (!dateStringOrDate) return "-";
  const date = typeof dateStringOrDate === "string" ? new Date(dateStringOrDate) : dateStringOrDate;

  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Formats date and time (e.g. 17 Nov 2026, 03:30 PM)
 */
export function formatDateTime(dateStringOrDate: string | Date | null | undefined): string {
  if (!dateStringOrDate) return "-";
  const date = typeof dateStringOrDate === "string" ? new Date(dateStringOrDate) : dateStringOrDate;

  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Friendly relative label (e.g. "Today", "Yesterday", or "17 Nov")
 */
export function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return formatDate(date);
}

/**
 * Cleans an Indian phone number (removes spaces, dashes, +91)
 */
export function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

/**
 * Builds a WhatsApp payment reminder URL with personalized message
 */
export function generateWhatsAppReminderUrl({
  phone,
  customerName,
  amount,
  businessName,
}: {
  phone: string;
  customerName: string;
  amount: number;
  businessName: string;
}): string {
  const cleanPhone = cleanPhoneNumber(phone);
  const formattedAmount = formatCurrency(amount);

  const message = `Namaste ${customerName} ji 🙏,
Aapke hisaab ka kul baki balance ${formattedAmount} hai.
Kripya samay par bhugtan karke apna hisaab clear karein.

Dhanyawaad,
${businessName}`;

  return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
}
