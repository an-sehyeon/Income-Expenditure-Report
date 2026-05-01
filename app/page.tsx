"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
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
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  formatAmount,
  formatDate,
  formatNumberInput,
  formatProfitRate,
  monthInputValue,
  parseAmountInput,
  safeInteger,
  safeNumber,
  todayDateInputValue
} from "@/lib/utils";
import type {
  Transaction,
  TransactionFormData,
  TransactionInsert,
  TransactionType,
  TypeFilter,
  ViewTab
} from "@/types";

const AUCTION_CATEGORY = "농산물경매";
const itemExamples = ["토마토", "딸기", "오이", "감자", "고추"];
const expenseCategories = ["식비", "교통", "주거", "통신", "의료", "인건비", "자제", "운송비", "장비수리", "기타지출"];
const chartColors = ["#108a5a", "#c24136", "#2563eb", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
const PAGE_SIZE = 1000;

const emptyForm = (type: TransactionType = "expense"): TransactionFormData => ({
  type,
  amount: "",
  category: "",
  item_name: "",
  box_count: "",
  auction_price: "",
  transaction_date: todayDateInputValue(),
  memo: ""
});

interface Totals {
  income: number;
  expense: number;
  profit: number;
  profitRate: number;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface CalendarDay {
  date: string;
  day: number;
  hasTransactions: boolean;
}

interface TransactionCounts {
  total: number;
  income: number;
  expense: number;
}

function calculateSummary(items: Transaction[]): Totals {
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const profit = income - expense;

  return {
    income,
    expense,
    profit,
    profitRate: income === 0 ? 0 : (profit / income) * 100
  };
}

function calculateCounts(items: Transaction[]): TransactionCounts {
  return {
    total: items.length,
    income: items.filter((item) => item.type === "income").length,
    expense: items.filter((item) => item.type === "expense").length
  };
}

function getIncomeAmount(form: TransactionFormData): number {
  const boxCount = safeInteger(form.box_count);
  const auctionPrice = parseAmountInput(form.auction_price);

  return boxCount * auctionPrice;
}

function toPayload(form: TransactionFormData): TransactionInsert {
  if (form.type === "income") {
    return {
      type: "income",
      amount: getIncomeAmount(form),
      category: AUCTION_CATEGORY,
      transaction_date: form.transaction_date,
      memo: form.memo.trim() ? form.memo.trim() : null,
      item_name: form.item_name.trim(),
      box_count: safeInteger(form.box_count),
      auction_price: parseAmountInput(form.auction_price)
    };
  }

  return {
    type: "expense",
    amount: parseAmountInput(form.amount),
    category: form.category.trim(),
    transaction_date: form.transaction_date,
    memo: form.memo.trim() ? form.memo.trim() : null,
    item_name: null,
    box_count: null,
    auction_price: null
  };
}

function getMonthKey(dateText: string): string {
  return dateText.slice(0, 7);
}

function getYearKey(dateText: string): string {
  return dateText.slice(0, 4);
}

function getDateKey(dateText: string): string {
  return dateText.slice(0, 10);
}

function getMonthNumber(monthValue: string): string {
  const monthPart = monthValue.includes("-") ? monthValue.slice(5, 7) : monthValue;

  return monthPart.padStart(2, "0").slice(-2);
}

function getMonthKeyFromParts(year: string, monthValue: string): string {
  return `${year}-${getMonthNumber(monthValue)}`;
}

function formatYearMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");

  return `${year}년 ${safeInteger(month)}월 요약`;
}

function getCurrentMonthLabel(): string {
  return `${new Date().getMonth() + 1}월`;
}

function getCalendarDays(monthKey: string, transactionsInMonth: Transaction[]): CalendarDay[] {
  const [yearText, monthText] = monthKey.split("-");
  const year = safeInteger(yearText);
  const month = safeInteger(monthText);
  const lastDay = new Date(year, month, 0).getDate();
  const transactionDates = new Set(transactionsInMonth.map((item) => getDateKey(item.transaction_date)));

  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;

    return {
      date,
      day,
      hasTransactions: transactionDates.has(date)
    };
  });
}

function getMonthStartBlankCount(monthKey: string): number {
  const [yearText, monthText] = monthKey.split("-");

  return new Date(safeInteger(yearText), safeInteger(monthText) - 1, 1).getDay();
}

function withChartColors(data: Omit<ChartData, "color">[]): ChartData[] {
  return data.map((item, index) => ({
    ...item,
    color: chartColors[index % chartColors.length]
  }));
}

function groupByAmount(items: Transaction[], getName: (item: Transaction) => string): ChartData[] {
  const grouped = new Map<string, number>();

  items.forEach((item) => {
    const name = getName(item).trim() || "미분류";
    grouped.set(name, (grouped.get(name) ?? 0) + safeNumber(item.amount));
  });

  return withChartColors(Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value));
}

function getAvailableYears(transactions: Transaction[]): number[] {
  const years = transactions
    .map((item) => safeInteger(getYearKey(item.transaction_date)))
    .filter((year) => year > 0);

  if (years.length === 0) {
    return [new Date().getFullYear()];
  }

  return Array.from(new Set(years)).sort((a, b) => b - a);
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState(monthInputValue());
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const allTransactions: Transaction[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const page = data ?? [];
      allTransactions.push(...page);

      if (page.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    const uniqueTransactions = new Map<string, Transaction>();
    const duplicateIds: string[] = [];

    allTransactions.forEach((transaction) => {
      if (uniqueTransactions.has(transaction.id)) {
        duplicateIds.push(transaction.id);
        return;
      }

      uniqueTransactions.set(transaction.id, transaction);
    });

    const dedupedTransactions = Array.from(uniqueTransactions.values());
    const duplicateShortIds = duplicateIds.map((id) => id.slice(0, 8));

    if (process.env.NODE_ENV === "development") {
      console.log("[transactions] fetched count:", allTransactions.length);
      console.log("[transactions] unique count:", dedupedTransactions.length);
      console.log("[transactions] duplicate ids:", duplicateShortIds);
      console.log("[transactions] available years:", getAvailableYears(dedupedTransactions));
    }

    setTransactions(dedupedTransactions);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const years = useMemo(() => {
    return getAvailableYears(transactions);
  }, [transactions]);

  useEffect(() => {
    if (years.length === 0 || years.includes(safeInteger(selectedYear))) {
      return;
    }

    const nextYear = String(years[0]);
    setSelectedYear(nextYear);
    setSelectedMonth(getMonthKeyFromParts(nextYear, selectedMonth));
    setSelectedDate(null);
  }, [selectedMonth, selectedYear, years]);

  const selectedMonthKey = useMemo(
    () => getMonthKeyFromParts(selectedYear, selectedMonth),
    [selectedMonth, selectedYear]
  );

  const currentMonthItems = useMemo(
    () => transactions.filter((item) => getMonthKey(item.transaction_date) === monthInputValue()),
    [transactions]
  );
  const selectedMonthTransactions = useMemo(
    () => transactions.filter((item) => getMonthKey(item.transaction_date) === selectedMonthKey),
    [selectedMonthKey, transactions]
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[transactions] selected month:", selectedMonthKey, "count:", selectedMonthTransactions.length);
    }
  }, [selectedMonthTransactions.length, selectedMonthKey]);
  const selectedYearItems = useMemo(
    () => transactions.filter((item) => getYearKey(item.transaction_date) === selectedYear),
    [selectedYear, transactions]
  );
  const selectedDateItems = useMemo(
    () =>
      selectedDate
        ? selectedMonthTransactions.filter((item) => getDateKey(item.transaction_date) === selectedDate)
        : selectedMonthTransactions,
    [selectedDate, selectedMonthTransactions]
  );

  const monthlyTotals = useMemo(() => calculateSummary(currentMonthItems), [currentMonthItems]);
  const allTotals = useMemo(() => calculateSummary(transactions), [transactions]);
  const listTotals = useMemo(() => calculateSummary(selectedDateItems), [selectedDateItems]);
  const listCounts = useMemo(() => calculateCounts(selectedDateItems), [selectedDateItems]);
  const selectedMonthSummary = useMemo(() => calculateSummary(selectedMonthTransactions), [selectedMonthTransactions]);
  const selectedMonthCounts = useMemo(() => calculateCounts(selectedMonthTransactions), [selectedMonthTransactions]);
  const selectedYearSummary = useMemo(() => calculateSummary(selectedYearItems), [selectedYearItems]);
  const calendarDays = useMemo(
    () => getCalendarDays(selectedMonthKey, selectedMonthTransactions),
    [selectedMonthKey, selectedMonthTransactions]
  );
  const monthStartBlankCount = useMemo(() => getMonthStartBlankCount(selectedMonthKey), [selectedMonthKey]);

  const filteredTransactions = useMemo(() => {
    return selectedDateItems.filter((item) => {
      const typeMatched = typeFilter === "all" || item.type === typeFilter;

      return typeMatched;
    });
  }, [selectedDateItems, typeFilter]);

  const monthlyExpenseCategoryData = useMemo(
    () => groupByAmount(selectedMonthTransactions.filter((item) => item.type === "expense"), (item) => item.category),
    [selectedMonthTransactions]
  );
  const currentMonthItemSalesData = useMemo(
    () =>
      groupByAmount(
        currentMonthItems.filter((item) => item.type === "income" && Boolean(item.item_name?.trim())),
        (item) => item.item_name ?? ""
      ),
    [currentMonthItems]
  );
  const monthlyItemSalesData = useMemo(
    () =>
      groupByAmount(
        selectedMonthTransactions.filter((item) => item.type === "income" && Boolean(item.item_name?.trim())),
        (item) => item.item_name ?? ""
      ),
    [selectedMonthTransactions]
  );
  function handleSelectedMonthChange(value: string) {
    const nextMonthKey = getMonthKeyFromParts(value.slice(0, 4), value);
    setSelectedMonth(nextMonthKey);
    setSelectedYear(value.slice(0, 4));
    setSelectedDate(null);
  }

  function handleSelectedYearChange(value: string) {
    setSelectedYear(value);
    setSelectedMonth(getMonthKeyFromParts(value, selectedMonth));
    setSelectedDate(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setErrorMessage(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.");
      return;
    }

    const payload = toPayload(form);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setSaving(true);
    setErrorMessage("");

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

    if (!editingItem || !supabase) {
      return;
    }

    const payload = toPayload(editingForm);
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setUpdating(true);
    setErrorMessage("");

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

    if (!window.confirm("정말 삭제하시겠습니까?")) {
      return;
    }

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
      amount: item.type === "expense" ? formatNumberInput(String(Math.round(safeNumber(item.amount)))) : "",
      category: item.type === "expense" ? item.category : "",
      item_name: item.item_name ?? "",
      box_count: item.box_count ? String(item.box_count) : "",
      auction_price: item.auction_price ? formatNumberInput(String(Math.round(safeNumber(item.auction_price)))) : "",
      transaction_date: item.transaction_date,
      memo: item.memo ?? ""
    });
  }

  return (
    <main className="min-h-screen bg-app-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-app-background shadow-soft">
        <header className="sticky top-0 z-10 border-b border-app-line bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                alt="62팜 사진"
                className="h-12 w-12 shrink-0 rounded-full border border-app-line object-cover"
                height={48}
                src="/images/62farm.jpg"
                width={48}
              />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-normal text-app-ink">기선이네 수익지출관리</h1>
                <p className="mt-1 text-sm text-app-muted">매출과 지출 관리</p>
              </div>
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
            <HomeView monthLabel={getCurrentMonthLabel()} totals={monthlyTotals} itemSales={currentMonthItemSalesData} />
          ) : null}

          {activeTab === "form" ? (
            <TransactionForm form={form} saving={saving} submitLabel="저장" onSubmit={handleCreate} onChange={setForm} />
          ) : null}

          {activeTab === "list" ? (
            <ListView
              filteredTransactions={filteredTransactions}
              calendarDays={calendarDays}
              counts={listCounts}
              loading={loading}
              listTotals={listTotals}
              monthStartBlankCount={monthStartBlankCount}
              selectedDate={selectedDate}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              typeFilter={typeFilter}
              years={years}
              onEdit={openEditModal}
              onClearSelectedDate={() => setSelectedDate(null)}
              onSelectedDateChange={setSelectedDate}
              onSelectedMonthChange={handleSelectedMonthChange}
              onSelectedYearChange={handleSelectedYearChange}
              onTypeFilterChange={setTypeFilter}
            />
          ) : null}

          {activeTab === "stats" ? (
            <StatsView
              allTotals={allTotals}
              expenseCategoryData={monthlyExpenseCategoryData}
              itemSalesData={monthlyItemSalesData}
              selectedMonth={selectedMonthKey}
              selectedMonthCounts={selectedMonthCounts}
              selectedMonthSummary={selectedMonthSummary}
              selectedYear={selectedYear}
              selectedYearSummary={selectedYearSummary}
              years={years}
              onSelectedMonthChange={handleSelectedMonthChange}
              onSelectedYearChange={handleSelectedYearChange}
            />
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

function validatePayload(payload: TransactionInsert): string {
  if (!payload.transaction_date) {
    return "날짜를 입력해주세요.";
  }

  if (payload.type === "income") {
    if (!payload.item_name?.trim()) {
      return "품목명을 입력해주세요.";
    }
    if (!payload.box_count || payload.box_count < 1) {
      return "박스 개수는 1 이상으로 입력해주세요.";
    }
    if (payload.auction_price === null || payload.auction_price === undefined || payload.auction_price < 0) {
      return "경매 단가는 0 이상으로 입력해주세요.";
    }
  }

  if (payload.type === "expense") {
    if (!payload.category.trim()) {
      return "지출 카테고리를 입력해주세요.";
    }
    if (payload.amount < 0) {
      return "지출 금액은 0 이상으로 입력해주세요.";
    }
  }

  return "";
}

interface SummaryCardProps {
  title: string;
  subtitle?: string;
  totals: Totals;
  counts?: TransactionCounts;
}

function SummaryCard({ title, subtitle, totals, counts }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-app-line bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-app-ink">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-app-muted">{subtitle}</p> : null}
        </div>
        <BarChart3 size={18} className="text-app-muted" />
      </div>
      {counts ? <CountBadges counts={counts} /> : null}
      <div className="grid grid-cols-2 gap-2 text-center">
        <AmountBlock label="총매출" value={totals.income} tone="income" />
        <AmountBlock label="총지출" value={totals.expense} tone="expense" />
        <AmountBlock label="순이익" value={totals.profit} tone={totals.profit >= 0 ? "income" : "expense"} />
        <RateBlock label="이익률" value={totals.profitRate} />
      </div>
    </div>
  );
}

function CountBadges({ counts }: { counts: TransactionCounts }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
      <span className="rounded-md bg-app-background px-2 py-2 font-semibold text-app-ink">총 거래 {counts.total}건</span>
      <span className="rounded-md bg-emerald-50 px-2 py-2 font-semibold text-app-income">수익 {counts.income}건</span>
      <span className="rounded-md bg-red-50 px-2 py-2 font-semibold text-app-expense">지출 {counts.expense}건</span>
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

interface RateBlockProps {
  label: string;
  value: number;
}

function RateBlock({ label, value }: RateBlockProps) {
  return (
    <div className="rounded-md bg-app-background p-3">
      <p className="text-xs text-app-muted">{label}</p>
      <p className={`mt-1 text-sm font-bold ${value >= 0 ? "text-app-income" : "text-app-expense"}`}>
        {formatProfitRate(value)}
      </p>
    </div>
  );
}

interface HomeViewProps {
  monthLabel: string;
  totals: Totals;
  itemSales: ChartData[];
}

function HomeView({ monthLabel, totals, itemSales }: HomeViewProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-app-ink px-5 py-6 text-white">
        <p className="text-sm text-white/70">{monthLabel} 순이익</p>
        <p className="mt-2 text-3xl font-bold tracking-normal">{formatAmount(totals.profit)}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/60">{monthLabel} 총매출</p>
            <p className="mt-1 font-semibold text-emerald-200">{formatAmount(totals.income)}</p>
          </div>
          <div>
            <p className="text-white/60">{monthLabel} 총지출</p>
            <p className="mt-1 font-semibold text-red-200">{formatAmount(totals.expense)}</p>
          </div>
          <div>
            <p className="text-white/60">{monthLabel} 이익률</p>
            <p className="mt-1 font-semibold text-blue-100">{formatProfitRate(totals.profitRate)}</p>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-app-line bg-white p-4">
        <h2 className="text-base font-semibold text-app-ink">주요 품목별 매출 요약</h2>
        {itemSales.length === 0 ? (
          <p className="mt-4 text-sm text-app-muted">표시할 데이터가 없습니다.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {itemSales.slice(0, 5).map((item) => (
              <div className="flex items-center justify-between gap-3 text-sm" key={item.name}>
                <span className="font-medium text-app-ink">{item.name}</span>
                <span className="font-bold text-app-income">{formatAmount(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
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
  const totalSales = getIncomeAmount(form);
  const boxCount = safeInteger(form.box_count);
  const auctionPrice = parseAmountInput(form.auction_price);

  function updateForm(field: keyof TransactionFormData, value: string) {
    onChange({ ...form, [field]: value });
  }

  function changeType(type: TransactionType) {
    onChange({
      ...emptyForm(type),
      transaction_date: form.transaction_date,
      memo: form.memo
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-white p-1">
        <button
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            form.type === "income" ? "bg-app-income text-white" : "text-app-muted"
          }`}
          type="button"
          onClick={() => changeType("income")}
        >
          수익
        </button>
        <button
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            form.type === "expense" ? "bg-app-expense text-white" : "text-app-muted"
          }`}
          type="button"
          onClick={() => changeType("expense")}
        >
          지출
        </button>
      </div>

      {form.type === "income" ? (
        <>
          <Field label="품목명">
            <input
              className="w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
              placeholder="예: 토마토"
              value={form.item_name}
              onChange={(event) => updateForm("item_name", event.target.value)}
            />
            <div className="mt-2 grid grid-cols-5 gap-1">
              {itemExamples.map((item) => (
                <button
                  className="rounded-md border border-app-line bg-white px-2 py-2 text-xs text-app-ink"
                  key={item}
                  type="button"
                  onClick={() => updateForm("item_name", item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>
          <Field label="박스 개수">
            <input
              className="w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
              inputMode="numeric"
              placeholder="예: 10"
              value={form.box_count}
              onChange={(event) => updateForm("box_count", event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="경매 단가">
            <input
              className="w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
              inputMode="numeric"
              placeholder="예: 25,000"
              value={form.auction_price}
              onChange={(event) => updateForm("auction_price", formatNumberInput(event.target.value))}
            />
          </Field>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">총 매출액 자동 계산</p>
            <p className="mt-2 text-lg font-bold text-app-income">
              {boxCount.toLocaleString("ko-KR")}박스 x {formatAmount(auctionPrice)} = {formatAmount(totalSales)}
            </p>
          </div>
        </>
      ) : (
        <>
          <Field label="지출 카테고리">
            <div className="grid grid-cols-3 gap-2">
              {expenseCategories.map((category) => (
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
          <Field label="지출 금액">
            <input
              className="w-full rounded-md border border-app-line bg-white px-4 py-3 text-base outline-none focus:border-app-accent"
              inputMode="numeric"
              placeholder="예: 80,000"
              value={form.amount}
              onChange={(event) => updateForm("amount", formatNumberInput(event.target.value))}
            />
          </Field>
        </>
      )}

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
  calendarDays: CalendarDay[];
  counts: TransactionCounts;
  loading: boolean;
  listTotals: Totals;
  monthStartBlankCount: number;
  selectedDate: string | null;
  selectedMonth: string;
  selectedYear: string;
  typeFilter: TypeFilter;
  years: number[];
  onEdit: (item: Transaction) => void;
  onClearSelectedDate: () => void;
  onSelectedDateChange: (value: string) => void;
  onSelectedMonthChange: (value: string) => void;
  onSelectedYearChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
}

function ListView({
  filteredTransactions,
  calendarDays,
  counts,
  loading,
  listTotals,
  monthStartBlankCount,
  selectedDate,
  selectedMonth,
  selectedYear,
  typeFilter,
  years,
  onEdit,
  onClearSelectedDate,
  onSelectedDateChange,
  onSelectedMonthChange,
  onSelectedYearChange,
  onTypeFilterChange
}: ListViewProps) {
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-app-line bg-white p-4">
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
        <input
          className="w-full rounded-md border border-app-line px-4 py-3"
          type="month"
          value={selectedMonth}
          onChange={(event) => onSelectedMonthChange(event.target.value)}
        />
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

      <CalendarFilter
        days={calendarDays}
        monthStartBlankCount={monthStartBlankCount}
        selectedDate={selectedDate}
        onClear={onClearSelectedDate}
        onSelectDate={onSelectedDateChange}
      />

      <SummaryCard
        title={selectedDate ? `${formatDate(selectedDate)} 요약` : `${selectedMonth} 월 전체 요약`}
        totals={listTotals}
        counts={counts}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-app-muted">
          <Loader2 className="animate-spin" size={18} />
          불러오는 중
        </div>
      ) : null}

      {!loading && filteredTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-app-line bg-white px-4 py-12 text-center text-app-muted">
          표시할 데이터가 없습니다.
        </div>
      ) : null}

      <div className="space-y-2">
        {filteredTransactions.map((item) => (
          <TransactionListItem item={item} key={item.id} onEdit={onEdit} />
        ))}
      </div>

      <div className="pointer-events-none fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-5">
        <button
          className="pointer-events-auto ml-auto flex items-center gap-2 rounded-full bg-app-ink px-4 py-3 text-sm font-bold text-white shadow-soft"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp size={16} />
          상단
        </button>
      </div>
    </div>
  );
}

interface CalendarFilterProps {
  days: CalendarDay[];
  monthStartBlankCount: number;
  selectedDate: string | null;
  onClear: () => void;
  onSelectDate: (value: string) => void;
}

function CalendarFilter({ days, monthStartBlankCount, selectedDate, onClear, onSelectDate }: CalendarFilterProps) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <section className="rounded-lg border border-app-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-app-ink">일자별 조회</h2>
        <button className="rounded-md bg-app-background px-3 py-2 text-xs font-semibold text-app-muted" type="button" onClick={onClear}>
          월 전체 보기
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-app-muted">
        {weekdays.map((weekday) => (
          <div className="py-1" key={weekday}>
            {weekday}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: monthStartBlankCount }, (_, index) => (
          <div className="aspect-square" key={`blank-${index}`} />
        ))}
        {days.map((day) => {
          const selected = selectedDate === day.date;

          return (
            <button
              className={`relative aspect-square rounded-md border text-sm font-semibold ${
                selected
                  ? "border-app-accent bg-app-accent text-white"
                  : day.hasTransactions
                    ? "border-emerald-200 bg-emerald-50 text-app-income"
                    : "border-app-line bg-white text-app-ink"
              }`}
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
            >
              {day.day}
              {day.hasTransactions ? (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    selected ? "bg-white" : "bg-app-income"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface TransactionListItemProps {
  item: Transaction;
  onEdit: (item: Transaction) => void;
}

function TransactionListItem({ item, onEdit }: TransactionListItemProps) {
  const amount = safeNumber(item.amount);
  const boxCount = safeInteger(item.box_count);
  const auctionPrice = safeNumber(item.auction_price);
  const isIncome = item.type === "income";

  return (
    <button
      className="w-full rounded-lg border border-app-line bg-white p-4 text-left"
      type="button"
      onClick={() => onEdit(item)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-app-muted">{formatDate(item.transaction_date)}</p>
          <p className="mt-1 font-semibold text-app-ink">{isIncome ? item.item_name ?? "품목 미입력" : item.category}</p>
          {isIncome ? (
            <p className="mt-1 text-sm text-app-muted">
              {boxCount.toLocaleString("ko-KR")}박스 x {formatAmount(auctionPrice)}
            </p>
          ) : null}
          {item.memo ? <p className="mt-1 break-words text-sm text-app-muted">{item.memo}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pencil size={14} className="text-app-muted" />
          <p className={`font-bold ${isIncome ? "text-app-income" : "text-app-expense"}`}>
            {isIncome ? "+" : "-"}
            {formatAmount(amount)}
          </p>
        </div>
      </div>
    </button>
  );
}

interface StatsViewProps {
  allTotals: Totals;
  expenseCategoryData: ChartData[];
  itemSalesData: ChartData[];
  selectedMonth: string;
  selectedMonthCounts: TransactionCounts;
  selectedMonthSummary: Totals;
  selectedYear: string;
  selectedYearSummary: Totals;
  years: number[];
  onSelectedMonthChange: (value: string) => void;
  onSelectedYearChange: (value: string) => void;
}

function StatsView({
  allTotals,
  expenseCategoryData,
  itemSalesData,
  selectedMonth,
  selectedMonthCounts,
  selectedMonthSummary,
  selectedYear,
  selectedYearSummary,
  years,
  onSelectedMonthChange,
  onSelectedYearChange
}: StatsViewProps) {
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-app-line bg-white p-4">
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
        <input
          className="w-full rounded-md border border-app-line px-4 py-3"
          type="month"
          value={selectedMonth}
          onChange={(event) => onSelectedMonthChange(event.target.value)}
        />
      </section>

      <SummaryCard
        title="선택 월 요약"
        subtitle={formatYearMonthLabel(selectedMonth)}
        totals={selectedMonthSummary}
        counts={selectedMonthCounts}
      />
      <SummaryCard title="선택 연도 요약" subtitle={`${selectedYear}년 요약`} totals={selectedYearSummary} />
      <SummaryCard title="전체 누적 요약" totals={allTotals} />

      <ProfitPieCard title="선택 월 매출/지출 비중" subtitle={formatYearMonthLabel(selectedMonth)} totals={selectedMonthSummary} />
      <ProfitPieCard title="선택 연도 매출/지출 비중" subtitle={`${selectedYear}년 요약`} totals={selectedYearSummary} />
      <CategoryBarCard title="월별 지출 카테고리" data={expenseCategoryData} />
      <PieDataCard title="품목별 월 매출" data={itemSalesData} />
    </div>
  );
}

interface ProfitPieCardProps {
  title: string;
  subtitle?: string;
  totals: Totals;
}

function ProfitPieCard({ title, subtitle, totals }: ProfitPieCardProps) {
  const data: ChartData[] = withChartColors([
    { name: "총매출", value: totals.income },
    { name: "총지출", value: totals.expense }
  ].filter((item) => item.value > 0));

  return (
    <section className="rounded-lg border border-app-line bg-white p-4">
      <h2 className="text-base font-semibold text-app-ink">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-app-muted">{subtitle}</p> : null}
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="mt-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={78} paddingAngle={3}>
                {data.map((entry) => (
                  <Cell fill={entry.color} key={entry.name} />
                ))}
              </Pie>
              <Tooltip formatter={(value: unknown) => formatAmount(safeNumber(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length > 0 ? <DataList data={data} /> : null}
      <p className={`mt-2 text-center text-2xl font-bold ${totals.profitRate >= 0 ? "text-app-income" : "text-app-expense"}`}>
        이익률 {formatProfitRate(totals.profitRate)}
      </p>
    </section>
  );
}

interface CategoryBarCardProps {
  title: string;
  data: ChartData[];
}

function CategoryBarCard({ title, data }: CategoryBarCardProps) {
  return (
    <section className="rounded-lg border border-app-line bg-white p-4">
      <h2 className="text-base font-semibold text-app-ink">{title}</h2>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="name" fontSize={11} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value: unknown) => formatAmount(safeNumber(value))} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell fill={entry.color} key={entry.name} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataList data={data} />
        </>
      )}
    </section>
  );
}

interface PieDataCardProps {
  title: string;
  data: ChartData[];
}

function PieDataCard({ title, data }: PieDataCardProps) {
  return (
    <section className="rounded-lg border border-app-line bg-white p-4">
      <h2 className="text-base font-semibold text-app-ink">{title}</h2>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" outerRadius={78}>
                  {data.map((entry) => (
                    <Cell fill={entry.color} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => formatAmount(safeNumber(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <DataList data={data} />
        </>
      )}
    </section>
  );
}

function DataList({ data }: { data: ChartData[] }) {
  return (
    <div className="mt-4 space-y-2">
      {data.map((item) => (
        <div className="flex items-center justify-between gap-3 text-sm" key={item.name}>
          <span className="flex min-w-0 items-center gap-2 text-app-ink">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.name}</span>
          </span>
          <span className="font-bold text-app-ink">{formatAmount(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart() {
  return <p className="py-10 text-center text-sm text-app-muted">표시할 데이터가 없습니다.</p>;
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
