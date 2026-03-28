import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const DAY_NAMES = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

const pad = (n) => String(n).padStart(2, "0");

export default function DatePicker({
  label,
  id,
  value, // "YYYY-MM-DD"
  onChange, // (dateStr) => void
  error,
  className = "",
  isOpen, // Optional controlled state
  onOpenChange, // Optional callback for open state changes
  minDate, // "YYYY-MM-DD"
  align = "left", // "left" | "right"
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Eğer dışarıdan isOpen geliyorsa onu kullan, yoksa iç state'i
  const open = isOpen !== undefined ? isOpen : internalOpen;
  
  const handleOpenChange = (newOpen) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const ref = useRef(null);

  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  // Takvim açıldığında veya referans tarihler dışarıdan değiştiğinde görünümü güncelle
  useEffect(() => {
    if (open) {
      const referenceDate = value
        ? new Date(value + "T00:00:00")
        : minDate
          ? new Date(minDate + "T00:00:00")
          : new Date();
      setViewYear(referenceDate.getFullYear());
      setViewMonth(referenceDate.getMonth());
    }
  }, [open, value, minDate]);

  // Dışarıya tıklayınca kapat
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        if (onOpenChange) {
          onOpenChange(false);
        } else {
          setInternalOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOpenChange]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onChange(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
    handleOpenChange(false);
  };

  const selectDay = (day) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
    handleOpenChange(false);
  };

  // Ayın günlerini hesapla
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  // Pazartesi = 0 olacak şekilde ayarla
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  // Önceki ayın günleri
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false });
  }
  // Bu ayın günleri
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, current: true });
  }
  // Sonraki ayın günleri (6 satıra tamamla)
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false });
  }

  const isToday = (day) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const isSelected = (day) =>
    value &&
    day === selected.getDate() &&
    viewMonth === selected.getMonth() &&
    viewYear === selected.getFullYear();

  const displayDate = value
    ? `${pad(selected.getDate())} ${MONTH_NAMES[selected.getMonth()]} ${selected.getFullYear()}`
    : "Tarih seçin";

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        id={id}
        onClick={() => handleOpenChange(!open)}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-white text-left transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
          error ? "border-danger-500" : ""
        } ${value ? "text-text-primary" : "text-text-muted"} ${className}`}
      >
        <Calendar className="w-4 h-4 text-primary-500 shrink-0" />
        <span className="text-sm font-medium">{displayDate}</span>
      </button>

      {/* Dropdown Calendar */}
      {open && (
        <div className={`absolute z-50 mt-1 w-[320px] bg-white rounded-2xl shadow-xl border border-border p-4 animate-fade-in ${align === "right" ? "right-0" : "left-0"}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-text-primary">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-text-muted py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              let disabled = !cell.current;
              if (cell.current && minDate) {
                const cellDate = new Date(viewYear, viewMonth, cell.day);
                const minD = new Date(minDate + "T00:00:00");
                cellDate.setHours(0, 0, 0, 0);
                minD.setHours(0, 0, 0, 0);
                if (cellDate < minD) {
                  disabled = true;
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && selectDay(cell.day)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all duration-150 ${
                    disabled
                      ? "text-text-muted/40 cursor-not-allowed"
                      : cell.current && isSelected(cell.day)
                        ? "bg-primary-600 text-white font-semibold shadow-sm cursor-pointer"
                        : cell.current && isToday(cell.day)
                          ? "bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-200 cursor-pointer"
                          : "text-text-primary hover:bg-gray-100 cursor-pointer"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-center mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={goToday}
              className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
            >
              Bugün
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
