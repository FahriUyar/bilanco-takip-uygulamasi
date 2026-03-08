import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import {
  Plus,
  Trash2,
  Tags,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  CornerDownRight,
  CheckSquare,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
];

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Bulk Delete State
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setError("Kategoriler yüklenirken hata oluştu.");
      console.error(error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  // Seçilen türe ait, sadece ana kategoriler (parent_id === null)
  const parentOptions = useMemo(() => {
    if (!type) return [];
    return categories
      .filter((c) => c.type === type && !c.parent_id)
      .map((c) => ({ value: c.id, label: c.name }));
  }, [categories, type]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !type) return;

    setSaving(true);
    setError("");

    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: name.trim(),
      type,
      parent_id: parentId || null,
    });

    if (error) {
      setError("Kategori eklenirken hata oluştu.");
      console.error(error);
    } else {
      setName("");
      setType("");
      setIsSubcategory(false);
      setParentId("");
      fetchCategories();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      setError("Kategori silinirken hata oluştu. İlişkili işlemler olabilir.");
      console.error(error);
    } else {
      setDeleteConfirm(null);
      fetchCategories();
    }
  };

  const toggleSelection = (id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((catId) => catId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedCategories.length === 0) return;

    const confirmed = window.confirm(
      `${selectedCategories.length} kategori silinecektir. Eğer seçtikleriniz arasında ana kategori varsa, ona bağlı alt kategoriler de (seçili olmasa bile) otomatik silinebilir. Bu işlem geri alınamaz. Onaylıyor musunuz?`
    );

    if (!confirmed) return;

    setIsDeletingBulk(true);
    setError("");

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .in("id", selectedCategories);

      if (error) throw error;

      // Başarılı olursa seçimi temizle ve listeyi yenile
      setSelectedCategories([]);
      fetchCategories();
    } catch (err) {
      console.error("Toplu silme hatası:", err);
      setError("Toplu silme sırasında bir hata oluştu.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  /**
   * Kategorileri hiyerarşik sıraya diz:
   * Ana Kategori 1
   *   ↳ Alt Kategori A
   *   ↳ Alt Kategori B
   * Ana Kategori 2
   *   …
   */
  const buildHierarchy = (cats) => {
    const parents = cats.filter((c) => !c.parent_id);
    const children = cats.filter((c) => c.parent_id);
    const result = [];
    parents.forEach((parent) => {
      result.push({ ...parent, isChild: false });
      children
        .filter((c) => c.parent_id === parent.id)
        .forEach((child) => {
          result.push({ ...child, isChild: true });
        });
    });
    // Orphan children (parent silinmişse) — güvenlik
    children
      .filter((c) => !parents.find((p) => p.id === c.parent_id))
      .forEach((orphan) => {
        result.push({ ...orphan, isChild: true });
      });
    return result;
  };

  const incomeCategories = buildHierarchy(
    categories.filter((c) => c.type === "income"),
  );
  const expenseCategories = buildHierarchy(
    categories.filter((c) => c.type === "expense"),
  );

  // ─── Kategori satırı render helper ───
  const renderCategoryItem = (cat, colorScheme) => {
    const isIncome = colorScheme === "income";
    const bgClass = isIncome
      ? "bg-success-50/50 border-success-500/10 hover:border-success-500/30"
      : "bg-danger-50/50 border-danger-500/10 hover:border-danger-500/30";
    const childBgClass = isIncome
      ? "bg-success-50/30 border-success-500/5 hover:border-success-500/20"
      : "bg-danger-50/30 border-danger-500/5 hover:border-danger-500/20";

    return (
      <li
        key={cat.id}
        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border group transition-all ${
          cat.isChild ? `${childBgClass} ml-8` : bgClass
        }`}
      >
        <div className="flex items-center gap-3">
          {/* BULK DELETE CHECKBOX */}
          <input
            type="checkbox"
            checked={selectedCategories.includes(cat.id)}
            onChange={() => toggleSelection(cat.id)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
          <span
            className={`text-sm flex items-center gap-2 ${
              cat.isChild
                ? "text-text-secondary font-medium"
                : "text-text-primary font-bold"
            }`}
          >
            {cat.isChild && (
              <CornerDownRight className="w-4 h-4 text-text-muted shrink-0" />
            )}
            {cat.name}
          </span>
        </div>
        {deleteConfirm === cat.id ? (
          <div className="flex flex-col items-end gap-2 animate-fade-in pl-4">
            {!cat.isChild && categories.some((c) => c.parent_id === cat.id) && (
              <span className="text-xs text-danger-600 font-medium text-right mb-1">
                Dikkat: Bu ana kategoriyi silerseniz altındaki{" "}
                {categories.filter((c) => c.parent_id === cat.id).length} adet
                alt kategori de silinecektir.
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(cat.id)}
              >
                Sil
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
              >
                İptal
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(cat.id)}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-danger-600 hover:bg-danger-50 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <Tags className="w-7 h-7 text-primary-600" />
          Kategoriler
        </h1>
        <p className="text-text-secondary mt-1">
          Gelir ve gider kategorilerinizi yönetin.
        </p>
      </div>

      {/* Add Category Form */}
      <Card>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="Kategori Adı"
                id="categoryName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: İlaç Alımı"
                required
              />
            </div>
            <div className="w-48">
              <Select
                label="Tür"
                id="categoryType"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setParentId(""); // Tür değişince parent sıfırla
                }}
                options={TYPE_OPTIONS}
                placeholder="Tür seçin"
                required
              />
            </div>
            <Button type="submit" disabled={saving || !name.trim() || !type}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Ekle
            </Button>
          </div>

          {/* Alt Kategori Checkbox */}
          {type && parentOptions.length > 0 && (
            <div className="flex flex-col gap-3 pt-2 animate-fade-in">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSubcategory}
                  onChange={(e) => {
                    setIsSubcategory(e.target.checked);
                    if (!e.target.checked) setParentId("");
                  }}
                  className="w-4 h-4 rounded border-border text-primary-600 accent-primary-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-text-secondary">
                  Bu bir alt kategori mi?
                </span>
              </label>

              {/* Ana Kategori Seçimi — sadece checkbox işaretliyse açık */}
              {isSubcategory && (
                <div className="animate-fade-in pl-6 border-l-2 border-primary-100">
                  <Select
                    label="Hangi ana kategoriye ait olacak?"
                    id="parentCategory"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    options={parentOptions}
                    placeholder="Ana kategori seçin"
                    required={isSubcategory}
                  />
                </div>
              )}
            </div>
          )}
        </form>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading & Lists */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toplu Silme Butonu - Yalnızca seçim varsa gösterilir */}
          {selectedCategories.length > 0 && (
            <div className="flex justify-end animate-fade-in mb-2">
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="flex items-center gap-2 shadow-sm"
              >
                {isDeletingBulk ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckSquare className="w-4 h-4" />
                )}
                Seçilenleri Sil ({selectedCategories.length})
              </Button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Income Categories */}
            <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-success-600" />
              <h2 className="text-lg font-semibold text-text-primary">
                Gelir Kategorileri
              </h2>
              <span className="ml-auto text-xs font-medium bg-success-50 text-success-700 px-2 py-0.5 rounded-full">
                {categories.filter((c) => c.type === "income").length}
              </span>
            </div>
            {incomeCategories.length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">
                Henüz gelir kategorisi yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {incomeCategories.map((cat) =>
                  renderCategoryItem(cat, "income"),
                )}
              </ul>
            )}
          </Card>

          {/* Expense Categories */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-danger-600" />
              <h2 className="text-lg font-semibold text-text-primary">
                Gider Kategorileri
              </h2>
              <span className="ml-auto text-xs font-medium bg-danger-50 text-danger-700 px-2 py-0.5 rounded-full">
                {categories.filter((c) => c.type === "expense").length}
              </span>
            </div>
            {expenseCategories.length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">
                Henüz gider kategorisi yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {expenseCategories.map((cat) =>
                  renderCategoryItem(cat, "expense"),
                )}
              </ul>
            )}
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}
