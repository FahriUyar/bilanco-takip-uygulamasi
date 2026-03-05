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
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
          cat.isChild ? `${childBgClass} ml-6` : bgClass
        }`}
      >
        <span
          className={`text-sm font-medium text-text-primary flex items-center gap-2 ${
            cat.isChild ? "text-text-secondary" : ""
          }`}
        >
          {cat.isChild && (
            <CornerDownRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
          )}
          {cat.name}
        </span>
        {deleteConfirm === cat.id ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(cat.id)}
            >
              {!cat.isChild && categories.some((c) => c.parent_id === cat.id)
                ? "Alt kategorilerle birlikte sil"
                : "Sil"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(null)}
            >
              İptal
            </Button>
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

          {/* Ana kategori seçimi — sadece ilgili tür seçildiyse ve ana kategori varsa göster */}
          {type && parentOptions.length > 0 && (
            <div className="animate-fade-in">
              <Select
                label="Ana Kategori (opsiyonel — boş bırakırsan ana kategori olur)"
                id="parentCategory"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                options={parentOptions}
                placeholder="Ana kategori (yok — kendisi ana)"
              />
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

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : (
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
      )}
    </div>
  );
}
