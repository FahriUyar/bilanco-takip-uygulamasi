import { useState } from "react";
import { useProfile } from "../hooks/useProfile";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { defaultCategories } from "../lib/constants";
import { 
  BarChart3, 
  Loader2, 
  Sparkles, 
  CalendarDays, 
  Type, 
  Wallet, 
  Info,
  ArrowRight,
  ArrowLeft
} from "lucide-react";

export default function OnboardingForm() {
  const { saveProfile } = useProfile();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("");
  const [salaryDay, setSalaryDay] = useState(1);
  const [accountType, setAccountType] = useState("personal");
  const [loadTemplate, setLoadTemplate] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSalaryDayChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      setSalaryDay("");
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      setSalaryDay(num);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !name.trim()) {
      setError("Lütfen çalışma alanı adını girin.");
      return;
    }
    setError("");
    setCurrentStep((p) => p + 1);
  };

  const prevStep = () => {
    setError("");
    setCurrentStep((p) => p - 1);
  };

  const handleSubmit = async () => {
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
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* ─────────────────────────────────────────────────────────
          LEFT PANE (SPLIT SCREEN BACKGROUND)
      ────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/3 bg-primary-900 relative flex-col justify-between p-12 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <BarChart3 className="w-8 h-8 text-primary-400" />
            <span className="text-xl font-bold text-white tracking-wide">Bilanço</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-6">
            Finansal kontrolünüzü elinize alın.
          </h1>
          <p className="text-primary-100/80 text-lg leading-relaxed max-w-sm">
            Gelir ve giderlerinizi profesyonel bir şekilde takip etmek için sisteminizi saniyeler içinde kurun.
          </p>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary-700 border-2 border-primary-900 flex items-center justify-center text-white text-xs font-bold">🎯</div>
              <div className="w-10 h-10 rounded-full bg-primary-600 border-2 border-primary-900 flex items-center justify-center text-white text-xs font-bold">✨</div>
            </div>
            <p className="text-sm text-primary-200">Kişiselleştirilmiş deneyim</p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          RIGHT PANE (FORM AREA)
      ────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-2/3 flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-y-auto">
        
        {loading ? (
          /* LOADING UI STATE */
          <div className="flex flex-col items-center justify-center text-center animate-fade-in w-full max-w-sm">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">Çalışma alanınız hazırlanıyor...</h2>
            <p className="text-text-secondary text-sm">Bu işlem sadece birkaç saniye sürecek. Lütfen bekleyin.</p>
          </div>
        ) : (
          /* WIZARD STATES */
          <div className="w-full max-w-md animate-fade-in">
            
            {/* PROGRESS BAR */}
            <div className="mb-10">
              <div className="flex justify-between mb-2">
                {["Karşılama", "Hesap Türü", "Otomasyon"].map((stepText, idx) => (
                  <span key={idx} className={`text-xs font-semibold ${currentStep >= idx + 1 ? 'text-primary-600' : 'text-text-muted transition-colors duration-500'}`}>
                    ADIM {idx + 1}
                  </span>
                ))}
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-primary-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                />
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm animate-fade-in flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* STEP 1 */}
            <div className="min-h-[280px]">
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">Çalışma Alanı Adı</h2>
                    <p className="text-text-secondary text-sm">Finansal alanınızı isimlendirin. Bu ismi daha sonra değiştirebilirsiniz.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="appName" className="text-sm font-semibold text-text-secondary">Çalışma Alanı Adı</label>
                    <div className="relative">
                      <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <input
                        id="appName"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Örn: Ev Bütçem, Eczane Bilançosu"
                        required
                        maxLength={50}
                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-medium text-base shadow-sm"
                        onKeyDown={(e) => e.key === "Enter" && nextStep()}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div className="space-y-8 animate-fade-in">
                  <div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">Hesap Türünüz</h2>
                    <p className="text-text-secondary text-sm">Uygulamayı hangi amaçla kullanacağınızı seçin.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setAccountType("personal")}
                      className={`relative flex flex-col items-center justify-center p-5 cursor-pointer rounded-2xl border-2 transition-all duration-200 text-center ${
                        accountType === "personal"
                        ? "border-primary-600 bg-primary-50/50 shadow-md shadow-primary-500/10"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center transition-colors ${accountType === "personal" ? "bg-primary-600 text-white" : "bg-gray-100 text-text-secondary"}`}>
                        <Wallet className="w-6 h-6" />
                      </div>
                      <span className={`font-bold text-base mb-1 ${accountType === "personal" ? "text-primary-700" : "text-text-primary"}`}>Bireysel</span>
                      <p className="text-[11px] text-text-muted leading-relaxed">Aylık gelir ve giderlerinizi basitçe takip edin.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccountType("business")}
                      className={`relative flex flex-col items-center justify-center p-5 cursor-pointer rounded-2xl border-2 transition-all duration-200 text-center ${
                        accountType === "business"
                        ? "border-primary-600 bg-primary-50/50 shadow-md shadow-primary-500/10"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center transition-colors ${accountType === "business" ? "bg-primary-600 text-white" : "bg-gray-100 text-text-secondary"}`}>
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <span className={`font-bold text-base mb-1 ${accountType === "business" ? "text-primary-700" : "text-text-primary"}`}>İşletme</span>
                      <p className="text-[11px] text-text-muted leading-relaxed">Sadece toplam gelir/gider bazlı sade görünüm.</p>
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label htmlFor="salaryDay" className="text-sm font-semibold text-text-secondary">Bütçe Başlangıç / Maaş Günü</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <input
                        id="salaryDay"
                        type="number"
                        min={1}
                        max={31}
                        value={salaryDay}
                        onChange={handleSalaryDayChange}
                        placeholder="Örn: 15"
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-medium text-base shadow-sm"
                        onKeyDown={(e) => e.key === "Enter" && nextStep()}
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 ml-1">Aylık raporlamalar bu güne baz alınarak hesaplanır.</p>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">Kategori Otomasyonu</h2>
                    <p className="text-text-secondary text-sm">Zaman kazanmak için hazır ayarlarla başlayın.</p>
                  </div>
                  
                  <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-text-primary text-base mb-1">Standart Kategorileri Oluştur</h3>
                        <p className="text-sm text-text-secondary leading-relaxed mb-4 pr-1">
                          Sizin için standart gelir-gider kategorilerini (Market, Fatura, Maaş vb.) oluşturalım mı? Daha sonra isterseniz değiştirebilirsiniz.
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-text-secondary shadow-sm">Market</span>
                          <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-text-secondary shadow-sm">Faturalar</span>
                          <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-text-secondary shadow-sm">Ulaşım</span>
                          <span className="px-2.5 py-1 text-text-muted flex items-center">+20 daha</span>
                        </div>
                      </div>
                      
                      {/* Custom Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => setLoadTemplate(!loadTemplate)}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 ${loadTemplate ? 'bg-primary-600' : 'bg-gray-200'}`}
                        role="switch"
                        aria-checked={loadTemplate}
                      >
                        <span className="sr-only">Şablon yükle</span>
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${loadTemplate ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* NAVIGATION BUTTONS */}
            <div className="flex items-center gap-3 pt-6 border-t border-gray-100 mt-6">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-5 py-3.5 rounded-xl border border-gray-200 bg-white text-text-primary font-semibold hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Geri
                </button>
              )}
              
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-text-primary text-white font-semibold rounded-xl hover:bg-black focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 transition-all shadow-sm shadow-gray-400/20"
                >
                  Devam Et
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all shadow-md shadow-primary-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Kurulumu Tamamla
                </button>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
