"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Home,
  List,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  formatAmount,
  formatDate,
  formatNumberInput,
  monthInputValue,
  parseAmountInput,
  todayDateInputValue
} from "@/lib/utils";
import type {
  PeriodFilter,
  Transaction,
  TransactionFormData,
  TransactionInsert,
  TransactionType,
  TypeFilter,
  ViewTab
} from "@/types";

const incomeCategories = ["급여", "부업", "용돈", "투자", "기타수익"];
const expenseCategories = ["식비", "교통", "주거", "통신", "쇼핑", "의료", "여가", "기타지출"];

const emptyForm = (type: TransactionType = "expense"): TransactionFormData => ({
  type,
  amount: "",
  category: "",
  transaction_date: todayDateInputValue(),
  memo: ""
});

interface Totals {
  income: number;
  expense: number;
  profit: number;
}

function calculateTotals(items: Transaction[]): Totals {
  // Supabase numeric 값은 환경에 따라 문자열처럼 들어올 수 있어 Number로 한 번 감싸서 계산합니다.
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return {
    income,
    expense,
    profit: income - expense
  };
}

function toPayload(form: TransactionFormData): TransactionInsert {
  return {
    type: form.type,
    amount: parseAmountInput(form.amount),
    category: form.category.trim(),
    transaction_date: form.transaction_date,
    memo: form.memo.trim() ? form.memo.trim() : null
  };
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<ViewTab>("home");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionFormData>(emptyForm());
  const [editingForm, setEditingForm] = useState<TransactionFormData>(emptyForm());
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState(monthInputValue());
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const loadTransactions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    // 서버 API Route 없이 브라우저에서 Supabase 테이블을 직접 조회합니다.
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setTransactions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const savedYears = transactions.map((item) => new Date(`${item.transaction_date}T00:00:00`).getFullYear());
    const uniqueYears = Array.from(new Set([currentYear, ...savedYears])).sort((a, b) => b - a);

    return uniqueYears;
  }, [transactions]);

  const currentMonthItems = useMemo(() => {
    const nowMonth = monthInputValue();
    return transactions.filter((item) => item.transaction_date.startsWith(nowMonth));
  }, [transactions]);

  const currentYearItems = useMemo(() => {
    const nowYear = String(new Date().getFullYear());
    return transactions.filter((item) => item.transaction_date.startsWith(nowYear));
  }, [transactions]);

  const monthlyTotals = useMemo(() => calculateTotals(currentMonthItems), [currentMonthItems]);
  const yearlyTotals = useMemo(() => calculateTotals(currentYearItems), [currentYearItems]);
  const allTotals = useMemo(() => calculateTotals(transactions), [transactions]);

  const filteredTransactions = useMemo(() => {
    // 목록 화면의 기간 필터와 수익/지출 필터를 클라이언트에서 함께 적용합니다.
    return transactions.filter((item) => {
      const periodMatched =
        periodFilter === "all" ||
        (periodFilter === "month" && item.transaction_date.startsWith(selectedMonth)) ||
        (periodFilter === "year" && item.transaction_date.startsWith(selectedYear));
      const typeMatched = typeFilter === "all" || item.type === typeFilter;

      return periodMatched && typeMatched;
    });
  }, [periodFilter, selectedMonth, selectedYear, transactions, typeFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);

    if (!supabase) {
      setErrorMessage(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.");
      return;
    }

    if (!payload.amount || !payload.category || !payload.transaction_date) {
      setErrorMessage("금액, 카테고리, 날짜를 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    // 저장 버튼을 누르면 Supabase transactions 테이블에 한 줄을 추가합니다.
    const { error } = await supabase.from("transactions").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setForm(emptyForm(form.type));
    setSaving(false);
    await loadTransactions();
    setActiveTab("list");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItem) {
      return;
    }

    const payload = toPayload(editingForm);

    if (!supabase) {
      setErrorMessage(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.");
      return;
    }

    if (!payload.amount || !payload.category || !payload.transaction_date) {
      setErrorMessage("수정할 금액, 카테고리, 날짜를 입력해주세요.");
      return;
    }

    setUpdating(true);
    setErrorMessage("");

    // 수정 모달에서 저장하면 선택한 id의 행만 업데이트합니다.
    const { error } = await supabase.from("transactions").update(payload).eq("id", editingItem.id);

    if (error) {
      setErrorMessage(error.message);
      setUpdating(false);
      return;
    }

    setEditingItem(null);
    setUpdating(false);
    await loadTransactions();
  }

  async function handleDelete(id: string) {
    if (!supabase) {
      setErrorMessage(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.");
      return;
    }

    const confirmed = window.confirm("정말 삭제하시겠습니까?");

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEditingItem(null);
    await loadTransactions();
  }

  function openEditModal(item: Transaction) {
    setEditingItem(item);
    setEditingForm({
      type: item.type,
      amount: formatNumberInput(String(Math.round(Number(item.amount)))),
      category: item.category,
      transaction_date: item.transaction_date,
      memo: item.memo ?? ""
    });
  }

  return (
    <main className="min-h-screen bg-app-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-app-background shadow-soft">
        <header className="sticky top-0 z-10 border-b border-app-line bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-normal text-app-ink">62팜 수익지출관리</h1>
              <p className="mt-1 text-sm text-app-muted">모바일 가계부</p>
            </div>
            <button
              aria-label="거래 새로고침"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-app-line bg-white text-app-ink"
              type="button"
              onClick={() => void loadTransactions()}
            >
              <Wallet size={20} />
            </button>
          </div>
        </header>

        <section className="flex-1 scroll-pb-40 px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-5">
          {errorMessage ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {activeTab === "home" ? (
            <HomeView monthlyTotals={monthlyTotals} yearlyTotals={yearlyTotals} allTotals={allTotals} />
          ) : null}

          {activeTab === "form" ? (
            <TransactionForm
              form={form}
              saving={saving}
              submitLabel="저장"
              onSubmit={handleCreate}
              onChange={setForm}
            />
          ) : null}

          {activeTab === "list" ? (
            <ListView
              filteredTransactions={filteredTransactions}
              loading={loading}
              periodFilter={periodFilter}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              typeFilter={typeFilter}
              years={years}
              onEdit={openEditModal}
              onPeriodFilterChange={setPeriodFilter}
              onSelectedMonthChange={setSelectedMonth}
              onSelectedYearChange={setSelectedYear}
              onTypeFilterChange={setTypeFilter}
            />
          ) : null}

          {activeTab === "stats" ? (
            <StatsView monthlyTotals={monthlyTotals} yearlyTotals={yearlyTotals} allTotals={allTotals} />
          ) : null}
        </section>

        <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {editingItem ? (
        <EditModal
          form={editingForm}
          itemId={editingItem.id}
          updating={updating}
          onChange={setEditingForm}
          onClose={() => setEditingItem(null)}
          onDelete={handleDelete}
          onSubmit={handleUpdate}
        />
      ) : null}
    </main>
  );
}

interface SummaryCardProps {
  title: string;
  totals: Totals;
}

function SummaryCard({ title, totals }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-app-line bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-app-ink">{title}</h2>
        <BarChart3 size={18} className="text-app-muted" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <AmountBlock label="수익" value={totals.income} tone="income" />
        <AmountBlock label="지출" value={totals.expense} tone="expense" />
        <AmountBlock label="순이익" value={totals.profit} tone={totals.profit >= 0 ? "income" : "expense"} />
      </div>
    </div>
  );
}

interface AmountBlockProps {
  label: string;
  value: number;
  tone: "income" | "expense";
}

function AmountBlock({ label, value, tone }: AmountBlockProps) {
  return (
    <div className="rounded-md bg-app-background p-3">
      <p className="text-xs text-app-muted">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold ${tone === "income" ? "text-app-income" : "text-app-expense"}`}>
        {formatAmount(value)}
      </p>
    </div>
  );
}

interface HomeViewProps {
  monthlyTotals: Totals;
  yearlyTotals: Totals;
  allTotals: Totals;
}

function HomeView({ monthlyTotals, yearlyTotals, allTotals }: HomeViewProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-app-ink px-5 py-6 text-white">
        <p className="text-sm text-white/70">이번 달 순이익</p>
        <p className="mt-2 text-3xl font-bold tracking-normal">{formatAmount(monthlyTotals.profit)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/60">수익</p>
            <p className="mt-1 font-semibold text-emerald-200">{formatAmount(monthlyTotals.income)}</p>
          </div>
          <div>
            <p className="text-white/60">지출</p>
            <p className="mt-1 font-semibold text-red-200">{formatAmount(monthlyTotals.expense)}</p>
          </div>
        </div>
      </section>
      <SummaryCard title="올해 요약" totals={yearlyTotals} />
      <SummaryCard title="전체 누적" totals={allTotals} />
    </div>
  );
}

interface TransactionFormProps {
  form: TransactionFormData;
  saving: boolean;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: TransactionFormData) => void;
}

function TransactionForm({ form, saving, submitLabel, onSubmit, onChange }: TransactionFormProps) {
  const categories = form.type === "income" ? incomeCategories : expenseCategories;

  function updateForm(field: keyof TransactionFormData, value: string) {
    onChange({ ...form, [field]: value });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1">
        <button
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            form.type === "income" ? "bg-app-income text-white" : "text-app-muted"
          }`}
          type="button"
          onClick={() => onChange({ ...form, type: "income", category: "" })}
        >
          수익
        </button>
        <button
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            form.type === "expense" ? "bg-app-expense text-white" : "text-app-muted"
          }`}
          type="button"
          onClick={() => onChange({ ...form, type: "expense", category: "" })}
        >
          지출
        </button>
      </div>

      <Field label="금액">
        <input
          className="w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
          inputMode="numeric"
          placeholder="예: 50,000"
          value={form.amount}
          onChange={(event) => updateForm("amount", formatNumberInput(event.target.value))}
        />
      </Field>

      <Field label="카테고리">
        <div className="grid grid-cols-3 gap-2">
          {categories.map((category) => (
            <button
              className={`rounded-md border px-3 py-2 text-sm ${
                form.category === category
                  ? "border-app-accent bg-blue-50 text-app-accent"
                  : "border-app-line bg-white text-app-ink"
              }`}
              key={category}
              type="button"
              onClick={() => updateForm("category", category)}
            >
              {category}
            </button>
          ))}
        </div>
        <input
          className="mt-2 w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
          placeholder="직접 입력"
          value={form.category}
          onChange={(event) => updateForm("category", event.target.value)}
        />
      </Field>

      <Field label="날짜">
        <input
          className="w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
          type="date"
          value={form.transaction_date}
          onChange={(event) => updateForm("transaction_date", event.target.value)}
        />
      </Field>

      <Field label="메모">
        <textarea
          className="min-h-24 w-full resize-none rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
          placeholder="선택사항"
          value={form.memo}
          onChange={(event) => updateForm("memo", event.target.value)}
        />
      </Field>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-md bg-app-ink px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={saving}
        type="submit"
      >
        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        {saving ? "저장 중" : submitLabel}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-app-ink">{label}</span>
      {children}
    </label>
  );
}

interface ListViewProps {
  filteredTransactions: Transaction[];
  loading: boolean;
  periodFilter: PeriodFilter;
  selectedMonth: string;
  selectedYear: string;
  typeFilter: TypeFilter;
  years: number[];
  onEdit: (item: Transaction) => void;
  onPeriodFilterChange: (value: PeriodFilter) => void;
  onSelectedMonthChange: (value: string) => void;
  onSelectedYearChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
}

function ListView({
  filteredTransactions,
  loading,
  periodFilter,
  selectedMonth,
  selectedYear,
  typeFilter,
  years,
  onEdit,
  onPeriodFilterChange,
  onSelectedMonthChange,
  onSelectedYearChange,
  onTypeFilterChange
}: ListViewProps) {
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-app-line bg-white p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "월별", value: "month" },
            { label: "연도별", value: "year" },
            { label: "전체", value: "all" }
          ].map((filter) => (
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                periodFilter === filter.value ? "bg-app-ink text-white" : "bg-app-background text-app-muted"
              }`}
              key={filter.value}
              type="button"
              onClick={() => onPeriodFilterChange(filter.value as PeriodFilter)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {periodFilter === "month" ? (
          <input
            className="w-full rounded-md border border-app-line px-4 py-3"
            type="month"
            value={selectedMonth}
            onChange={(event) => onSelectedMonthChange(event.target.value)}
          />
        ) : null}

        {periodFilter === "year" ? (
          <select
            className="w-full rounded-md border border-app-line px-4 py-3"
            value={selectedYear}
            onChange={(event) => onSelectedYearChange(event.target.value)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "전체", value: "all" },
            { label: "수익", value: "income" },
            { label: "지출", value: "expense" }
          ].map((filter) => (
            <button
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                typeFilter === filter.value ? "bg-app-accent text-white" : "bg-app-background text-app-muted"
              }`}
              key={filter.value}
              type="button"
              onClick={() => onTypeFilterChange(filter.value as TypeFilter)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-app-muted">
          <Loader2 className="animate-spin" size={18} />
          불러오는 중
        </div>
      ) : null}

      {!loading && filteredTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-app-line bg-white px-4 py-12 text-center text-app-muted">
          표시할 거래 내역이 없습니다.
        </div>
      ) : null}

      <div className="space-y-2">
        {filteredTransactions.map((item) => (
          <button
            className="w-full rounded-lg border border-app-line bg-white p-4 text-left"
            key={item.id}
            type="button"
            onClick={() => onEdit(item)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-app-muted">{formatDate(item.transaction_date)}</p>
                <p className="mt-1 font-semibold text-app-ink">{item.category}</p>
                {item.memo ? <p className="mt-1 break-words text-sm text-app-muted">{item.memo}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pencil size={14} className="text-app-muted" />
                <p className={`font-bold ${item.type === "income" ? "text-app-income" : "text-app-expense"}`}>
                  {item.type === "income" ? "+" : "-"}
                  {formatAmount(Number(item.amount))}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface StatsViewProps {
  monthlyTotals: Totals;
  yearlyTotals: Totals;
  allTotals: Totals;
}

function StatsView({ monthlyTotals, yearlyTotals, allTotals }: StatsViewProps) {
  return (
    <div className="space-y-4">
      <SummaryCard title="현재 월" totals={monthlyTotals} />
      <SummaryCard title="현재 연도" totals={yearlyTotals} />
      <SummaryCard title="전체 누적" totals={allTotals} />
    </div>
  );
}

interface EditModalProps {
  form: TransactionFormData;
  itemId: string;
  updating: boolean;
  onChange: (form: TransactionFormData) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function EditModal({ form, itemId, updating, onChange, onClose, onDelete, onSubmit }: EditModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-app-background p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-app-ink">거래 수정</h2>
          <button className="rounded-md px-3 py-2 text-sm text-app-muted" type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <TransactionForm form={form} saving={updating} submitLabel="수정 저장" onChange={onChange} onSubmit={onSubmit} />
        <button
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-4 font-bold text-app-expense"
          type="button"
          onClick={() => onDelete(itemId)}
        >
          <Trash2 size={18} />
          삭제
        </button>
      </div>
    </div>
  );
}

interface BottomNavigationProps {
  activeTab: ViewTab;
  onChange: (tab: ViewTab) => void;
}

function BottomNavigation({ activeTab, onChange }: BottomNavigationProps) {
  const tabs = [
    { label: "홈", value: "home", icon: Home },
    { label: "입력", value: "form", icon: Plus },
    { label: "목록", value: "list", icon: List },
    { label: "통계", value: "stats", icon: CalendarDays }
  ] as const;

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-app-line bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.value;

          return (
            <button
              className={`flex flex-col items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold ${
                selected ? "bg-app-ink text-white" : "text-app-muted"
              }`}
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
