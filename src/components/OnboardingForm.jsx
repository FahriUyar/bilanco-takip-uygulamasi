import { useState } from "react";
import { useProfile } from "../hooks/useProfile";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { defaultCategories } from "../lib/constants";
import { BarChart3, Loader2, Sparkles, CalendarDays, Type, Wallet, DownloadCloud, Info } from "lucide-react";

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
  const { user } = useAuth();
  
  const [name, setName] = useState("");
  const [salaryDay, setSalaryDay] = useState(1);
  const [accountType, setAccountType] = useState("personal");
  const [loadTemplate, setLoadTemplate] = useState(true);
  
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
      // 1. Kategorileri yükle (Eğer seçildiyse)
      if (loadTemplate && user) {
        for (const cat of defaultCategories) {
          // Ana kategoriyi ekle
          const { data: parentData, error: parentError } = await supabase
            .from("categories")
            .insert({
              name: cat.name,
              type: cat.type,
              user_id: user.id,
              parent_id: null,
            })
            .select()
            .single();

          if (parentError) throw parentError;

          // Alt kategoriler varsa ekle
          if (cat.subCategories && cat.subCategories.length > 0) {
            const subCatsToInsert = cat.subCategories.map((subName) => ({
              name: subName,
              type: cat.type,
              user_id: user.id,
              parent_id: parentData.id,
            }));

            const { error: subError } = await supabase
              .from("categories")
              .insert(subCatsToInsert);

            if (subError) throw subError;
          }
        }
      }

      // 2. Profili kaydet ve onboarding'i bitir
      await saveProfile({ 
        appName: name, 
        salaryDay: day, 
        accountType: accountType,
        isOnboarded: true 
      });

    } catch (err) {
      console.error("Kurulum hatası:", err);
      setError("Kurulum sırasında bir hata oluştu. Lütfen tekrar deneyin.");
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
          <p className="text-primary-100/90 text-[15px] max-w-sm mx-auto leading-relaxed">
            Sisteminizi kurmak için birkaç ufak sorumuz var. Merak etmeyin, bu tercihlerin hepsini daha sonra Ayarlar sayfasından dilediğiniz zaman değiştirebilirsiniz.
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
                className="flex items-center gap-2 text-sm font-medium text-text-primary"
              >
                <Type className="w-4 h-4 text-primary-500" />
                Uygulama İsmi
              </label>
              <input
                id="appName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Ev Bütçem, Eczane Bilançosu"
                required
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 font-medium"
              />
            </div>

            {/* 2) Maaş Günü */}
            <div className="space-y-2">
              <label
                htmlFor="salaryDay"
                className="flex items-center gap-2 text-sm font-medium text-text-primary"
              >
                <CalendarDays className="w-4 h-4 text-primary-500" />
                Bütçe Başlangıç / Maaş Günü
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
                className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 font-medium"
              />
            </div>

            {/* 3) Hesap Türü */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Wallet className="w-4 h-4 text-primary-500" />
                Hesap Türü / Görünüm Modu
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`relative flex flex-col p-3 cursor-pointer rounded-xl border-2 transition-all ${
                    accountType === "personal"
                      ? "border-primary-500 bg-primary-50"
                      : "border-border bg-white hover:border-primary-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold text-sm ${accountType === "personal" ? "text-primary-700" : "text-text-primary"}`}>
                      Bireysel
                    </span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${accountType === "personal" ? "border-primary-500" : "border-gray-300"}`}>
                      {accountType === "personal" && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight">
                    Nakit ve kredi kartı borcunuzu ayrı takip edin.
                  </p>
                  <input
                    type="radio"
                    name="accountType"
                    value="personal"
                    checked={accountType === "personal"}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="sr-only"
                  />
                </label>

                <label
                  className={`relative flex flex-col p-3 cursor-pointer rounded-xl border-2 transition-all ${
                    accountType === "business"
                      ? "border-primary-500 bg-primary-50"
                      : "border-border bg-white hover:border-primary-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold text-sm ${accountType === "business" ? "text-primary-700" : "text-text-primary"}`}>
                      İşletme
                    </span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${accountType === "business" ? "border-primary-500" : "border-gray-300"}`}>
                      {accountType === "business" && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight">
                    Sadece toplam gelir/gider bazlı sade görünüm.
                  </p>
                  <input
                    type="radio"
                    name="accountType"
                    value="business"
                    checked={accountType === "business"}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* 4) Şablon Yükleme */}
            <div className="pt-4 mt-2 border-t border-border">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="pt-0.5">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${loadTemplate ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300 group-hover:border-primary-400'}`}>
                    {loadTemplate && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={loadTemplate}
                    onChange={(e) => setLoadTemplate(e.target.checked)}
                  />
                </div>
                <div>
                  <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                    <DownloadCloud className="w-4 h-4 text-primary-600" />
                    Standart Ev Bütçesi Kategorilerini Yükle
                  </span>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Sıfırdan uğraşmayın. Sık kullanılan 10 ana (Market, Fatura vb.) ve 19 alt kategori hesabınıza otomatik tanımlansın.
                  </p>
                </div>
              </label>

              {loadTemplate && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800 leading-tight">
                    <strong className="font-semibold">Bilgi:</strong> Bu işlem sisteminize 30'a yakın hazır ana ve alt kategori ekleyecektir. İstemediğiniz kategorileri daha sonra rahatlıkla ayarlar bölümünden silebilirsiniz.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-base mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sistem Kuruluyor...
                </>
              ) : (
                "Kaydet ve Başla →"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
