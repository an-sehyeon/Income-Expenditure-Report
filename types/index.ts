export type TransactionType = "income" | "expense";

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: Record<string, unknown> & {
          id: string;
          type: TransactionType;
          amount: number;
          category: string;
          transaction_date: string;
          memo: string | null;
          item_name: string | null;
          box_count: number | null;
          auction_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown> & {
          id?: string;
          type: TransactionType;
          amount: number;
          category: string;
          transaction_date: string;
          memo?: string | null;
          item_name?: string | null;
          box_count?: number | null;
          auction_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Record<string, unknown> & {
          id?: string;
          type?: TransactionType;
          amount?: number;
          category?: string;
          transaction_date?: string;
          memo?: string | null;
          item_name?: string | null;
          box_count?: number | null;
          auction_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
export type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export interface TransactionFormData {
  type: TransactionType;
  amount: string;
  category: string;
  item_name: string;
  box_count: string;
  auction_price: string;
  transaction_date: string;
  memo: string;
}

export type ViewTab = "home" | "form" | "list" | "stats";
export type TypeFilter = "all" | TransactionType;
export type PeriodFilter = "month" | "year" | "all";
