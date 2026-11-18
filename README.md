# Kuttub Bhai Diary — Digital Business Hisaab-Kitaab

A modern, responsive, mobile-first **Business Accounting & Ledger Management Application** built for daily business bookkeeping. Designed specifically for Indian business owners with simple Hinglish/English intuitive navigation, Indian currency (`₹1,25,000`) and date (`17 Nov 2026`) formatting, and a cloud-first architecture.

---

## 🌟 Key Features

### 1. Cloud-First Single Source of Truth
- Powered by **Supabase PostgreSQL** with strict **Row Level Security (RLS)**.
- Data is **never** lost on browser refresh, tab close, app reinstall, or switching between smartphone and computer.
- Multi-tenant security: Users can only see, modify, and delete their own business records.

### 2. Double-Entry Accounting Engine (Section 16 & 40)
- **Customer Ledger (खातेदार / ग्राहक)**:
  - Credit Sale (`sale`): Increases Customer Receivable ("Lene Hain") & recognized as Sales revenue.
  - Customer Payment (`customer_payment`): Decreases Customer Receivable & increases Cash/Bank. Does **not** duplicate sales revenue!
  - Running balance ledger with Debit, Credit, and Balance.
  - One-click WhatsApp payment reminders with pre-filled courtesy messages.
- **Supplier Ledger (व्यापारी / सप्लायर)**:
  - Credit Purchase (`purchase`): Increases Supplier Payable ("Dene Hain") & recognized as purchase cost.
  - Supplier Payment (`supplier_payment`): Decreases Supplier Payable & decreases Cash/Bank. Does **not** duplicate expense!
  - Running balance ledger with Purchase, Paid, and Outstanding.
- **Direct Business Income & Expense**:
  - Direct cash sales / commission.
  - Categorized expenses (Rent, Electricity, Transport, Salary, Food/Tea, Material, etc.).
- **Net Profit**:
  - `Net Profit = Total Sales (Revenue) - Total Expenses (Costs)`.
  - Accurately distinguishes settlement payments from operational revenue/expense.

### 3. Mobile-First Modern Business Diary UI
- Designed with large touch targets, bold legible figures, and low cognitive load.
- Bottom Navigation bar on phones + Floating Action Button (**+ Naya Hisaab**).
- Collapsible desktop sidebar navigation.
- Hinglish subtitles for effortless clarity ("Customer se lene hain", "Supplier ko dene hain").

### 4. PWA (Installable Mobile App) & Offline Awareness
- Installable on Android (Chrome) and iPhone/iPad (Safari Add to Home Screen).
- Standalone experience with dedicated app icon and splash theme.
- Offline banner indicator ("You're offline").
- Clear sync status: Clearly distinguishes **Saved locally / Waiting to sync** from **Successfully synced to cloud**.
- Automatic background sync when internet connection is restored.

### 5. Safe Data Management & Backups
- **Delete Safety**: Destructive deletes are protected with confirmation modals and soft-deleting.
- **PDF Export**:
  - Beautiful printable Customer Ledger PDF statements.
  - Supplier Ledger PDF statements.
  - Full Business P&L Financial Report PDF.
- **CSV / Excel Export**: One-click export for all Transactions and Customer directories.

---

## 🚀 Quick Start

### 1. Installation & Local Development
```bash
# Clone the repository
cd Kuttub-Bhai-Diary

# Install dependencies
npm install

# Run automated accounting tests
npm test

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your browser or smartphone.

---

## 🗄️ Supabase Cloud Database Setup

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/migrations/20261117_initial_schema.sql` from this repository, copy all contents, and click **Run**.
4. In your project settings, copy:
   - `Project URL`
   - `anon public key`
5. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```
6. Restart the server (`npm run dev` or `npm run build && npm run start`).

*Note: If run without Supabase credentials, the application operates in local persistence mode with complete offline mock replication and displays a non-intrusive setup banner.*

---

## 📱 Installing on Smartphone (PWA)

### Android:
1. Open the website in **Google Chrome**.
2. Tap the three dots (menu) in the top-right corner.
3. Tap **"Install app"** or **"Add to Home Screen"**.
4. The app icon will appear on your phone's home screen.

### iPhone (iOS):
1. Open the website in **Safari**.
2. Tap the **Share** button (box with an upward arrow at the bottom).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"**.

---

## 🧪 Automated Accounting Unit Tests

To run the automated accounting and ledger calculation tests:
```bash
npm test
```

Verified scenarios include:
1. Customer buys on credit (Receivable increase)
2. Customer pays later (Receivable decrease without duplicating revenue)
3. Supplier purchase on credit (Payable increase)
4. Supplier payment later (Payable decrease without duplicating expense)
5. Direct cash sales and business expenses
6. Multiple transactions on single customer with running ledger
7. Opening balance handling (Receivable & Advance)
8. Soft-deleted transactions ignored from calculations
9. Indian currency number formatting (Lakhs & Crores grouping)
10. Personalized WhatsApp reminder URL generation
