import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * Neden tek sayfada iki tab?
 * Kullanıcıyı ayrı bir /register rotasına yönlendirmek yerine,
 * aynı kart içinde "Giriş Yap / Kayıt Ol" tabları sunuyoruz.
 * Böylece UX daha akıcı ve tek bir bileşenle yönetilebilir.
 */

const INVITE_CODE = "FAHRI_VIP_2026";

export default function Login() {
  const [activeTab, setActiveTab] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setReferralCode("");
    setError("");
    setSuccess("");
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetForm();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "E-posta veya şifre hatalı."
          : err.message?.includes("Email not confirmed")
            ? "E-posta adresiniz henüz doğrulanmamış. Supabase panelinden kullanıcıyı onaylayın."
            : `Giriş hatası: ${err.message || "Bilinmeyen hata. Lütfen tekrar deneyin."}`,
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Neden frontend'de davet kodu kontrolü?
   * Bu bir "hız kesici" (speed bump) — internetten URL'yi bulan herkesin
   * rasgele kayıt olmasını engeller. Davet kodu eşleşmezse
   * supabase.auth.signUp KESİNLİKLE çağrılmaz.
   */
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Davet kodu doğrulaması — eşleşmezse Supabase'e istek bile atmıyoruz
    if (referralCode.trim() !== INVITE_CODE) {
      setError("Geçersiz Davet Kodu. Lütfen size verilen kodu girin.");
      setLoading(false);
      return;
    }

    try {
      await signUp(email, password);
      setSuccess("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz.");
      // Kayıt sonrası otomatik giriş tabına geçiş (3 sn sonra)
      setTimeout(() => {
        setActiveTab("login");
        setSuccess("");
        setEmail("");
        setPassword("");
        setReferralCode("");
      }, 3000);
    } catch (err) {
      setError(
        err.message ||
          "Kayıt yapılırken bir hata oluştu. Lütfen tekrar deneyin.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isLogin = activeTab === "login";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-sidebar p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Bilanço Takip"
            className="h-24 mx-auto drop-shadow-lg"
          />
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl border border-white/10 p-8">
          {/* Tabs */}
          <div className="flex mb-6 bg-surface rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleTabChange("login")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                isLogin
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("register")}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                !isLogin
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Kayıt Ol
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-success-50 border border-success-500/20 text-success-700 text-sm animate-fade-in">
              {success}
            </div>
          )}

          <form
            onSubmit={isLogin ? handleLogin : handleRegister}
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-primary"
              >
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary"
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 pr-12 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Davet Kodu — sadece Kayıt Ol modunda */}
            {!isLogin && (
              <div className="space-y-1.5 animate-fade-in">
                <label
                  htmlFor="referralCode"
                  className="block text-sm font-medium text-text-primary"
                >
                  Davet Kodu
                </label>
                <input
                  id="referralCode"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Size verilen davet kodunu girin"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                />
                <p className="text-xs text-text-muted">
                  Kayıt olmak için geçerli bir davet koduna ihtiyacınız var.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isLogin ? "Giriş yapılıyor..." : "Kayıt yapılıyor..."}
                </>
              ) : isLogin ? (
                "Giriş Yap"
              ) : (
                "Kayıt Ol"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-200/40 text-xs mt-6">
          © 2026 Bilanço Takip — Finansal Yönetim
        </p>
      </div>
    </div>
  );
}
