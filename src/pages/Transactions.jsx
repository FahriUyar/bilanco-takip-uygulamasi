import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { exportTransactionsToExcel } from "../utils/exportExcel";
import { useProfile } from "../hooks/useProfile";
import { exportTransactionsToGoogleSheets } from "../utils/exportGoogleSheets";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import CurrencyInput from "../components/ui/CurrencyInput";
import DatePicker from "../components/ui/DatePicker";
import {
  Plus,
  Trash2,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Download,
  FileSpreadsheet,
  Search,
  Filter,
  Pencil,
  Check,
  CheckSquare,
  Square,
  MinusSquare,
  CreditCard,
} from "lucide-react";

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const TYPE_OPTIONS = [
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
];

const ALL_TYPE_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

// ─── Empty Form State ───
const EMPTY_FORM = {
  date: new Date().toISOString().split("T")[0],
  amount: 0,
  type: "",
  category_id: "",
  description: "",
  isInstallment: false,
  installmentCount: 3,
  is_transfer: false,
};

/**
 * Ay atlama hatasını önleyen güvenli tarih hesaplama.
 *
 * Neden bu fonksiyon? JavaScript'te new Date("2025-01-31") üzerine
 * doğrudan setMonth(2) yaparsak 3 Mart olur çünkü Şubat'ta 31 gün yok.
 * Bu fonksiyon hedef ayın son günüyle sınırlandırarak bu hatayı önler:
 * 31 Ocak + 1 ay → 28 Şubat (veya 29, artık yılda)
 */
function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  const targetMonth = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  // Hedef ayın kaç günü olduğunu bul, günü o sınır içinde tut
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function Transactions() {
  // Görev 1: Kapıdaki kişiyi öğren — tüm sorgular bu user'a göre filtrelenecek
  const { user } = useAuth();
  const { appName } = useProfile();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetsExporting, setSheetsExporting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ─── Edit state ───
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);

  // ─── Search state ───
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Filter state ───
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");

  // ─── Bulk select state ───
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [selectedMonth, selectedYear]);

  // Clear selections when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [transactions]);

  const fetchCategories = async () => {
    // Görev 2: Sadece bu kullanıcıya ait kategorileri çek
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setCategories(data || []);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const endDate =
      selectedMonth === 11
        ? `${selectedYear + 1}-01-01`
        : `${selectedYear}-${String(selectedMonth + 2).padStart(2, "0")}-01`;

    // Görev 2: Sadece bu kullanıcıya ait işlemleri çek
    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(name, parent_id)")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setError("İşlemler yüklenirken hata oluştu.");
      console.error(error);
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  /**
   * Kategorileri optgroup yapısına dönüştür:
   * - Ana kategorilerin altında alt kategoriler gruplanır
   * - Alt kategorisi olmayan ana kategoriler doğrudan seçilebilir
   */
  const buildGroupedOptions = (type) => {
    if (!type) return { groups: [], standalone: [] };
    const typeCats = categories.filter((c) => c.type === type);
    const parents = typeCats.filter((c) => !c.parent_id);
    const children = typeCats.filter((c) => c.parent_id);

    const groups = [];
    const standalone = [];

    parents.forEach((parent) => {
      const kids = children.filter((c) => c.parent_id === parent.id);
      if (kids.length > 0) {
        // Ana kategorinin altına alt kategoriler gruplanır
        // Ana kategori de seçilebilir olarak grubun içine eklenir
        groups.push({
          label: parent.name,
          options: [
            { value: parent.id, label: `${parent.name} (Genel)` },
            ...kids.map((k) => ({ value: k.id, label: k.name })),
          ],
        });
      } else {
        // Alt kategorisi yok → doğrudan seçilebilir
        standalone.push({ value: parent.id, label: parent.name });
      }
    });

    return { groups, standalone };
  };

  const formCategoryGrouped = useMemo(
    () => buildGroupedOptions(formData.type),
    [categories, formData.type],
  );

  const editCategoryGrouped = useMemo(
    () => buildGroupedOptions(editData?.type),
    [categories, editData?.type],
  );

  // ─── Filtered & searched transactions ───
  const displayedTransactions = useMemo(() => {
    let list = [...transactions];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (tx) =>
          (tx.description || "").toLowerCase().includes(q) ||
          (tx.categories?.name || "").toLowerCase().includes(q),
      );
    }

    // Filter by type
    if (filterType) {
      list = list.filter((tx) => tx.type === filterType);
    }

    // Filter by category
    if (filterCategory) {
      list = list.filter((tx) => tx.category_id === filterCategory);
    }

    // Filter by min amount
    if (filterMinAmount !== "") {
      const min = Number(filterMinAmount);
      if (!isNaN(min)) list = list.filter((tx) => Number(tx.amount) >= min);
    }

    // Filter by max amount
    if (filterMaxAmount !== "") {
      const max = Number(filterMaxAmount);
      if (!isNaN(max)) list = list.filter((tx) => Number(tx.amount) <= max);
    }

    return list;
  }, [
    transactions,
    searchQuery,
    filterType,
    filterCategory,
    filterMinAmount,
    filterMaxAmount,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterType) count++;
    if (filterCategory) count++;
    if (filterMinAmount !== "") count++;
    if (filterMaxAmount !== "") count++;
    return count;
  }, [filterType, filterCategory, filterMinAmount, filterMaxAmount]);

  const clearFilters = () => {
    setFilterType("");
    setFilterCategory("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
  };

  // ─── Category options for filter ───
  const allCategoryOptions = useMemo(() => {
    const filtered = filterType
      ? categories.filter((c) => c.type === filterType)
      : categories;
    return [
      { value: "", label: "Tümü" },
      ...filtered.map((c) => ({ value: c.id, label: c.name })),
    ];
  }, [categories, filterType]);

  // ─── Handlers ───
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (formData.isInstallment && formData.installmentCount > 1) {
      // ── TAKSİTLİ İŞLEM ──
      // Kullanıcı TOPLAM tutarı girer, biz taksit sayısına böleriz.
      // Örn: 12.000 TL / 6 taksit = 2.000 TL/ay
      const count = Number(formData.installmentCount);
      const baseDesc = formData.description.trim();

      // Küsuratlı tutarlar için 2 ondalık basamağa yuvarla
      // Örn: 1000 / 3 → 333.33
      const monthlyAmount = Math.round((formData.amount / count) * 100) / 100;

      // Ortak group_id: tüm taksitler bu UUID ile bağlanacak,
      // ileride topluca silinebilir.
      const groupId = crypto.randomUUID();

      const rows = Array.from({ length: count }, (_, i) => ({
        user_id: user.id,
        date: addMonths(formData.date, i),
        amount: monthlyAmount, // bölünmüş aylık tutar
        type: formData.type,
        category_id: formData.category_id || null,
        description: baseDesc
          ? `${baseDesc} (${i + 1}/${count})`
          : `(${i + 1}/${count})`,
        is_transfer: formData.is_transfer,
        group_id: groupId,
      }));

      const { error } = await supabase.from("transactions").insert(rows);
      if (error) {
        setError("Taksitli işlem eklenirken hata oluştu.");
        console.error(error);
      } else {
        setFormData({ ...EMPTY_FORM });
        setShowForm(false);
        fetchTransactions();
      }
    } else {
      // ── TEK İŞLEM ──
      // Görev 3: user_id NOT NULL olduğu için insert'e ekliyoruz
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        date: formData.date,
        amount: formData.amount,
        type: formData.type,
        category_id: formData.category_id || null,
        description: formData.description.trim() || null,
        is_transfer: formData.is_transfer,
      });

      if (error) {
        setError("İşlem eklenirken hata oluştu.");
        console.error(error);
      } else {
        setFormData({ ...EMPTY_FORM });
        setShowForm(false);
        fetchTransactions();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      setError("İşlem silinirken hata oluştu.");
    } else {
      setDeleteConfirm(null);
      fetchTransactions();
    }
  };

  // Grup silme: aynı group_id'ye sahip tüm taksitleri sil
  const handleDeleteGroup = async (groupId) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("group_id", groupId);
    if (error) {
      setError("Taksitler silinirken hata oluştu.");
    } else {
      setDeleteConfirm(null);
      fetchTransactions();
    }
  };

  // ─── Edit handlers ───
  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditData({
      date: tx.date,
      amount: Number(tx.amount),
      type: tx.type,
      category_id: tx.category_id || "",
      description: tx.description || "",
      is_transfer: tx.is_transfer || false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = async () => {
    if (!editData) return;
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("transactions")
      .update({
        date: editData.date,
        amount: editData.amount,
        type: editData.type,
        category_id: editData.category_id || null,
        description: editData.description.trim() || null,
        is_transfer: editData.is_transfer,
      })
      .eq("id", editingId);

    if (error) {
      setError("İşlem güncellenirken hata oluştu.");
      console.error(error);
    } else {
      cancelEdit();
      fetchTransactions();
    }
    setSaving(false);
  };

  // ─── Bulk selection handlers ───
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (
        prev.size === displayedTransactions.length &&
        displayedTransactions.length > 0
      ) {
        return new Set();
      }
      return new Set(displayedTransactions.map((tx) => tx.id));
    });
  }, [displayedTransactions]);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setError("");

    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", ids);

    if (error) {
      setError("İşlemler silinirken hata oluştu.");
      console.error(error);
    } else {
      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      fetchTransactions();
    }
    setBulkDeleting(false);
  };

  // ─── Month navigation ───
  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const monthTotals = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === "expense" && !t.is_transfer)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expense, net: income - expense };
  }, [transactions]);

  // ─── Select All state ───
  const selectAllState = useMemo(() => {
    if (displayedTransactions.length === 0) return "none";
    if (selectedIds.size === displayedTransactions.length) return "all";
    if (selectedIds.size > 0) return "partial";
    return "none";
  }, [selectedIds, displayedTransactions]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <ArrowLeftRight className="w-7 h-7 text-primary-600" />
            İşlemler
          </h1>
          <p className="text-text-secondary mt-1">
            Gelir ve gider işlemlerinizi yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              exportTransactionsToExcel(
                transactions,
                MONTH_NAMES[selectedMonth],
                selectedYear,
                appName || "Rapor",
              )
            }
            disabled={loading || transactions.length === 0}
          >
            <Download className="w-4 h-4" />
            Excel'e Aktar
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setSheetsExporting(true);
              try {
                await exportTransactionsToGoogleSheets(
                  transactions,
                  MONTH_NAMES[selectedMonth],
                  selectedYear,
                );
                // Kısa bir süre "Kopyalandı" göster
                setTimeout(() => setSheetsExporting(false), 2000);
              } catch {
                setSheetsExporting(false);
              }
            }}
            disabled={loading || transactions.length === 0 || sheetsExporting}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {sheetsExporting ? "Panoya Kopyalandı!" : "Google E-Tablolar"}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Kapat
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Yeni İşlem
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Add Transaction Form */}
      {showForm && (
        <Card className="animate-fade-in border-primary-200">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Yeni İşlem Ekle
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <DatePicker
                  label="Tarih"
                  id="txDate"
                  value={formData.date}
                  onChange={(dateStr) =>
                    setFormData({ ...formData, date: dateStr })
                  }
                />
              </div>
              <CurrencyInput
                label="Tutar"
                id="txAmount"
                value={formData.amount}
                onValueChange={(num) =>
                  setFormData({ ...formData, amount: num })
                }
                required
              />
              <Select
                label="Tür"
                id="txType"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value,
                    category_id: "",
                  })
                }
                options={TYPE_OPTIONS}
                placeholder="Gelir / Gider"
                required
              />
              <div className="space-y-1.5">
                <label
                  htmlFor="txCategory"
                  className="block text-sm font-medium text-text-primary"
                >
                  Kategori
                </label>
                <select
                  id="txCategory"
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  disabled={!formData.type}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer"
                >
                  <option value="">
                    {formData.type ? "Kategori seçin" : "Önce tür seçin"}
                  </option>
                  {formCategoryGrouped.standalone.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  {formCategoryGrouped.groups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <Input
              label="Açıklama (opsiyonel)"
              id="txDescription"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="İşlem açıklaması..."
            />

            {/* ── TAKSİT ALANI ──
                Checkbox işaretlenince açıkça görünür hale gelir.
                Neden burada? Kullanıcı tek taksit de girebilir (normal işlem),
                ya da birden fazla ay döşontirmek isteyebilir. */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="txInstallment"
                  checked={formData.isInstallment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isInstallment: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-border text-primary-600 accent-primary-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-text-secondary">
                  Taksitli İşlem
                </span>
              </label>

              {formData.isInstallment && (
                <div className="flex items-center gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-text-secondary whitespace-nowrap">
                      Taksit Sayısı:
                    </label>
                    <select
                      value={formData.installmentCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          installmentCount: Number(e.target.value),
                        })
                      }
                      className="px-3 py-2 text-sm rounded-xl border border-border bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} ay
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.amount > 0 && (
                    <span className="text-xs text-text-muted">
                      Her ay:{" "}
                      <strong className="text-primary-700">
                        {new Intl.NumberFormat("tr-TR", {
                          style: "currency",
                          currency: "TRY",
                          minimumFractionDigits: 2,
                        }).format(
                          Math.round(
                            (formData.amount / formData.installmentCount) * 100,
                          ) / 100,
                        )}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── KREDİ KARTI / BORÇ ÖDEMESİ ──
                Sadece "Gider" seçiliyken görünür.
                İşaretlenirse toplam gider hesabından hariç tutulur. */}
            {formData.type === "expense" && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1 animate-fade-in">
                <input
                  type="checkbox"
                  id="txIsTransfer"
                  checked={formData.is_transfer}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_transfer: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-border text-primary-600 accent-primary-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary-500" />
                  Bu bir kredi kartı / borç ödemesidir (Toplam giderden hariç
                  tut)
                </span>
              </label>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {formData.isInstallment && formData.installmentCount > 1
                  ? `${formData.installmentCount} Taksit Ekle`
                  : "İşlemi Kaydet"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Month Selector & Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <Card padding="p-3" className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-3 min-w-[180px] justify-center">
            <Calendar className="w-4 h-4 text-primary-600" />
            <span className="font-semibold text-text-primary">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </Card>

        <div className="flex items-center gap-4 ml-auto text-sm">
          <span className="flex items-center gap-1.5 text-success-700">
            <TrendingUp className="w-4 h-4" />
            {formatCurrency(monthTotals.income)}
          </span>
          <span className="flex items-center gap-1.5 text-danger-700">
            <TrendingDown className="w-4 h-4" />
            {formatCurrency(monthTotals.expense)}
          </span>
          <span
            className={`font-semibold ${
              monthTotals.net >= 0 ? "text-success-700" : "text-danger-700"
            }`}
          >
            Net: {formatCurrency(monthTotals.net)}
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Açıklama veya kategoride ara..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-muted hover:text-text-secondary cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? "primary" : "secondary"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            Filtrele
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-white/20 text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="animate-fade-in border-primary-100" padding="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <Select
                  label="Tür"
                  id="filterType"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setFilterCategory("");
                  }}
                  options={ALL_TYPE_OPTIONS}
                  placeholder="Tümü"
                />
              </div>
              <div className="w-48">
                <Select
                  label="Kategori"
                  id="filterCategory"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  options={allCategoryOptions}
                  placeholder="Tümü"
                />
              </div>
              <div className="w-36">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Min Tutar
                </label>
                <input
                  type="number"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="w-36">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Max Tutar
                </label>
                <input
                  type="number"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  placeholder="∞"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                />
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5" />
                  Temizle
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary-50 border border-primary-200 animate-fade-in">
          <span className="text-sm font-medium text-primary-700">
            <CheckSquare className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {selectedIds.size} işlem seçildi
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Seçimi Kaldır
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setBulkDeleteConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Seçilenleri Sil
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <Card className="max-w-sm w-full mx-4 shadow-2xl" padding="p-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-danger-50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-danger-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  Toplu Silme Onayı
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  <strong>{selectedIds.size}</strong> işlemi silmek istediğinize
                  emin misiniz? Bu işlem geri alınamaz.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setBulkDeleteConfirm(false)}
                  disabled={bulkDeleting}
                >
                  İptal
                </Button>
                <Button
                  variant="danger"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Evet, Sil
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <Card className="max-w-lg w-full mx-4 shadow-2xl" padding="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary-600" />
                İşlemi Düzenle
              </h3>
              <button
                onClick={cancelEdit}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <DatePicker
                  label="Tarih"
                  id="editDate"
                  value={editData.date}
                  onChange={(dateStr) =>
                    setEditData({ ...editData, date: dateStr })
                  }
                />
                <CurrencyInput
                  label="Tutar"
                  id="editAmount"
                  value={editData.amount}
                  onValueChange={(num) =>
                    setEditData({ ...editData, amount: num })
                  }
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Select
                  label="Tür"
                  id="editType"
                  value={editData.type}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      type: e.target.value,
                      category_id: "",
                    })
                  }
                  options={TYPE_OPTIONS}
                  placeholder="Gelir / Gider"
                  required
                />
                <div className="space-y-1.5">
                  <label
                    htmlFor="editCategory"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Kategori
                  </label>
                  <select
                    id="editCategory"
                    value={editData.category_id}
                    onChange={(e) =>
                      setEditData({ ...editData, category_id: e.target.value })
                    }
                    disabled={!editData.type}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-text-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer"
                  >
                    <option value="">
                      {editData.type ? "Kategori seçin" : "Önce tür seçin"}
                    </option>
                    {editCategoryGrouped.standalone.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    {editCategoryGrouped.groups.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                label="Açıklama (opsiyonel)"
                id="editDescription"
                value={editData.description}
                onChange={(e) =>
                  setEditData({ ...editData, description: e.target.value })
                }
                placeholder="İşlem açıklaması..."
              />
              {editData.type === "expense" && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none animate-fade-in">
                  <input
                    type="checkbox"
                    checked={editData.is_transfer}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        is_transfer: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-border text-primary-600 accent-primary-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-primary-500" />
                    Bu bir kredi kartı / borç ödemesidir (Toplam giderden hariç
                    tut)
                  </span>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                  İptal
                </Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Kaydet
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card padding="p-0" className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-text-secondary">
              {searchQuery || activeFilterCount > 0
                ? "Arama/filtre sonucuna uygun işlem bulunamadı."
                : "Bu ay için işlem bulunamadı."}
            </p>
            <p className="text-sm mt-1">
              {searchQuery || activeFilterCount > 0
                ? "Filtreleri değiştirmeyi veya aramayı temizlemeyi deneyin."
                : "Yeni bir işlem eklemek için yukarıdaki butonu kullanın."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  {/* Checkbox header */}
                  <th className="w-10 px-3 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className="p-0.5 rounded text-text-muted hover:text-primary-600 transition-colors cursor-pointer"
                    >
                      {selectAllState === "all" ? (
                        <CheckSquare className="w-4.5 h-4.5 text-primary-600" />
                      ) : selectAllState === "partial" ? (
                        <MinusSquare className="w-4.5 h-4.5 text-primary-600" />
                      ) : (
                        <Square className="w-4.5 h-4.5" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-text-secondary">
                    Tarih
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-text-secondary">
                    Tür
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-text-secondary">
                    Kategori
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-text-secondary">
                    Açıklama
                  </th>
                  <th className="text-right px-6 py-3 font-medium text-text-secondary">
                    Tutar
                  </th>
                  <th className="text-right px-6 py-3 font-medium text-text-secondary">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`border-b border-border/50 hover:bg-gray-50/50 transition-colors group ${
                      selectedIds.has(tx.id) ? "bg-primary-50/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-3.5">
                      <button
                        onClick={() => toggleSelect(tx.id)}
                        className="p-0.5 rounded text-text-muted hover:text-primary-600 transition-colors cursor-pointer"
                      >
                        {selectedIds.has(tx.id) ? (
                          <CheckSquare className="w-4.5 h-4.5 text-primary-600" />
                        ) : (
                          <Square className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-text-primary whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            tx.type === "income"
                              ? "bg-success-50 text-success-700"
                              : "bg-danger-50 text-danger-700"
                          }`}
                        >
                          {tx.type === "income" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {tx.type === "income" ? "Gelir" : "Gider"}
                        </span>
                        {tx.is_transfer && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                            <CreditCard className="w-3 h-3" />
                            Transfer
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary">
                      {tx.categories?.name || "—"}
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary max-w-[200px] truncate">
                      {tx.description || "—"}
                    </td>
                    <td
                      className={`px-6 py-3.5 text-right font-semibold whitespace-nowrap ${
                        tx.type === "income"
                          ? "text-success-700"
                          : "text-danger-700"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {deleteConfirm === tx.id ? (
                        <div className="flex items-center justify-end gap-2 animate-fade-in">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(tx.id)}
                          >
                            Sil
                          </Button>
                          {tx.group_id && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteGroup(tx.group_id)}
                            >
                              Tüm Taksitleri Sil
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            İptal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => startEdit(tx)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary-600 hover:bg-primary-50 transition-all cursor-pointer"
                            title="Düzenle"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(tx.id)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-danger-600 hover:bg-danger-50 transition-all cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Results summary */}
      {!loading &&
        transactions.length > 0 &&
        (searchQuery || activeFilterCount > 0) && (
          <p className="text-xs text-text-muted text-center">
            {displayedTransactions.length} / {transactions.length} işlem
            gösteriliyor
          </p>
        )}
    </div>
  );
}
