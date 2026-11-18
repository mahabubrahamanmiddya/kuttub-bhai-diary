import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./formatters";
import { Business, Customer, Supplier, Transaction, OverallSummary } from "@/types/database";
import { buildCustomerLedger, buildSupplierLedger } from "./accounting";

export class ExportService {
  /**
   * Generates and downloads a customer ledger statement as PDF
   */
  public static exportCustomerLedgerPDF(
    business: Business,
    customer: Customer,
    transactions: Transaction[]
  ): void {
    const doc = new jsPDF();
    const ledger = buildCustomerLedger(customer, transactions);

    // Header - Business Details
    doc.setFontSize(18);
    doc.setTextColor(20, 83, 45); // Deep green
    doc.text(business.business_name, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [
        business.address || "",
        business.phone ? `Phone: ${business.phone}` : "",
        `Statement Date: ${formatDate(new Date())}`,
      ].filter(Boolean),
      14,
      28
    );

    // Customer Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 182, 28, 3, 3, "FD");

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Customer / Khaatedar: ${customer.name}`, 18, 52);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Mobile: ${customer.phone || "-"}`, 18, 59);
    doc.text(`Address: ${customer.address || "-"}`, 18, 66);

    // Outstanding summary on top right of box
    doc.setFontSize(10);
    doc.text("Remaining Balance:", 120, 52);
    doc.setFontSize(14);
    if (ledger.finalBalance > 0) {
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`${formatCurrency(ledger.finalBalance)} (Lene Hain)`, 120, 60);
    } else if (ledger.finalBalance < 0) {
      doc.setTextColor(22, 163, 74); // Green
      doc.text(`${formatCurrency(Math.abs(ledger.finalBalance))} (Advance)`, 120, 60);
    } else {
      doc.setTextColor(37, 99, 235); // Blue
      doc.text("₹0 (Settled)", 120, 60);
    }

    // Ledger Table
    const tableData = ledger.entries.map((entry) => [
      formatDate(entry.date),
      entry.description,
      entry.debit > 0 ? formatCurrency(entry.debit) : "-",
      entry.credit > 0 ? formatCurrency(entry.credit) : "-",
      formatCurrency(entry.balance),
    ]);

    autoTable(doc, {
      startY: 78,
      head: [["Date", "Details / Description", "Debit (+)", "Credit (-)", "Balance"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 64 },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;

    // Totals summary
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Debit (Purchases): ${formatCurrency(ledger.totalDebit)}`, 14, finalY);
    doc.text(`Total Credit (Paid): ${formatCurrency(ledger.totalCredit)}`, 14, finalY + 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Net Outstanding: ${formatCurrency(ledger.finalBalance)}`, 14, finalY + 14);

    // Footer note
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Thank you for your business. For any query regarding this hisaab, please contact us.",
      14,
      doc.internal.pageSize.getHeight() - 15
    );

    doc.save(`${customer.name.replace(/\s+/g, "_")}_Ledger_${formatDate(new Date())}.pdf`);
  }

  /**
   * Generates and downloads a supplier ledger statement as PDF
   */
  public static exportSupplierLedgerPDF(
    business: Business,
    supplier: Supplier,
    transactions: Transaction[]
  ): void {
    const doc = new jsPDF();
    const ledger = buildSupplierLedger(supplier, transactions);

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(business.business_name, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      [
        business.address || "",
        business.phone ? `Phone: ${business.phone}` : "",
        `Supplier Statement Date: ${formatDate(new Date())}`,
      ].filter(Boolean),
      14,
      28
    );

    // Supplier Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 182, 28, 3, 3, "FD");

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Supplier / Vendor: ${supplier.name}`, 18, 52);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Mobile: ${supplier.phone || "-"}`, 18, 59);
    doc.text(`Address: ${supplier.address || "-"}`, 18, 66);

    doc.setFontSize(10);
    doc.text("Payable Balance:", 120, 52);
    doc.setFontSize(14);
    if (ledger.finalBalance > 0) {
      doc.setTextColor(220, 38, 38);
      doc.text(`${formatCurrency(ledger.finalBalance)} (Dene Hain)`, 120, 60);
    } else {
      doc.setTextColor(22, 163, 74);
      doc.text(`${formatCurrency(Math.abs(ledger.finalBalance))} (Advance)`, 120, 60);
    }

    const tableData = ledger.entries.map((entry) => [
      formatDate(entry.date),
      entry.description,
      entry.credit > 0 ? formatCurrency(entry.credit) : "-",
      entry.debit > 0 ? formatCurrency(entry.debit) : "-",
      formatCurrency(entry.balance),
    ]);

    autoTable(doc, {
      startY: 78,
      head: [["Date", "Details / Description", "Purchase (+)", "Paid (-)", "Balance"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 64 },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Purchases: ${formatCurrency(ledger.totalCredit)}`, 14, finalY);
    doc.text(`Total Paid: ${formatCurrency(ledger.totalDebit)}`, 14, finalY + 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Net Payable: ${formatCurrency(ledger.finalBalance)}`, 14, finalY + 14);

    doc.save(`${supplier.name.replace(/\s+/g, "_")}_Supplier_Statement_${formatDate(new Date())}.pdf`);
  }

  /**
   * Exports full business financial report as PDF
   */
  public static exportBusinessReportPDF(
    business: Business,
    summary: OverallSummary,
    transactions: Transaction[],
    periodName: string
  ): void {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(20, 83, 45);
    doc.text(business.business_name, 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text(`Financial Performance & Hisab Report (${periodName})`, 14, 28);
    doc.setFontSize(9);
    doc.text(`Generated on: ${formatDate(new Date())}`, 14, 34);

    // Summary Cards Table
    const summaryRows = [
      ["Total Sales (Bikri)", formatCurrency(summary.total_sales)],
      ["Total Expenses (Kharche)", formatCurrency(summary.total_expenses)],
      ["Net Profit / Munafa", formatCurrency(summary.net_profit)],
      ["Total Customer Receivable (Lene Hain)", formatCurrency(summary.total_receivable)],
      ["Total Supplier Payable (Dene Hain)", formatCurrency(summary.total_payable)],
      ["Net Cash Flow in Period", formatCurrency(summary.cash_in_hand)],
    ];

    autoTable(doc, {
      startY: 40,
      head: [["Metric", "Amount"]],
      body: summaryRows,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        1: { halign: "right", fontStyle: "bold" },
      },
    });

    // Recent Transactions Table
    const startTxnY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Transactions in Period", 14, startTxnY);

    const txnRows = transactions.slice(0, 40).map((t) => [
      formatDate(t.transaction_date),
      t.transaction_type.toUpperCase().replace("_", " "),
      t.description || t.category_name || "-",
      t.payment_method,
      formatCurrency(t.amount),
    ]);

    autoTable(doc, {
      startY: startTxnY + 4,
      head: [["Date", "Type", "Particulars", "Method", "Amount"]],
      body: txnRows,
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        4: { halign: "right" },
      },
    });

    doc.save(`${business.business_name}_Report_${periodName.replace(/\s+/g, "_")}.pdf`);
  }

  /**
   * Exports transactions to CSV
   */
  public static exportTransactionsCSV(transactions: Transaction[]): void {
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Payment Method",
      "Customer",
      "Supplier",
      "Category",
      "Description",
    ];

    const rows = transactions.map((t) => [
      formatDate(t.transaction_date),
      t.transaction_type,
      t.amount,
      t.payment_method,
      t.customer?.name || "",
      t.supplier?.name || "",
      t.category_name || "",
      `"${(t.description || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Transactions_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Exports customer list to CSV
   */
  public static exportCustomersCSV(customers: any[]): void {
    const headers = [
      "Name",
      "Phone",
      "Address",
      "Current Balance",
      "Total Purchases",
      "Total Payments",
      "Status",
    ];

    const rows = customers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.phone || "",
      `"${(c.address || "").replace(/"/g, '""')}"`,
      c.current_balance,
      c.total_purchases,
      c.total_payments,
      c.current_balance > 0 ? "Lene Hain" : c.current_balance < 0 ? "Advance" : "Settled",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Customers_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
