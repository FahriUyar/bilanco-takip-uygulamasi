import { useState, useEffect } from "react";
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
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
];

export default function Categories() {
  // Görev 1: Kapıdaki kişiyi öğren
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    // Görev 2: Sadece bu kullanıcıya ait kategorileri çek
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

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !type) return;

    setSaving(true);
    setError("");

    // Görev 3: user_id NOT NULL olduğu için insert'e ekliyoruz
    const { error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: name.trim(), type });

    if (error) {
      setError("Kategori eklenirken hata oluştu.");
      console.error(error);
    } else {
      setName("");
      setType("");
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

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

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
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
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
              onChange={(e) => setType(e.target.value)}
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
                {incomeCategories.length}
              </span>
            </div>
            {incomeCategories.length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">
                Henüz gelir kategorisi yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {incomeCategories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-success-50/50 border border-success-500/10 group hover:border-success-500/30 transition-all"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {cat.name}
                    </span>
                    {deleteConfirm === cat.id ? (
                      <div className="flex items-center gap-2 animate-fade-in">
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
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(cat.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-danger-600 hover:bg-danger-50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
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
                {expenseCategories.length}
              </span>
            </div>
            {expenseCategories.length === 0 ? (
              <p className="text-text-muted text-sm py-4 text-center">
                Henüz gider kategorisi yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {expenseCategories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-danger-50/50 border border-danger-500/10 group hover:border-danger-500/30 transition-all"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {cat.name}
                    </span>
                    {deleteConfirm === cat.id ? (
                      <div className="flex items-center gap-2 animate-fade-in">
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
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(cat.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-danger-600 hover:bg-danger-50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
