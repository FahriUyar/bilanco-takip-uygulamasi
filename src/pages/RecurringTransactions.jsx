import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import CurrencyInput from "../components/ui/CurrencyInput";
import {
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  Calendar,
  Clock,
} from "lucide-react";

/**
 * Ay atlama hatasını önleyen güvenli tarih hesaplama.
 * 31 Ocak + 1 ay → 28 Şubat (veya 29, artık yılda)
 */
function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  const targetMonth = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Aylık" },
  { value: "weekly", label: "Haftalık" },
];

const TYPE_OPTIONS = [
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
}));

export default function RecurringTransactions() {
  const { user } = useAuth();
  const [recurring, setRecurring] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: "expense",
    category_id: "",
    amount: "",
    description: "",
    frequency: "monthly",
    day_of_month: 1,
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Görev 2: Her iki sorguya da kullanıcı filtresi ekledik
    const [{ data: recData }, { data: catData }] = await Promise.all([
      supabase
        .from("recurring_transactions")
        .select("*, categories(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),
    ]);
    setRecurring(recData || []);
    setCategories(catData || []);
    setLoading(false);
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.type === "income" ? "Gelir" : "Gider"})`,
  }));

  const filteredCategoryOptions = categoryOptions.filter((c) => {
    const cat = categories.find((cat) => cat.id === c.value);
    return cat?.type === formData.type;
  });

  const resetForm = () => {
    setFormData({
      type: "expense",
      category_id: "",
      amount: "",
      description: "",
      frequency: "monthly",
      day_of_month: 1,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (item) => {
    setFormData({
      type: item.type,
      category_id: item.category_id || "",
      amount: item.amount,
      description: item.description || "",
      frequency: item.frequency,
      day_of_month: item.day_of_month || 1,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError("Lütfen geçerli bir tutar girin.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      type: formData.type,
      category_id: formData.category_id || null,
      amount: Number(formData.amount),
      description: formData.description.trim() || null,
      frequency: formData.frequency,
      day_of_month:
        formData.frequency === "monthly" ? formData.day_of_month : null,
      user_id: user.id,
    };

    let result;
    if (editingId) {
      // Düzenleme: sadece recurring_transactions kaydını güncelle
      const { user_id, ...updatePayload } = payload;
      result = await supabase
        .from("recurring_transactions")
        .update(updatePayload)
        .eq("id", editingId);
    } else {
      // Yeni kayıt: recurring_transactions'a ekle + 12 ay önden yaz
      result = await supabase.from("recurring_transactions").insert(payload);

      if (!result.error) {
        // Gelecek 12 ay için transactions tablosuna bulk insert
        const groupId = crypto.randomUUID();
        const today = new Date();
        const dayOfMonth =
          formData.frequency === "monthly"
            ? formData.day_of_month
            : today.getDate();

        // Başlangıç tarihi: bu ayın ilgili günü
        const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

        const rows = Array.from({ length: 12 }, (_, i) => ({
          user_id: user.id,
          date: addMonths(startDate, i),
          amount: Number(formData.amount),
          type: formData.type,
          category_id: formData.category_id || null,
          description: formData.description.trim()
            ? `${formData.description.trim()} (otomatik)`
            : "Otomatik tekrarlayan işlem",
          group_id: groupId,
        }));

        const { error: bulkError } = await supabase
          .from("transactions")
          .insert(rows);

        if (bulkError) {
          console.error("Bulk insert error:", bulkError);
          // Ana kayıt başarılı, ama önden yazma başarısız
          setError(
            "Tekrar tanımı eklendi ama gelecek işlemler oluşturulamadı.",
          );
        }
      }
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setSuccess(
        editingId
          ? "İşlem güncellendi!"
          : "Tekrarlayan işlem eklendi ve 12 ay önden yazıldı!",
      );
      setTimeout(() => setSuccess(""), 3000);
      resetForm();
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("recurring_transactions")
      .delete()
      .eq("id", deleteId);
    if (!error) {
      setSuccess("İşlem silindi.");
      setTimeout(() => setSuccess(""), 3000);
      fetchData();
    }
    setDeleteId(null);
  };

  const toggleActive = async (id, currentlyActive) => {
    const { error } = await supabase
      .from("recurring_transactions")
      .update({ is_active: !currentlyActive })
      .eq("id", id);
    if (!error) fetchData();
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <RefreshCw className="w-7 h-7 text-primary-600" />
            Otomatik İşlemler
          </h1>
          <p className="text-text-secondary mt-1">
            Tekrarlayan gelir ve giderlerinizi tanımlayın, otomatik
            oluşturulsun.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Yeni Tekrar
        </Button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-50 text-success-700 text-sm font-medium animate-fade-in">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger-50 text-danger-700 text-sm font-medium animate-fade-in">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button
            onClick={() => setError("")}
            className="ml-auto cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="animate-fade-in border-2 border-primary-100">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            {editingId ? (
              <>
                <Pencil className="w-5 h-5 text-primary-600" />
                Düzenle
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 text-primary-600" />
                Yeni Tekrarlayan İşlem
              </>
            )}
          </h3>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              label="Tür"
              id="recType"
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value,
                  category_id: "",
                })
              }
              options={TYPE_OPTIONS}
            />
            <Select
              label="Kategori"
              id="recCategory"
              value={formData.category_id}
              onChange={(e) =>
                setFormData({ ...formData, category_id: e.target.value })
              }
              options={filteredCategoryOptions}
              placeholder="Kategori seçin"
            />
            <CurrencyInput
              label="Tutar"
              id="recAmount"
              value={formData.amount}
              onValueChange={(value) =>
                setFormData({ ...formData, amount: value })
              }
            />
            <Select
              label="Tekrar Sıklığı"
              id="recFrequency"
              value={formData.frequency}
              onChange={(e) =>
                setFormData({ ...formData, frequency: e.target.value })
              }
              options={FREQUENCY_OPTIONS}
            />
            {formData.frequency === "monthly" && (
              <Select
                label="Ayın Günü"
                id="recDayOfMonth"
                value={formData.day_of_month}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    day_of_month: Number(e.target.value),
                  })
                }
                options={DAY_OPTIONS}
              />
            )}
            <Input
              label="Açıklama (opsiyonel)"
              id="recDescription"
              placeholder="Kira, maaş, abonelik vb."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <Button variant="ghost" onClick={resetForm}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Check className="w-4 h-4 mr-1.5" />
              )}
              {editingId ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : recurring.length === 0 ? (
        <Card className="text-center py-12">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-text-muted">
            Henüz tekrarlayan işlem tanımlanmamış.
          </p>
          <p className="text-text-muted text-sm mt-1">
            Yukarıdaki "Yeni Tekrar" butonuyla başlayın.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recurring.map((item) => (
            <Card
              key={item.id}
              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                !item.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Toggle */}
                <button
                  onClick={() => toggleActive(item.id, item.is_active)}
                  className="shrink-0 cursor-pointer"
                  title={item.is_active ? "Devre dışı bırak" : "Aktif et"}
                >
                  {item.is_active ? (
                    <ToggleRight className="w-8 h-8 text-success-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>

                {/* Info */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {item.categories?.name || "Kategorisiz"}
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        item.type === "income"
                          ? "bg-success-50 text-success-700"
                          : "bg-danger-50 text-danger-700"
                      }`}
                    >
                      {item.type === "income" ? "Gelir" : "Gider"}
                    </span>
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.frequency === "monthly"
                        ? `Her ayın ${item.day_of_month}. günü`
                        : "Her hafta"}
                    </span>
                    {item.description && (
                      <span className="truncate">• {item.description}</span>
                    )}
                    {item.last_generated && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Son:{" "}
                        {new Date(item.last_generated).toLocaleDateString(
                          "tr-TR",
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount + actions */}
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-lg font-bold ${
                    item.type === "income"
                      ? "text-success-700"
                      : "text-danger-700"
                  }`}
                >
                  {formatCurrency(item.amount)}
                </span>
                <button
                  onClick={() => openEditForm(item)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-text-muted hover:text-primary-600 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteId(item.id)}
                  className="p-2 rounded-lg hover:bg-danger-50 transition-colors text-text-muted hover:text-danger-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
          <Card className="w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              İşlemi Sil
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              Bu tekrarlayan işlemi silmek istediğinize emin misiniz? Bu işlem
              geri alınamaz.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>
                İptal
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Sil
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
