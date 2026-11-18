import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, cleanPhoneNumber, generateWhatsAppReminderUrl } from "../formatters";

describe("Indian Formatters & WhatsApp Reminders", () => {
  it("formats Indian Rupee currency correctly with lakhs and crores grouping", () => {
    expect(formatCurrency(1000)).toMatch(/₹\s?1,000/);
    expect(formatCurrency(25000)).toMatch(/₹\s?25,000/);
    expect(formatCurrency(125000)).toMatch(/₹\s?1,25,000/);
    expect(formatCurrency(10000000)).toMatch(/₹\s?1,00,00,000/);
    expect(formatCurrency(0)).toMatch(/₹\s?0/);
  });

  it("formats dates into Indian friendly format", () => {
    const formatted = formatDate("2026-11-17T10:00:00Z");
    expect(formatted).toContain("17");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("2026");
  });

  it("cleans phone numbers and handles +91 prefix", () => {
    expect(cleanPhoneNumber("+91 98765 43210")).toBe("9876543210");
    expect(cleanPhoneNumber("919876543210")).toBe("9876543210");
    expect(cleanPhoneNumber("98765-43210")).toBe("9876543210");
  });

  it("generates personalized WhatsApp reminder URL with encoded message", () => {
    const url = generateWhatsAppReminderUrl({
      phone: "9876543210",
      customerName: "Ramesh Bhai",
      amount: 15000,
      businessName: "Kuttub Bhai Diary",
    });

    expect(url).toContain("https://wa.me/919876543210");
    expect(url).toContain(encodeURIComponent("Ramesh Bhai"));
    expect(url).toContain(encodeURIComponent("Kuttub Bhai Diary"));
  });
});
