import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
} from "lucide-react";

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
const MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatCurrencyFull = (amount) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);

const formatPercent = (value) => {
  if (!isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

export default function Reports() {
  // Görev 1: Kapıdaki kişiyi öğren
  const { user } = useAuth();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [yearlyData, setYearlyData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category trend
  const [selectedCategory, setSelectedCategory] = useState("");

  // Month comparison
  const [compareMonth, setCompareMonth] = useState(now.getMonth());

  // Tooltip
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchYearlyData();
  }, [selectedYear]);

  const fetchCategories = async () => {
    // Görev 2: Sadece bu kullanıcıya ait kategorileri çek
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setCategories(data || []);
  };

  const fetchYearlyData = async () => {
    setLoading(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear + 1}-01-01`;

    // Görev 2: Sadece bu kullanıcıya ait yıllık verileri çek
    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(name, parent_id)")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lt("date", endDate)
      .order("date", { ascending: true });

    if (error) {
      console.error(error);
      setYearlyData([]);
    } else {
      setYearlyData(data || []);
    }
    setLoading(false);
  };

  // ─── Monthly breakdown ───
  const monthlyBreakdown = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      income: 0,
      expense: 0,
    }));

    yearlyData.forEach((tx) => {
      const m = new Date(tx.date).getMonth();
      const amount = Number(tx.amount);
      if (tx.type === "income") months[m].income += amount;
      else if (!tx.is_transfer) months[m].expense += amount;
    });

    return months;
  }, [yearlyData]);

  // ─── Yearly totals ───
  const yearlyTotals = useMemo(() => {
    const income = monthlyBreakdown.reduce((s, m) => s + m.income, 0);
    const expense = monthlyBreakdown.reduce((s, m) => s + m.expense, 0);
    return { income, expense, net: income - expense };
  }, [monthlyBreakdown]);

  // ─── Bar chart calculations ───
  const chartData = useMemo(() => {
    const maxValue = Math.max(
      ...monthlyBreakdown.map((m) => Math.max(m.income, m.expense)),
      1,
    );
    return { maxValue, months: monthlyBreakdown };
  }, [monthlyBreakdown]);

  // ─── Category trend (last 6 months from current date) ───
  const categoryTrendData = useMemo(() => {
    if (!selectedCategory) return [];

    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = now.getMonth() - i;
      let y = now.getFullYear();
      if (m < 0) {
        m += 12;
        y -= 1;
      }

      const total = yearlyData
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return (
            tx.category_id === selectedCategory &&
            txDate.getMonth() === m &&
            txDate.getFullYear() === y
          );
        })
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      result.push({ month: m, year: y, total, label: `${MONTH_SHORT[m]}` });
    }
    return result;
  }, [yearlyData, selectedCategory, now]);

  const categoryTrendMax = useMemo(
    () => Math.max(...categoryTrendData.map((d) => d.total), 1),
    [categoryTrendData],
  );

  const categoryTrendAvg = useMemo(() => {
    if (categoryTrendData.length === 0) return 0;
    const total = categoryTrendData.reduce((s, d) => s + d.total, 0);
    return total / categoryTrendData.length;
  }, [categoryTrendData]);

  // ─── Month comparison ───
  const comparison = useMemo(() => {
    const current = monthlyBreakdown[compareMonth];
    const prevIdx = compareMonth === 0 ? 11 : compareMonth - 1;
    const previous = monthlyBreakdown[prevIdx];

    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    // Category breakdown for current month
    const currentCategoryMap = {};
    const prevMonth = compareMonth === 0 ? 11 : compareMonth - 1;

    yearlyData
      .filter((tx) => !tx.is_transfer)
      .forEach((tx) => {
        const txMonth = new Date(tx.date).getMonth();
        const cat = tx.categories;
        // Alt kategori ise ana kategoriye topla
        let catName;
        if (cat?.parent_id) {
          const parent = categories.find((c) => c.id === cat.parent_id);
          catName = parent?.name || cat?.name || "Kategorisiz";
        } else {
          catName = cat?.name || "Kategorisiz";
        }

        if (txMonth === compareMonth) {
          if (!currentCategoryMap[catName])
            currentCategoryMap[catName] = {
              current: 0,
              previous: 0,
              type: tx.type,
            };
          currentCategoryMap[catName].current += Number(tx.amount);
        }
        if (txMonth === prevMonth) {
          if (!currentCategoryMap[catName])
            currentCategoryMap[catName] = {
              current: 0,
              previous: 0,
              type: tx.type,
            };
          currentCategoryMap[catName].previous += Number(tx.amount);
        }
      });

    const categoryComparison = Object.entries(currentCategoryMap)
      .map(([name, data]) => ({
        name,
        ...data,
        change: calcChange(data.current, data.previous),
      }))
      .sort((a, b) => b.current - a.current);

    return {
      current,
      previous,
      incomeChange: calcChange(current.income, previous.income),
      expenseChange: calcChange(current.expense, previous.expense),
      netChange: calcChange(
        current.income - current.expense,
        previous.income - previous.expense,
      ),
      categoryComparison,
      prevMonthName:
        compareMonth === 0 ? MONTH_NAMES[11] : MONTH_NAMES[compareMonth - 1],
    };
  }, [monthlyBreakdown, compareMonth, yearlyData]);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.type === "income" ? "Gelir" : "Gider"})`,
      })),
    [categories],
  );

  const compareMonthOptions = useMemo(
    () => MONTH_NAMES.map((name, i) => ({ value: i, label: name })),
    [],
  );

  // ─── Change indicator component ───
  const ChangeIndicator = ({ value, inverse = false }) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const isNegative = inverse ? value > 0 : value < 0;
    const isZero = value === 0 || !isFinite(value);

    return (
      <span
        className={`inline-flex items-center gap-1 text-sm font-semibold ${
          isPositive
            ? "text-success-700"
            : isNegative
              ? "text-danger-700"
              : "text-text-muted"
        }`}
      >
        {isPositive ? (
          <ArrowUpRight className="w-4 h-4" />
        ) : isNegative ? (
          <ArrowDownRight className="w-4 h-4" />
        ) : (
          <Minus className="w-4 h-4" />
        )}
        {formatPercent(value)}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-primary-600" />
          Raporlar
        </h1>
        <p className="text-text-secondary mt-1">
          Yıllık analiz, kategori trendleri ve ay karşılaştırması.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* ═══════════════════════════════════════════
              SECTION 1: YEARLY OVERVIEW
          ═══════════════════════════════════════════ */}
          <div className="space-y-4">
            {/* Year Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Yıllık Özet
              </h2>
              <Card padding="p-2" className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-semibold text-text-primary min-w-[60px] text-center">
                  {selectedYear}
                </span>
                <button
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </Card>
            </div>

            {/* Yearly Summary Cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-success-600" />
                  </div>
                  <span className="text-sm text-text-secondary">
                    Yıllık Gelir
                  </span>
                </div>
                <p className="text-xl font-bold text-success-700">
                  {formatCurrencyFull(yearlyTotals.income)}
                </p>
              </Card>
              <Card className="relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-danger-50 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-danger-600" />
                  </div>
                  <span className="text-sm text-text-secondary">
                    Yıllık Gider
                  </span>
                </div>
                <p className="text-xl font-bold text-danger-700">
                  {formatCurrencyFull(yearlyTotals.expense)}
                </p>
              </Card>
              <Card
                className={`relative overflow-hidden ring-1 ${
                  yearlyTotals.net >= 0 ? "ring-success-200" : "ring-danger-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      yearlyTotals.net >= 0 ? "bg-primary-50" : "bg-warning-50"
                    }`}
                  >
                    <Wallet
                      className={`w-4 h-4 ${
                        yearlyTotals.net >= 0
                          ? "text-primary-600"
                          : "text-warning-600"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-text-secondary">
                    Yıllık Net
                  </span>
                </div>
                <p
                  className={`text-xl font-bold ${
                    yearlyTotals.net >= 0
                      ? "text-primary-700"
                      : "text-danger-700"
                  }`}
                >
                  {formatCurrencyFull(yearlyTotals.net)}
                </p>
              </Card>
            </div>

            {/* Bar Chart */}
            <Card>
              <h3 className="text-sm font-semibold text-text-secondary mb-4">
                Aylık Gelir / Gider Karşılaştırması
              </h3>
              <div className="relative">
                <svg
                  viewBox="0 0 720 330"
                  className="w-full"
                  style={{ minHeight: 220 }}
                >
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = 290 - ratio * 220;
                    return (
                      <g key={ratio}>
                        <line
                          x1="50"
                          y1={y}
                          x2="700"
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray={ratio === 0 ? "0" : "4,4"}
                        />
                        <text
                          x="46"
                          y={y + 4}
                          textAnchor="end"
                          className="fill-text-muted"
                          fontSize="9"
                        >
                          {formatCurrency(chartData.maxValue * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars */}
                  {chartData.months.map((m, i) => {
                    const groupX = 60 + i * 54;
                    const barWidth = 18;
                    const incomeH = (m.income / chartData.maxValue) * 220;
                    const expenseH = (m.expense / chartData.maxValue) * 220;

                    return (
                      <g
                        key={i}
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                        className="cursor-pointer"
                      >
                        {/* Hover background */}
                        {hoveredBar === i && (
                          <rect
                            x={groupX - 6}
                            y="60"
                            width={barWidth * 2 + 16}
                            height="240"
                            fill="#f8fafc"
                            rx="4"
                          />
                        )}
                        {/* Income bar */}
                        <rect
                          x={groupX}
                          y={290 - incomeH}
                          width={barWidth}
                          height={Math.max(incomeH, 0)}
                          fill="#22c55e"
                          rx="3"
                          className="transition-all duration-300"
                          opacity={hoveredBar === i ? 1 : 0.85}
                        />
                        {/* Expense bar */}
                        <rect
                          x={groupX + barWidth + 4}
                          y={290 - expenseH}
                          width={barWidth}
                          height={Math.max(expenseH, 0)}
                          fill="#ef4444"
                          rx="3"
                          className="transition-all duration-300"
                          opacity={hoveredBar === i ? 1 : 0.85}
                        />
                        {/* Month label */}
                        <text
                          x={groupX + barWidth + 2}
                          y="310"
                          textAnchor="middle"
                          className="fill-text-secondary"
                          fontSize="10"
                          fontWeight={hoveredBar === i ? "600" : "400"}
                        >
                          {MONTH_SHORT[i]}
                        </text>

                        {/* Tooltip */}
                        {hoveredBar === i && (
                          <g>
                            <rect
                              x={groupX - 25}
                              y="4"
                              width="130"
                              height="48"
                              fill="white"
                              stroke="#e2e8f0"
                              rx="8"
                              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.1))"
                            />
                            <text
                              x={groupX - 16}
                              y="24"
                              fontSize="11"
                              className="fill-success-700"
                              fontWeight="600"
                            >
                              Gelir: {formatCurrency(m.income)}
                            </text>
                            <text
                              x={groupX - 16}
                              y="42"
                              fontSize="11"
                              className="fill-danger-700"
                              fontWeight="600"
                            >
                              Gider: {formatCurrency(m.expense)}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className="w-3 h-3 rounded-sm bg-success-500" />
                    Gelir
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span className="w-3 h-3 rounded-sm bg-danger-500" />
                    Gider
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 2 & 3: CATEGORY TREND + COMPARISON
          ═══════════════════════════════════════════ */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Category Trend */}
            <Card>
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Kategori Bazlı Trend
              </h3>
              <div className="mb-4">
                <Select
                  label="Kategori Seçin"
                  id="trendCategory"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  options={categoryOptions}
                  placeholder="Bir kategori seçin"
                />
              </div>

              {selectedCategory ? (
                <div>
                  {/* Mini stats */}
                  <div className="flex gap-4 mb-4">
                    <div className="text-center flex-1 py-2 rounded-lg bg-gray-50">
                      <p className="text-xs text-text-muted">Toplam (6 ay)</p>
                      <p className="font-semibold text-text-primary text-sm">
                        {formatCurrencyFull(
                          categoryTrendData.reduce((s, d) => s + d.total, 0),
                        )}
                      </p>
                    </div>
                    <div className="text-center flex-1 py-2 rounded-lg bg-gray-50">
                      <p className="text-xs text-text-muted">Ortalama</p>
                      <p className="font-semibold text-text-primary text-sm">
                        {formatCurrencyFull(categoryTrendAvg)}
                      </p>
                    </div>
                  </div>

                  {/* Area/line chart */}
                  <svg viewBox="0 0 360 160" className="w-full">
                    {/* Grid */}
                    {[0, 0.5, 1].map((ratio) => {
                      const y = 130 - ratio * 110;
                      return (
                        <line
                          key={ratio}
                          x1="30"
                          y1={y}
                          x2="340"
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                        />
                      );
                    })}

                    {/* Area fill */}
                    {categoryTrendData.length > 0 && (
                      <path
                        d={`
                          M ${30 + 0 * 62} ${130 - (categoryTrendData[0].total / categoryTrendMax) * 110}
                          ${categoryTrendData
                            .map(
                              (d, i) =>
                                `L ${30 + i * 62} ${130 - (d.total / categoryTrendMax) * 110}`,
                            )
                            .join(" ")}
                          L ${30 + (categoryTrendData.length - 1) * 62} 130
                          L 30 130 Z
                        `}
                        fill="url(#trendGradient)"
                        opacity="0.3"
                      />
                    )}

                    {/* Gradient definition */}
                    <defs>
                      <linearGradient
                        id="trendGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3b82f6"
                          stopOpacity="0.4"
                        />
                        <stop
                          offset="100%"
                          stopColor="#3b82f6"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>

                    {/* Line */}
                    {categoryTrendData.length > 1 && (
                      <polyline
                        points={categoryTrendData
                          .map(
                            (d, i) =>
                              `${30 + i * 62},${130 - (d.total / categoryTrendMax) * 110}`,
                          )
                          .join(" ")}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Dots + labels */}
                    {categoryTrendData.map((d, i) => {
                      const cx = 30 + i * 62;
                      const cy = 130 - (d.total / categoryTrendMax) * 110;
                      return (
                        <g key={i}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r="4"
                            fill="white"
                            stroke="#3b82f6"
                            strokeWidth="2"
                          />
                          <text
                            x={cx}
                            y="148"
                            textAnchor="middle"
                            fontSize="10"
                            className="fill-text-secondary"
                          >
                            {d.label}
                          </text>
                          {d.total > 0 && (
                            <text
                              x={cx}
                              y={cy - 10}
                              textAnchor="middle"
                              fontSize="8"
                              className="fill-primary-700"
                              fontWeight="600"
                            >
                              {formatCurrency(d.total)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center py-8 text-text-muted">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Trend görmek için bir kategori seçin.
                  </p>
                </div>
              )}
            </Card>

            {/* Month Comparison */}
            <Card>
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Ay Karşılaştırması
              </h3>
              <div className="mb-4">
                <Select
                  label="Karşılaştırılacak Ay"
                  id="compareMonth"
                  value={compareMonth}
                  onChange={(e) => setCompareMonth(Number(e.target.value))}
                  options={compareMonthOptions}
                />
              </div>

              {/* Comparison Cards */}
              <div className="space-y-3 mb-5">
                {/* Income */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-success-50/50 border border-success-500/10">
                  <div>
                    <p className="text-xs text-text-muted">Gelir</p>
                    <p className="font-semibold text-success-700">
                      {formatCurrencyFull(comparison.current.income)}
                    </p>
                  </div>
                  <div className="text-right">
                    <ChangeIndicator value={comparison.incomeChange} />
                    <p className="text-xs text-text-muted mt-0.5">
                      vs {comparison.prevMonthName}:{" "}
                      {formatCurrency(comparison.previous.income)}
                    </p>
                  </div>
                </div>

                {/* Expense */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-danger-50/50 border border-danger-500/10">
                  <div>
                    <p className="text-xs text-text-muted">Gider</p>
                    <p className="font-semibold text-danger-700">
                      {formatCurrencyFull(comparison.current.expense)}
                    </p>
                  </div>
                  <div className="text-right">
                    <ChangeIndicator value={comparison.expenseChange} inverse />
                    <p className="text-xs text-text-muted mt-0.5">
                      vs {comparison.prevMonthName}:{" "}
                      {formatCurrency(comparison.previous.expense)}
                    </p>
                  </div>
                </div>

                {/* Net */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    comparison.current.income - comparison.current.expense >= 0
                      ? "bg-primary-50/50 border-primary-200"
                      : "bg-warning-50/50 border-warning-200"
                  }`}
                >
                  <div>
                    <p className="text-xs text-text-muted">Net</p>
                    <p
                      className={`font-semibold ${
                        comparison.current.income -
                          comparison.current.expense >=
                        0
                          ? "text-primary-700"
                          : "text-danger-700"
                      }`}
                    >
                      {formatCurrencyFull(
                        comparison.current.income - comparison.current.expense,
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <ChangeIndicator value={comparison.netChange} />
                    <p className="text-xs text-text-muted mt-0.5">
                      vs {comparison.prevMonthName}:{" "}
                      {formatCurrency(
                        comparison.previous.income -
                          comparison.previous.expense,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Category comparison table */}
              {comparison.categoryComparison.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2">
                    Kategori Bazında Fark
                  </h4>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {comparison.categoryComparison.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50/80 text-sm"
                      >
                        <span className="flex items-center gap-2 text-text-primary">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              cat.type === "income"
                                ? "bg-success-500"
                                : "bg-danger-500"
                            }`}
                          />
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-text-secondary text-xs">
                            {formatCurrency(cat.current)}
                          </span>
                          <ChangeIndicator
                            value={cat.change}
                            inverse={cat.type === "expense"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
