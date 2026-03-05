import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useRecurringCheck } from "../hooks/useRecurringCheck";
import {
  getSalaryCycle,
  shiftCycle,
  cycleToDatabaseRange,
} from "../utils/salaryCycle";
import Card from "../components/ui/Card";
import CurrencyInput from "../components/ui/CurrencyInput";
import Button from "../components/ui/Button";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Check,
  X,
  RefreshCw,
  Pencil,
  CreditCard,
  Banknote,
} from "lucide-react";

// MONTH_NAMES artık salaryCycle.js içinde — burada kullanılmıyor.

const formatCurrency = (amount) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);

export default function Dashboard() {
  const { user } = useAuth();
  const { salaryDay } = useProfile();
  const { generatedCount, checked: recurringChecked } = useRecurringCheck();

  // Maaş döngüsü: takvim ayı yerine salary_day'e göre dönem hesabı
  const [cycle, setCycle] = useState(() =>
    getSalaryCycle(new Date(), salaryDay),
  );
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick transaction state
  const [quickCategory, setQuickCategory] = useState(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState("");
  const [showRecurringBanner, setShowRecurringBanner] = useState(true);
  const [editingQuickActions, setEditingQuickActions] = useState(false);

  // salaryDay değiştiğinde (ayarlardan güncelleme) cycle'ı yeniden hesapla
  useEffect(() => {
    setCycle(getSalaryCycle(new Date(), salaryDay));
  }, [salaryDay]);

  useEffect(() => {
    fetchTransactions();
    fetchCategories();
  }, [cycle]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { startISO, endISO } = cycleToDatabaseRange(cycle);

    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(name, parent_id)")
      .eq("user_id", user.id)
      .gte("date", startISO)
      .lt("date", endISO)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    // Görev 2: Sadece bu kullanıcıya ait kategorileri çek
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setCategories(data || []);
  };

  // ─── Quick action shortcuts (user-managed, stored in localStorage) ───
  const getQuickActionIds = () => {
    try {
      const stored = localStorage.getItem("quickActionIds");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const [quickActionIds, setQuickActionIds] = useState(getQuickActionIds);

  const saveQuickActionIds = (ids) => {
    setQuickActionIds(ids);
    localStorage.setItem("quickActionIds", JSON.stringify(ids));
  };

  const toggleQuickAction = (catId) => {
    const current = [...quickActionIds];
    const idx = current.indexOf(catId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(catId);
    }
    saveQuickActionIds(current);
  };

  const quickActions = useMemo(() => {
    return quickActionIds
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean);
  }, [quickActionIds, categories]);

  // Quick transaction handler
  const handleQuickSave = async () => {
    if (!quickCategory || !quickAmount || Number(quickAmount) <= 0) return;
    setQuickSaving(true);

    const today = new Date().toISOString().split("T")[0];
    // Görev 3: Hızlı işlemde de user_id zorunlu
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      date: today,
      amount: Number(quickAmount),
      type: quickCategory.type,
      category_id: quickCategory.id,
      description: null,
    });

    if (error) {
      console.error("Quick save error:", error);
    } else {
      setQuickSuccess(
        `${quickCategory.name} — ${formatCurrency(Number(quickAmount))} eklendi!`,
      );
      setTimeout(() => setQuickSuccess(""), 3000);
      setQuickCategory(null);
      setQuickAmount("");
      fetchTransactions();
    }
    setQuickSaving(false);
  };

  const prevCycle = () => setCycle(shiftCycle(cycle.start, salaryDay, -1));
  const nextCycle = () => setCycle(shiftCycle(cycle.start, salaryDay, 1));

  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Nakit giderler (is_transfer dahil — çünkü borcu nakitten öderiz)
    const cashExpenses = transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.payment_method || "cash") === "cash" &&
          !t.is_transfer,
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Kredi kartı borç ödemeleri (is_transfer === true) — nakitten çıkar, KK borcundan düşer
    const transferPayments = transactions
      .filter((t) => t.type === "expense" && t.is_transfer)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Kredi kartı giderleri (borç havuzu)
    const creditCardExpenses = transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          (t.payment_method || "cash") === "credit_card" &&
          !t.is_transfer,
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // 🏦 Bankadaki Para = Gelir − Nakit giderler − KK borç ödemeleri
    const cashBalance = income - cashExpenses - transferPayments;

    // 💳 Güncel KK Borcu = KK giderleri − KK ödemeleri
    const creditDebt = creditCardExpenses - transferPayments;

    // 📊 Toplam Harcama (bütçe takibi) = Nakit + KK giderleri (is_transfer hariç)
    const totalSpending = cashExpenses + creditCardExpenses;

    // 🌟 Net Durum
    const netStatus = cashBalance - creditDebt;

    return { income, cashBalance, creditDebt, totalSpending, netStatus };
  }, [transactions]);

  const recentTransactions = useMemo(
    () => transactions.slice(0, 8),
    [transactions],
  );

  const categoryBreakdown = useMemo(() => {
    const map = {};
    transactions
      .filter((tx) => !tx.is_transfer)
      .forEach((tx) => {
        const cat = tx.categories;
        // Alt kategori ise ana kategorisinin adını bul, yoksa kendi adını kullan
        let displayName;
        if (cat?.parent_id) {
          const parent = categories.find((c) => c.id === cat.parent_id);
          displayName = parent?.name || cat?.name || "Kategorisiz";
        } else {
          displayName = cat?.name || "Kategorisiz";
        }
        const key = `${displayName}-${tx.type}`;
        if (!map[key]) {
          map[key] = { name: displayName, type: tx.type, total: 0 };
        }
        map[key].total += Number(tx.amount);
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [transactions, categories]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-primary-600" />
            Finansal Özet
          </h1>
          <p className="text-text-secondary mt-1">
            Dönemsel gelir, gider ve net durumunuz.
          </p>
        </div>

        {/* Cycle Selector — maaş döngüsüne göre dönem */}
        <Card padding="p-3" className="flex items-center gap-2">
          <button
            onClick={prevCycle}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-3 min-w-[220px] justify-center">
            <Calendar className="w-4 h-4 text-primary-600" />
            <span className="font-semibold text-text-primary text-sm">
              {cycle.label}
            </span>
          </div>
          <button
            onClick={nextCycle}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards — 4'lü İki Kova + Net Durum */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* 🌟 Net Durum (Ana Odak) */}
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-none bg-slate-900">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-[60px] group-hover:bg-blue-500/20 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-slate-300">
                    Net Durum
                  </span>
                </div>
                <p
                  className={`text-2xl lg:text-3xl font-bold ${
                    totals.netStatus >= 0 ? "text-white" : "text-danger-400"
                  }`}
                >
                  {formatCurrency(totals.netStatus)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Bankadaki nakit − Kredi kartı borcu
                </p>
              </div>
            </Card>

            {/* 🏦 Bankadaki Para */}
            <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-24 h-24 bg-success-500/5 rounded-bl-[60px] group-hover:bg-success-500/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-success-600" />
                  </div>
                  <span className="text-sm font-medium text-text-secondary">
                    Bankadaki Paran
                  </span>
                </div>
                <p
                  className={`text-2xl lg:text-3xl font-bold ${
                    totals.cashBalance >= 0
                      ? "text-success-700"
                      : "text-danger-700"
                  }`}
                >
                  {formatCurrency(totals.cashBalance)}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Kasadaki güncel nakit paran
                </p>
              </div>
            </Card>

            {/* 💳 Kredi Kartı Borcu */}
            <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-24 h-24 bg-warning-500/5 rounded-bl-[60px] group-hover:bg-warning-500/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-warning-600" />
                  </div>
                  <span className="text-sm font-medium text-text-secondary">
                    Kredi Kartı Borcun
                  </span>
                </div>
                <p
                  className={`text-2xl lg:text-3xl font-bold ${
                    totals.creditDebt > 0
                      ? "text-warning-700"
                      : "text-success-700"
                  }`}
                >
                  {formatCurrency(Math.max(0, totals.creditDebt))}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Ödenmesi gereken güncel borç
                </p>
              </div>
            </Card>

            {/* 📊 Bu Ay Toplam Harcama */}
            <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-24 h-24 bg-danger-500/5 rounded-bl-[60px] group-hover:bg-danger-500/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-danger-50 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-danger-600" />
                  </div>
                  <span className="text-sm font-medium text-text-secondary">
                    Toplam Harcama
                  </span>
                </div>
                <p className="text-2xl lg:text-3xl font-bold text-danger-700">
                  {formatCurrency(totals.totalSpending)}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Nakit + Kredi Kartı harcamaları
                </p>
              </div>
            </Card>
          </div>

          {/* Recurring auto-generated banner */}
          {recurringChecked && generatedCount > 0 && showRecurringBanner && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium animate-fade-in">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                {generatedCount} otomatik tekrarlayan işlem oluşturuldu.
              </span>
              <button
                onClick={() => setShowRecurringBanner(false)}
                className="cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Transaction Success */}
          {quickSuccess && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-50 text-success-700 text-sm font-medium animate-fade-in">
              <Check className="w-4 h-4" />
              {quickSuccess}
            </div>
          )}

          {/* ═══════════════════════════════════════════
              QUICK TRANSACTION PANEL
          ═══════════════════════════════════════════ */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning-500" />
                Hızlı İşlem
              </h2>
              <button
                onClick={() => {
                  setEditingQuickActions(!editingQuickActions);
                  setQuickCategory(null);
                  setQuickAmount("");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  editingQuickActions
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                }`}
              >
                {editingQuickActions ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Tamam
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    Düzenle
                  </>
                )}
              </button>
            </div>

            {editingQuickActions ? (
              /* ─── Edit Mode: show all categories with checkboxes ─── */
              <div className="space-y-2 animate-fade-in">
                <p className="text-xs text-text-muted mb-2">
                  Hızlı erişmek istediğiniz kategorileri seçin:
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {categories.map((cat) => {
                    const isSelected = quickActionIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleQuickAction(cat.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer text-left ${
                          isSelected
                            ? cat.type === "income"
                              ? "bg-success-50 border-success-300 text-success-700 ring-1 ring-success-200"
                              : "bg-danger-50 border-danger-300 text-danger-700 ring-1 ring-danger-200"
                            : "bg-gray-50 border-gray-200 text-text-muted hover:bg-gray-100"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                            isSelected
                              ? cat.type === "income"
                                ? "bg-success-600 text-white"
                                : "bg-danger-600 text-white"
                              : "bg-white border border-gray-300"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </span>
                        <span>{cat.name}</span>
                        <span
                          className={`text-xs ml-auto ${isSelected ? "" : "opacity-50"}`}
                        >
                          {cat.type === "income" ? "Gelir" : "Gider"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : quickActions.length === 0 ? (
              /* ─── Empty State ─── */
              <div className="text-center py-4">
                <p className="text-sm text-text-muted mb-2">
                  Henüz hızlı işlem kısayolu eklenmemiş.
                </p>
                <button
                  onClick={() => setEditingQuickActions(true)}
                  className="text-sm text-primary-600 font-semibold hover:underline cursor-pointer"
                >
                  Kısayol eklemek için tıklayın
                </button>
              </div>
            ) : (
              /* ─── Normal Mode: user's selected quick actions ─── */
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {quickActions.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setQuickCategory(
                          quickCategory?.id === cat.id ? null : cat,
                        )
                      }
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer ${
                        quickCategory?.id === cat.id
                          ? "bg-primary-600 text-white border-primary-600 shadow-md scale-105"
                          : cat.type === "income"
                            ? "bg-success-50 text-success-700 border-success-200 hover:bg-success-100 hover:border-success-300"
                            : "bg-danger-50 text-danger-700 border-danger-200 hover:bg-danger-100 hover:border-danger-300"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Amount input + save (shown when category selected) */}
                {quickCategory && (
                  <div className="flex items-end gap-3 animate-fade-in pt-1">
                    <div className="flex-1 max-w-xs">
                      <CurrencyInput
                        label={`${quickCategory.name} — Tutar`}
                        id="quickAmount"
                        value={quickAmount}
                        onValueChange={(value) => setQuickAmount(value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && quickAmount)
                            handleQuickSave();
                        }}
                        autoFocus
                      />
                    </div>
                    <Button
                      onClick={handleQuickSave}
                      disabled={quickSaving || !quickAmount}
                      variant={
                        quickCategory.type === "income" ? "success" : "danger"
                      }
                    >
                      {quickSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      Kaydet
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setQuickCategory(null);
                        setQuickAmount("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Bottom section: Recent + Category Breakdown */}
          {/* overflow-hidden: iç kartlardaki taşan içerikler yatay scroll yaratmasın */}
          <div className="grid lg:grid-cols-2 gap-6 overflow-hidden">
            {/* Recent Transactions */}
            <Card className="overflow-hidden">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Son İşlemler
              </h2>
              {recentTransactions.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">
                  Bu ay için işlem bulunamadı.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentTransactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors min-w-0 gap-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            tx.type === "income"
                              ? "bg-success-50"
                              : "bg-danger-50"
                          }`}
                        >
                          {tx.type === "income" ? (
                            <ArrowUpRight className="w-4 h-4 text-success-600" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-danger-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
                            {tx.categories?.name || "Kategorisiz"}
                            {tx.is_transfer && (
                              <CreditCard className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                            )}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {tx.description ||
                              new Date(tx.date).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold shrink-0 ${
                          tx.type === "income"
                            ? "text-success-700"
                            : "text-danger-700"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Category Breakdown */}
            <Card className="overflow-hidden">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                Kategorilere Göre Dağılım
              </h2>
              {categoryBreakdown.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-8">
                  Bu ay için veri bulunamadı.
                </p>
              ) : (
                <ul className="space-y-3">
                  {categoryBreakdown.map((item, idx) => {
                    const maxTotal = categoryBreakdown[0]?.total || 1;
                    const widthPercent = Math.max(
                      (item.total / maxTotal) * 100,
                      8,
                    );
                    return (
                      <li key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-text-primary flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.type === "income"
                                  ? "bg-success-500"
                                  : "bg-danger-500"
                              }`}
                            />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span
                            className={`text-sm font-semibold shrink-0 ml-2 ${
                              item.type === "income"
                                ? "text-success-700"
                                : "text-danger-700"
                            }`}
                          >
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.type === "income"
                                ? "bg-success-500"
                                : "bg-danger-500"
                            }`}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
