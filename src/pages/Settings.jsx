import { useState, useEffect } from "react";
import { useProfile } from "../hooks/useProfile";
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Check,
  CalendarDays,
  Type,
} from "lucide-react";
import Card from "../components/ui/Card";

/**
 * Settings (Ayarlar) Sayfası
 *
 * Neden bu sayfa?
 * Kullanıcının onboarding'de girdiği app_name ve salary_day
 * bilgilerini sonradan değiştirebilmesi gerekiyor.
 * ProfileContext'ten mevcut değerleri çeker, formda gösterir,
 * güncelleme sonrası Context'i de günceller.
 */

export default function Settings() {
  const { appName, salaryDay, saveProfile } = useProfile();

  const [formName, setFormName] = useState("");
  const [formSalaryDay, setFormSalaryDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Mevcut profil verilerini form'a doldur
  useEffect(() => {
    if (appName) setFormName(appName);
    if (salaryDay) setFormSalaryDay(salaryDay);
  }, [appName, salaryDay]);

  const handleSalaryDayChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      setFormSalaryDay("");
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      setFormSalaryDay(num);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      await saveProfile({
        appName: formName,
        salaryDay: Number(formSalaryDay) || 1,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Ayarlar güncelleme hatası:", err);
      setError("Güncelleme sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-primary-600" />
          Ayarlar
        </h1>
        <p className="text-text-secondary mt-1">
          Uygulama ismi ve bütçe döngüsü tercihlerinizi yönetin.
        </p>
      </div>

      {/* Success Toast */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success-50 border border-success-500/20 text-success-700 text-sm font-medium animate-fade-in">
          <Check className="w-4 h-4" />
          Ayarlar başarıyla güncellendi!
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm animate-fade-in">
          {error}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Uygulama İsmi */}
          <div className="space-y-2">
            <label
              htmlFor="settingsAppName"
              className="flex items-center gap-2 text-sm font-medium text-text-primary"
            >
              <Type className="w-4 h-4 text-primary-500" />
              Uygulama İsmi
            </label>
            <input
              id="settingsAppName"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Örn: Ev Bütçem, Eczane Bilançosu"
              required
              maxLength={50}
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            />
            <p className="text-xs text-text-muted">
              Sidebar ve Header'da görüntülenecek isim.
            </p>
          </div>

          {/* Maaş Günü */}
          <div className="space-y-2">
            <label
              htmlFor="settingsSalaryDay"
              className="flex items-center gap-2 text-sm font-medium text-text-primary"
            >
              <CalendarDays className="w-4 h-4 text-primary-500" />
              Bütçe Başlangıç / Maaş Günü
            </label>
            <input
              id="settingsSalaryDay"
              type="number"
              min={1}
              max={31}
              value={formSalaryDay}
              onChange={handleSalaryDayChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            />
            <p className="text-xs text-text-muted">
              Dashboard'daki dönem hesabı bu güne göre yapılır. (1 = ayın başı,
              15 = ayın ortası, vb.)
            </p>
          </div>

          {/* Kaydet */}
          <button
            type="submit"
            disabled={saving || !formName.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Güncelleniyor...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Güncelle
              </>
            )}
          </button>
        </form>
      </Card>
    </div>
  );
}
