import { useState } from "react";
import { useProfile } from "../hooks/useProfile";
import { BarChart3, Loader2, Sparkles, CalendarDays } from "lucide-react";

/**
 * OnboardingForm
 *
 * Neden iki soru?
 * 1) app_name — Header'da gösterilecek kişisel isim
 * 2) salary_day — Maaş döngüsü için başlangıç günü
 * Her ikisi de profiles tablosuna tek upsert ile kaydedilir.
 */

export default function OnboardingForm() {
  const { saveProfile } = useProfile();
  const [name, setName] = useState("");
  const [salaryDay, setSalaryDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSalaryDayChange = (e) => {
    const val = e.target.value;
    // Boş bırakabilsin, ama sadece sayı kabul et
    if (val === "") {
      setSalaryDay("");
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      setSalaryDay(num);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const day = Number(salaryDay) || 1;

    setError("");
    setLoading(true);

    try {
      await saveProfile({ appName: name, salaryDay: day });
    } catch (err) {
      console.error("Profil kayıt hatası:", err);
      setError("Kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-sidebar p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-3xl shadow-lg shadow-primary-600/30 mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Hoş Geldiniz! 🎉
          </h1>
          <p className="text-primary-200/70 text-lg">
            Hadi uygulamanızı kişiselleştirelim.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl border border-white/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Kurulum
              </h2>
              <p className="text-sm text-text-muted">
                İki kısa adım — hepsi bu kadar
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1) Uygulama İsmi */}
            <div className="space-y-2">
              <label
                htmlFor="appName"
                className="block text-sm font-medium text-text-primary"
              >
                Uygulamanıza bir isim verin
              </label>
              <input
                id="appName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Ev Bütçem, Eczane Bilançosu, Mağaza Takip"
                required
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-lg"
              />
              <p className="text-xs text-text-muted">
                Bu isim uygulamanızın header kısmında görünecek.
              </p>
            </div>

            {/* 2) Maaş Günü */}
            <div className="space-y-2">
              <label
                htmlFor="salaryDay"
                className="block text-sm font-medium text-text-primary flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4 text-primary-500" />
                Bütçe Başlangıç / Maaş Gününüz
              </label>
              <input
                id="salaryDay"
                type="number"
                min={1}
                max={31}
                value={salaryDay}
                onChange={handleSalaryDayChange}
                placeholder="Örn: 15"
                required
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-lg"
              />
              <p className="text-xs text-text-muted">
                Ayın hangi günü maaş/gelir alıyorsunuz? Dönem hesabı bu güne
                göre yapılacak. (1-31 arası)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Başlayalım →"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
