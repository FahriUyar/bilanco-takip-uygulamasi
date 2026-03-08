import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function CategorySelect({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Dışarı tıklama kontrolü (Click Outside)
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Seçili olan etiketi (label) options tree'sinden bul
  const getSelectedLabel = () => {
    if (!value) return placeholder || "Kategori Seçin";

    // 1. Standalone'ları kontrol et
    const standaloneMatch = options.standalone?.find((opt) => opt.value === value);
    if (standaloneMatch) return standaloneMatch.label;

    // 2. Groups içindekileri kontrol et
    for (const group of options.groups || []) {
      const match = group.options?.find((opt) => opt.value === value);
      if (match) return match.label;
    }

    return placeholder || "Kategori Seçin";
  };

  const handleSelect = (selectedValue) => {
    // Dropdown'dan tıklanınca `event` gibi davranan bir obje yolluyoruz
    onChange({ target: { value: selectedValue } });
    setIsOpen(false);
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}

      {/* Tetikleyici Buton ve Dropdown İçin Ortak Relative Kapsayıcı */}
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-white text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            disabled ? "opacity-60 cursor-not-allowed bg-gray-50 bg-opacity-50 text-text-muted select-none" : "cursor-pointer"
          }`}
        >
          <span
            className={`truncate ${
              !value && !disabled ? "text-text-muted" : "text-text-primary"
            }`}
          >
            {disabled && !value ? "Önce tür seçin" : getSelectedLabel()}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        {/* Açılır Menü (Panel) */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-xl max-h-96 overflow-y-auto py-1 animate-fade-in custom-scrollbar">
          
          {/* Tekil (Standalone) Kategoriler */}
          {options.standalone?.length > 0 && (
            <div className="mb-1">
              {options.standalone.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                    value === opt.value
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-text-primary hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}

          {/* Gruplanmış Kategoriler (Ana -> Alt hiyerarşisi) */}
          {options.groups?.map((group) => (
            <div key={group.label} className="py-1">
              {/* Grup Başlığı (Ana Kategori - Tıklanamaz) */}
              <div className="px-4 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider bg-gray-50/50">
                {group.label}
              </div>
              
              {/* Alt Kategoriler (Tıklanabilir) */}
              <div className="mt-1">
                {group.options.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`pl-8 pr-4 py-2 text-sm cursor-pointer transition-colors border-l-2 ${
                      value === opt.value
                        ? "bg-primary-50 text-primary-700 border-primary-500 font-medium"
                        : "text-text-primary hover:bg-blue-50/50 hover:text-blue-700 border-transparent"
                    }`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {(!options.standalone?.length && !options.groups?.length) && (
            <div className="px-4 py-3 text-sm text-text-muted text-center cursor-default">
              Uygun kategori bulunamadı.
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
