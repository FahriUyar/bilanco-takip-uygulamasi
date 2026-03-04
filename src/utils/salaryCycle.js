/**
 * Maaş Döngüsü Hesaplama (Salary Cycle Calculator)
 *
 * Neden bu fonksiyon?
 * Standart takvim ayı (1-30/31) yerine, kullanıcının belirlediği
 * maaş gününe (salary_day) göre dönem başlangıç/bitiş tarihlerini
 * hesaplıyoruz. Böylece finansal özet gerçek harcama dönemine uyar.
 *
 * Örnek: Bugün 10 Mart, maaş günü 15 →
 *   Başlangıç: 15 Şubat
 *   Bitiş:     14 Mart (bir sonraki maaş gününden 1 gün önce)
 *
 * Ay/yıl geçişleri ve ayların farklı gün sayıları dikkate alınır.
 */

/**
 * Verilen tarihe göre mevcut maaş dönemini hesaplar.
 *
 * @param {Date}   referenceDate  - Referans tarih (genellikle bugün)
 * @param {number} salaryDay      - Maaş günü (1-31)
 * @returns {{ start: Date, end: Date, label: string }}
 */
export function getSalaryCycle(referenceDate, salaryDay = 1) {
  const day = salaryDay < 1 ? 1 : salaryDay > 31 ? 31 : salaryDay;
  const ref = new Date(referenceDate);
  const currentDay = ref.getDate();

  let startYear, startMonth, endYear, endMonth;

  if (day === 1) {
    // Özel durum: maaş günü 1 ise standart takvim ayı gibi davran
    startYear = ref.getFullYear();
    startMonth = ref.getMonth();
    endYear = startMonth === 11 ? startYear + 1 : startYear;
    endMonth = startMonth === 11 ? 0 : startMonth + 1;

    return {
      start: new Date(startYear, startMonth, 1),
      end: new Date(endYear, endMonth, 0), // son gün (ayın son günü)
      label: formatCycleLabel(
        new Date(startYear, startMonth, 1),
        new Date(endYear, endMonth, 0),
      ),
    };
  }

  if (currentDay >= day) {
    // Maaş günü bu ay içinde geçmiş veya bugün → dönem bu aydan başlıyor
    startYear = ref.getFullYear();
    startMonth = ref.getMonth();
  } else {
    // Maaş günü henüz gelmedi → dönem geçen aydan başlıyor
    startMonth = ref.getMonth() - 1;
    startYear = ref.getFullYear();
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  // Bitiş: bir sonraki maaş gününden 1 gün önce
  endMonth = startMonth + 1;
  endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }

  // Ayların farklı gün sayılarını dikkate al.
  // Eğer salary_day ayın toplam gün sayısından büyükse, ayın son gününü kullan.
  const startDate = new Date(
    startYear,
    startMonth,
    Math.min(day, daysInMonth(startYear, startMonth)),
  );

  const endDate = new Date(
    endYear,
    endMonth,
    Math.min(day, daysInMonth(endYear, endMonth)) - 1,
  );

  return {
    start: startDate,
    end: endDate,
    label: formatCycleLabel(startDate, endDate),
  };
}

/**
 * Bir önceki veya sonraki döneme geçiş yapmak için
 * offset kadar dönem ileri/geri gider.
 *
 * @param {Date}   currentStart   - Mevcut dönemin başlangıç tarihi
 * @param {number} salaryDay      - Maaş günü
 * @param {number} offset         - -1 = önceki dönem, +1 = sonraki dönem
 * @returns {{ start: Date, end: Date, label: string }}
 */
export function shiftCycle(currentStart, salaryDay, offset) {
  const shifted = new Date(currentStart);
  shifted.setMonth(shifted.getMonth() + offset);
  return getSalaryCycle(shifted, salaryDay);
}

/**
 * Dönem tarihlerini Supabase sorgusuna uygun ISO string formatına çevirir.
 * @returns {{ startISO: string, endISO: string }}
 */
export function cycleToDatabaseRange(cycle) {
  const startISO = formatDateISO(cycle.start);
  // end günü dahil → bir sonraki gün başlangıcını exclusive filtre olarak kullan
  const endExclusive = new Date(cycle.end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endISO = formatDateISO(endExclusive);
  return { startISO, endISO };
}

// ─── Yardımcı fonksiyonlar ───────────────────────────────────

function daysInMonth(year, month) {
  // month 0-indexed (0=Ocak). new Date(y, m+1, 0) → o ayın son günü.
  return new Date(year, month + 1, 0).getDate();
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES_TR = [
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

function formatCycleLabel(start, end) {
  const sDay = start.getDate();
  const sMonth = MONTH_NAMES_TR[start.getMonth()];
  const eDay = end.getDate();
  const eMonth = MONTH_NAMES_TR[end.getMonth()];
  const eYear = end.getFullYear();

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${sDay} – ${eDay} ${sMonth} ${eYear}`;
  }

  return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${eYear}`;
}
