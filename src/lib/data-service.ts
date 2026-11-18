import { isSupabaseConfigured, supabase } from "./supabase/client";
import {
  Business,
  Customer,
  Supplier,
  Transaction,
  Category,
  Profile,
  TransactionType,
  PaymentMethod,
  BalanceType,
} from "@/types/database";

const LOCAL_STORAGE_KEY_PREFIX = "kuttub_diary_";

// Memory cache fallback for immediate offline or unconfigured mode
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error("Local storage error:", err);
  }
}

export interface SyncItem {
  id: string;
  table: "customers" | "suppliers" | "transactions" | "categories" | "businesses";
  action: "insert" | "update" | "delete";
  data: any;
  timestamp: string;
  status: "pending" | "synced" | "error";
  errorMessage?: string;
}

export class DataService {
  private static instance: DataService;

  private constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.syncPendingQueue());
    }
  }

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  public isOnline(): boolean {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }

  public isCloudConnected(): boolean {
    return isSupabaseConfigured;
  }

  // --- Offline Queue Handling ---
  public getPendingSyncQueue(): SyncItem[] {
    return getLocalItem<SyncItem[]>("sync_queue", []);
  }

  private addToSyncQueue(item: Omit<SyncItem, "id" | "timestamp" | "status">): SyncItem {
    const queue = this.getPendingSyncQueue();
    const newItem: SyncItem = {
      ...item,
      id: "sync-" + Math.random().toString(36).substring(2, 10),
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    queue.push(newItem);
    setLocalItem("sync_queue", queue);
    return newItem;
  }

  public async syncPendingQueue(): Promise<{ synced: number; failed: number }> {
    if (!this.isOnline() || !isSupabaseConfigured || !supabase) {
      return { synced: 0, failed: 0 };
    }

    const queue = this.getPendingSyncQueue().filter((item) => item.status === "pending");
    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        if (item.action === "insert") {
          const { error } = await supabase.from(item.table).insert(item.data);
          if (error) throw error;
        } else if (item.action === "update") {
          const { error } = await supabase
            .from(item.table)
            .update(item.data)
            .eq("id", item.data.id);
          if (error) throw error;
        } else if (item.action === "delete") {
          const { error } = await supabase
            .from(item.table)
            .update({ is_deleted: true })
            .eq("id", item.data.id);
          if (error) throw error;
        }
        item.status = "synced";
        synced++;
      } catch (err: any) {
        console.error("Sync item failed:", item, err);
        item.status = "error";
        item.errorMessage = err.message || "Unknown error";
        failed++;
      }
    }

    // Keep only non-synced items or recent synced for log
    const remaining = this.getPendingSyncQueue().filter((i) => i.status !== "synced");
    setLocalItem("sync_queue", remaining);

    return { synced, failed };
  }

  // --- BUSINESS / PROFILE ---
  public async getBusiness(): Promise<Business | null> {
    if (isSupabaseConfigured && supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching business:", error);
      }
      if (data) return data;
    }

    // Fallback/Local business
    const local = getLocalItem<Business | null>("business", {
      id: "demo-biz-1",
      owner_id: "demo-user-1",
      business_name: "Kuttub Bhai Diary",
      phone: "9876543210",
      email: "kuttub@diary.local",
      address: "Shop No. 7, Market Road",
      currency: "INR",
      timezone: "Asia/Kolkata",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return local;
  }

  public async updateBusiness(business: Partial<Business> & { id: string }): Promise<Business> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("businesses")
        .update({
          business_name: business.business_name,
          phone: business.phone,
          email: business.email,
          address: business.address,
          currency: business.currency,
          timezone: business.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", business.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const current = (await this.getBusiness()) || ({} as Business);
    const updated = { ...current, ...business, updated_at: new Date().toISOString() };
    setLocalItem("business", updated);
    return updated;
  }

  // --- CUSTOMERS ---
  public async getCustomers(businessId: string): Promise<Customer[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_deleted", false)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    }

    const all = getLocalItem<Customer[]>("customers", [
      {
        id: "cust-demo-1",
        business_id: businessId,
        name: "Rahul Sharma",
        phone: "9876543210",
        address: "Main Bazar",
        notes: "Timely payer",
        opening_balance: 5000,
        opening_balance_type: "receivable",
        is_deleted: false,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: "cust-demo-2",
        business_id: businessId,
        name: "Amit Verma",
        phone: "9823456789",
        address: "Gandhi Nagar",
        notes: "Retail customer",
        opening_balance: 0,
        opening_balance_type: "receivable",
        is_deleted: false,
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ]);
    return all.filter((c) => c.business_id === businessId && !c.is_deleted);
  }

  public async getCustomerById(customerId: string): Promise<Customer | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Customer[]>("customers", []);
    return all.find((c) => c.id === customerId) || null;
  }

  public async createCustomer(
    customer: Omit<Customer, "id" | "created_at" | "updated_at" | "is_deleted">
  ): Promise<Customer> {
    const newRecord: Customer = {
      ...customer,
      id: "cust-" + Math.random().toString(36).substring(2, 10),
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          business_id: customer.business_id,
          name: customer.name.trim(),
          phone: customer.phone ? customer.phone.trim() : null,
          address: customer.address ? customer.address.trim() : null,
          notes: customer.notes ? customer.notes.trim() : null,
          opening_balance: Number(customer.opening_balance) || 0,
          opening_balance_type: customer.opening_balance_type || "receivable",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Save locally & queue for sync if Supabase configured
    const all = getLocalItem<Customer[]>("customers", []);
    all.push(newRecord);
    setLocalItem("customers", all);

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "customers", action: "insert", data: newRecord });
    }

    return newRecord;
  }

  public async updateCustomer(
    id: string,
    customer: Partial<Omit<Customer, "id" | "business_id">>
  ): Promise<Customer> {
    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("customers")
        .update({
          ...customer,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Customer[]>("customers", []);
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Customer not found");

    all[idx] = { ...all[idx], ...customer, updated_at: new Date().toISOString() };
    setLocalItem("customers", all);

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "customers", action: "update", data: all[idx] });
    }

    return all[idx];
  }

  public async softDeleteCustomer(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { error } = await supabase
        .from("customers")
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return true;
    }

    const all = getLocalItem<Customer[]>("customers", []);
    const idx = all.findIndex((c) => c.id === id);
    if (idx !== -1) {
      all[idx].is_deleted = true;
      all[idx].updated_at = new Date().toISOString();
      setLocalItem("customers", all);
    }

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "customers", action: "delete", data: { id } });
    }

    return true;
  }

  // --- SUPPLIERS ---
  public async getSuppliers(businessId: string): Promise<Supplier[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_deleted", false)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    }

    const all = getLocalItem<Supplier[]>("suppliers", [
      {
        id: "supp-demo-1",
        business_id: businessId,
        name: "ABC Wholesalers",
        phone: "9123456780",
        address: "Station Road",
        notes: "Primary raw goods vendor",
        opening_balance: 12000,
        opening_balance_type: "payable",
        is_deleted: false,
        created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
    ]);
    return all.filter((s) => s.business_id === businessId && !s.is_deleted);
  }

  public async getSupplierById(supplierId: string): Promise<Supplier | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .maybeSingle();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Supplier[]>("suppliers", []);
    return all.find((s) => s.id === supplierId) || null;
  }

  public async createSupplier(
    supplier: Omit<Supplier, "id" | "created_at" | "updated_at" | "is_deleted">
  ): Promise<Supplier> {
    const newRecord: Supplier = {
      ...supplier,
      id: "supp-" + Math.random().toString(36).substring(2, 10),
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          business_id: supplier.business_id,
          name: supplier.name.trim(),
          phone: supplier.phone ? supplier.phone.trim() : null,
          address: supplier.address ? supplier.address.trim() : null,
          notes: supplier.notes ? supplier.notes.trim() : null,
          opening_balance: Number(supplier.opening_balance) || 0,
          opening_balance_type: supplier.opening_balance_type || "payable",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Supplier[]>("suppliers", []);
    all.push(newRecord);
    setLocalItem("suppliers", all);

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "suppliers", action: "insert", data: newRecord });
    }

    return newRecord;
  }

  public async updateSupplier(
    id: string,
    supplier: Partial<Omit<Supplier, "id" | "business_id">>
  ): Promise<Supplier> {
    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("suppliers")
        .update({
          ...supplier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Supplier[]>("suppliers", []);
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Supplier not found");

    all[idx] = { ...all[idx], ...supplier, updated_at: new Date().toISOString() };
    setLocalItem("suppliers", all);

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "suppliers", action: "update", data: all[idx] });
    }

    return all[idx];
  }

  public async softDeleteSupplier(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return true;
    }

    const all = getLocalItem<Supplier[]>("suppliers", []);
    const idx = all.findIndex((s) => s.id === id);
    if (idx !== -1) {
      all[idx].is_deleted = true;
      all[idx].updated_at = new Date().toISOString();
      setLocalItem("suppliers", all);
    }

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "suppliers", action: "delete", data: { id } });
    }

    return true;
  }

  // --- TRANSACTIONS ---
  public async getTransactions(
    businessId: string,
    filters?: {
      customerId?: string;
      supplierId?: string;
      transactionType?: TransactionType;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Transaction[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("transactions")
        .select("*, customer:customers(*), supplier:suppliers(*)")
        .eq("business_id", businessId)
        .eq("is_deleted", false)
        .order("transaction_date", { ascending: false });

      if (filters?.customerId) query = query.eq("customer_id", filters.customerId);
      if (filters?.supplierId) query = query.eq("supplier_id", filters.supplierId);
      if (filters?.transactionType) query = query.eq("transaction_type", filters.transactionType);
      if (filters?.startDate) query = query.gte("transaction_date", filters.startDate);
      if (filters?.endDate) query = query.lte("transaction_date", filters.endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    let all = getLocalItem<Transaction[]>("transactions", [
      {
        id: "txn-demo-1",
        business_id: businessId,
        transaction_type: "sale",
        amount: 8000,
        transaction_date: new Date(Date.now() - 5 * 86400000).toISOString(),
        customer_id: "cust-demo-1",
        supplier_id: null,
        category_id: null,
        category_name: "General Sales",
        payment_method: "Other",
        description: "Goods sold on credit",
        attachment_url: null,
        is_deleted: false,
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      {
        id: "txn-demo-2",
        business_id: businessId,
        transaction_type: "customer_payment",
        amount: 5000,
        transaction_date: new Date(Date.now() - 2 * 86400000).toISOString(),
        customer_id: "cust-demo-1",
        supplier_id: null,
        category_id: null,
        category_name: null,
        payment_method: "Cash",
        description: "Payment received from Rahul",
        attachment_url: null,
        is_deleted: false,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: "txn-demo-3",
        business_id: businessId,
        transaction_type: "expense",
        amount: 1500,
        transaction_date: new Date().toISOString(),
        customer_id: null,
        supplier_id: null,
        category_id: null,
        category_name: "Electricity (बिजली बिल)",
        payment_method: "UPI",
        description: "Shop electricity bill",
        attachment_url: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "txn-demo-4",
        business_id: businessId,
        transaction_type: "income",
        amount: 12500,
        transaction_date: new Date().toISOString(),
        customer_id: null,
        supplier_id: null,
        category_id: null,
        category_name: "General Sales (बिक्री आय)",
        payment_method: "Cash",
        description: "Counter cash sales",
        attachment_url: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    all = all.filter((t) => t.business_id === businessId && !t.is_deleted);
    if (filters?.customerId) all = all.filter((t) => t.customer_id === filters.customerId);
    if (filters?.supplierId) all = all.filter((t) => t.supplier_id === filters.supplierId);
    if (filters?.transactionType) all = all.filter((t) => t.transaction_type === filters.transactionType);

    return all.sort(
      (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
    );
  }

  public async createTransaction(
    txn: Omit<Transaction, "id" | "created_at" | "updated_at" | "is_deleted">
  ): Promise<Transaction> {
    const newRecord: Transaction = {
      ...txn,
      id: "txn-" + Math.random().toString(36).substring(2, 10),
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          business_id: txn.business_id,
          transaction_type: txn.transaction_type,
          amount: Number(txn.amount),
          transaction_date: txn.transaction_date || new Date().toISOString(),
          customer_id: txn.customer_id || null,
          supplier_id: txn.supplier_id || null,
          category_id: txn.category_id || null,
          category_name: txn.category_name || null,
          payment_method: txn.payment_method || "Cash",
          description: txn.description ? txn.description.trim() : null,
          attachment_url: txn.attachment_url || null,
        })
        .select("*, customer:customers(*), supplier:suppliers(*)")
        .single();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Transaction[]>("transactions", []);
    all.unshift(newRecord);
    setLocalItem("transactions", all);

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "transactions", action: "insert", data: newRecord });
    }

    return newRecord;
  }

  public async updateTransaction(
    id: string,
    txn: Partial<Omit<Transaction, "id" | "business_id">>
  ): Promise<Transaction> {
    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          ...txn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*, customer:customers(*), supplier:suppliers(*)")
        .single();

      if (error) throw error;
      return data;
    }

    const all = getLocalItem<Transaction[]>("transactions", []);
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Transaction not found");

    all[idx] = { ...all[idx], ...txn, updated_at: new Date().toISOString() };
    setLocalItem("transactions", all);

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "transactions", action: "update", data: all[idx] });
    }

    return all[idx];
  }

  public async softDeleteTransaction(id: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { error } = await supabase
        .from("transactions")
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return true;
    }

    const all = getLocalItem<Transaction[]>("transactions", []);
    const idx = all.findIndex((t) => t.id === id);
    if (idx !== -1) {
      all[idx].is_deleted = true;
      all[idx].updated_at = new Date().toISOString();
      setLocalItem("transactions", all);
    }

    if (isSupabaseConfigured) {
      this.addToSyncQueue({ table: "transactions", action: "delete", data: { id } });
    }

    return true;
  }

  // --- CATEGORIES ---
  public async getCategories(businessId: string): Promise<Category[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("business_id", businessId)
        .order("name", { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) return data;
    }

    // Default categories list
    const defaults: Category[] = [
      { id: "cat-1", business_id: businessId, name: "Rent (किराया)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-2", business_id: businessId, name: "Electricity (बिजली बिल)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-3", business_id: businessId, name: "Transport (भाड़ा / परिवहन)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-4", business_id: businessId, name: "Salary / Wages (वेतन / मजदूरी)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-5", business_id: businessId, name: "Raw Material / Stock (माल खरीद)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-6", business_id: businessId, name: "Tea & Food (चाय / नाश्ता)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-7", business_id: businessId, name: "Marketing / Ads (प्रचार)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-8", business_id: businessId, name: "Mobile / Internet (मोबाइल / इंटरनेट)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-9", business_id: businessId, name: "General Expense (अन्य खर्च)", type: "expense", is_default: true, created_at: "" },
      { id: "cat-10", business_id: businessId, name: "General Sales (बिक्री आय)", type: "income", is_default: true, created_at: "" },
      { id: "cat-11", business_id: businessId, name: "Commission / Service (कमीशन)", type: "income", is_default: true, created_at: "" },
      { id: "cat-12", business_id: businessId, name: "Other Income (अन्य आय)", type: "income", is_default: true, created_at: "" },
    ];

    const localCats = getLocalItem<Category[]>("categories_" + businessId, defaults);
    return localCats;
  }

  public async createCategory(
    category: Omit<Category, "id" | "created_at">
  ): Promise<Category> {
    const newRecord: Category = {
      ...category,
      id: "cat-" + Math.random().toString(36).substring(2, 10),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && this.isOnline()) {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          business_id: category.business_id,
          name: category.name.trim(),
          type: category.type,
          is_default: category.is_default,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const current = await this.getCategories(category.business_id);
    current.push(newRecord);
    setLocalItem("categories_" + category.business_id, current);

    return newRecord;
  }
}

export const dataService = DataService.getInstance();
