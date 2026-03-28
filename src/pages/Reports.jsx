import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import DatePicker from "../components/ui/DatePicker";
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

// Chart Colors
const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#84cc16", // lime-500
];

const formatPercent = (value) => {
  if (!isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

const getNextDayStr = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Reports() {
  // Görev 1: Kapıdaki kişiyi öğren
  const { user } = useAuth();
  const now = new Date();

  // Date Range state
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const getLastDayOfMonth = () => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  };

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getLastDayOfMonth());
  const [activeQuickSelect, setActiveQuickSelect] = useState("thisMonth");
  const [yearlyData, setYearlyData] = useState([]);
  const [previousPeriodData, setPreviousPeriodData] = useState({ income: 0, expense: 0, net: 0 });
  const [barChartData, setBarChartData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Custom states for date picker control
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Quick Select Logic
  const handleQuickSelect = (range) => {
    setActiveQuickSelect(range);
    const d = new Date();
    let startStr = "";
    let endStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // Today by default for end

    switch (range) {
      case "thisMonth":
        startStr = getFirstDayOfMonth();
        endStr = getLastDayOfMonth();
        break;
      case "last3Months": {
        const past = new Date();
        past.setMonth(past.getMonth() - 3);
        startStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
        break;
      }
      case "last6Months": {
        const past = new Date();
        past.setMonth(past.getMonth() - 6);
        startStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
        break;
      }
      case "thisYear":
        startStr = `${d.getFullYear()}-01-01`;
        endStr = `${d.getFullYear()}-12-31`; // End of this year
        break;
      default:
        break;
    }

    if (startStr) setStartDate(startStr);
    if (endStr) setEndDate(endStr);
  };

  // Manual Date Change resets quick select
  const handleManualDateChange = (type, val) => {
    setActiveQuickSelect("");
    if (type === "start") {
      setStartDate(val);
      
      const nextDay = getNextDayStr(val);
      if (endDate && new Date(endDate) < new Date(nextDay)) {
        setEndDate(nextDay);
      }
      
      // Görev 1: Başlangıç tarihi seçildiğinde Bitiş tarihi takvimini otomatik aç
      setEndDateOpen(true);
      setTimeout(() => {
        document.getElementById("end-date-picker")?.focus();
      }, 50);
    }
    if (type === "end") {
      setEndDate(val);
      setEndDateOpen(false);
    }
  };

  // Category trend
  const [selectedCategory, setSelectedCategory] = useState("");

  // Compare month
  const [compareMonth, setCompareMonth] = useState(now.getMonth());

  // Details view for Expense Chart
  const [selectedParentCategory, setSelectedParentCategory] = useState(null);

  // Tooltip
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchYearlyData();
  }, [startDate, endDate]);

  // BarChart için yıl bazlı veri çek (global tarih filtresinden bağımsız)
  const selectedYear = startDate ? parseInt(startDate.split("-")[0], 10) : new Date().getFullYear();

  useEffect(() => {
    fetchBarChartData();
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
    if (!startDate || !endDate) return;
    setLoading(true);

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const diffTime = Math.abs(eDate - sDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const prevEndDateObj = new Date(sDate);
    prevEndDateObj.setDate(prevEndDateObj.getDate() - 1);
    const prevStartDateObj = new Date(prevEndDateObj);
    prevStartDateObj.setDate(prevStartDateObj.getDate() - diffDays + 1);

    const prevStartStr = `${prevStartDateObj.getFullYear()}-${String(prevStartDateObj.getMonth() + 1).padStart(2, "0")}-${String(prevStartDateObj.getDate()).padStart(2, "0")}`;
    const prevEndStr = `${prevEndDateObj.getFullYear()}-${String(prevEndDateObj.getMonth() + 1).padStart(2, "0")}-${String(prevEndDateObj.getDate()).padStart(2, "0")}`;

    const [currentRes, previousRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, categories(name, parent_id)")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true }),
      supabase
        .from("transactions")
        .select("amount, type, is_transfer")
        .eq("user_id", user.id)
        .gte("date", prevStartStr)
        .lte("date", prevEndStr)
    ]);

    if (currentRes.error) {
      console.error(currentRes.error);
      setYearlyData([]);
    } else {
      setYearlyData(currentRes.data || []);
    }

    if (previousRes.error) {
      console.error(previousRes.error);
      setPreviousPeriodData({ income: 0, expense: 0, net: 0 });
    } else {
      let pInc = 0;
      let pExp = 0;
      previousRes.data?.forEach(tx => {
        const amt = Number(tx.amount);
        if (tx.type === "income") pInc += amt;
        else if (!tx.is_transfer) pExp += amt;
      });
      setPreviousPeriodData({ income: pInc, expense: pExp, net: pInc - pExp });
    }

    setLoading(false);
  };

  const fetchBarChartData = async () => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(name, parent_id)")
      .eq("user_id", user.id)
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .order("date", { ascending: true });

    if (error) {
      console.error(error);
      setBarChartData([]);
    } else {
      setBarChartData(data || []);
    }
  };

  // ─── Monthly breakdown (global filtreli veri — karşılaştırma bölümü için) ───
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

  // ─── BarChart 12 aylık breakdown (yıl bazlı, global filtreden bağımsız) ───
  const barChartMonthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      income: 0,
      expense: 0,
    }));

    barChartData.forEach((tx) => {
      const m = new Date(tx.date).getMonth();
      const amount = Number(tx.amount);
      if (tx.type === "income") months[m].income += amount;
      else if (!tx.is_transfer) months[m].expense += amount;
    });

    return months;
  }, [barChartData]);

  // ─── Expense Structure (Parent Category Aggregation) ───
  const expenseChartData = useMemo(() => {
    const parentMap = {};
    let totalExpenses = 0;

    yearlyData
      .filter((tx) => tx.type === "expense" && !tx.is_transfer)
      .forEach((tx) => {
        const amount = Number(tx.amount);
        const cat = tx.categories;

        // Find parent category ID and Name
        let parentId;
        let parentName;

        if (cat?.parent_id) {
          parentId = cat.parent_id;
          const parent = categories.find((c) => c.id === parentId);
          parentName = parent?.name || "Bilinmeyen Kategori";
        } else {
          parentId = tx.category_id || "uncategorized";
          parentName = cat?.name || "Kategorisiz";
        }

        if (!parentMap[parentId]) {
          parentMap[parentId] = {
            id: parentId,
            name: parentName,
            value: 0,
          };
        }

        parentMap[parentId].value += amount;
        totalExpenses += amount;
      });

    // Convert map to array and calculate percentage
    const data = Object.values(parentMap)
      .filter((item) => item.value > 0)
      .map((item) => ({
        ...item,
        percentage: totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return data;
  }, [yearlyData, categories]);

  // Handle slice click to show details
  const handlePieClick = (data) => {
    setSelectedParentCategory(data.id);
  };

  // Detailed transactions for selected parent category
  const selectedParentTransactions = useMemo(() => {
    if (!selectedParentCategory) return [];

    return yearlyData
      .filter((tx) => {
        if (tx.type !== "expense" || tx.is_transfer) return false;
        const cat = tx.categories;
        return (
          tx.category_id === selectedParentCategory ||
          cat?.parent_id === selectedParentCategory
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selectedParentCategory, yearlyData]);

  // ─── Period Totals ───
  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    yearlyData.forEach(tx => {
      const amount = Number(tx.amount);
      if (tx.type === "income") income += amount;
      else if (!tx.is_transfer) expense += amount;
    });
    const net = income - expense;
    
    const calcChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    return {
      income,
      expense,
      net,
      incomeChange: calcChange(income, previousPeriodData.income),
      expenseChange: calcChange(expense, previousPeriodData.expense),
      netChange: calcChange(net, previousPeriodData.net)
    };
  }, [yearlyData, previousPeriodData]);

  // ─── Dynamic Bar chart calculations ───
  const periodChartData = useMemo(() => {
    if (!startDate || !endDate) return { maxValue: 1, items: [] };
    
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;

    const isDaily = diffDays <= 45; 
    
    const items = [];
    
    if (isDaily) {
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(sDate);
        d.setDate(d.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        items.push({
          key,
          label: `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`,
          income: 0,
          expense: 0
        });
      }
    } else {
      let currentMonthDate = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
      const endMonthDate = new Date(eDate.getFullYear(), eDate.getMonth(), 1);
      
      while (currentMonthDate <= endMonthDate) {
        const key = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, "0")}`;
        items.push({
          key,
          label: `${MONTH_SHORT[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear() === now.getFullYear() ? '' : currentMonthDate.getFullYear()}`.trim(),
          income: 0,
          expense: 0
        });
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
      }
    }
    
    yearlyData.forEach(tx => {
      const txDate = new Date(tx.date);
      let key;
      if (isDaily) {
        // Find by exact day key depending on how the date string is formatted in yearlyData
        key = tx.date; 
      } else {
        key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      }
      
      const target = items.find(i => i.key === key);
      if (target) {
        const amount = Number(tx.amount);
        if (tx.type === "income") target.income += amount;
        else if (!tx.is_transfer) target.expense += amount;
      }
    });
    
    const maxValue = Math.max(...items.map(i => Math.max(i.income, i.expense)), 1);

    return { maxValue, items, isDaily };
  }, [yearlyData, startDate, endDate, now]);

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

      <div className="space-y-4">
        {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {[
                { id: "thisMonth", label: "Bu Ay" },
                { id: "last3Months", label: "Son 3 Ay" },
                { id: "last6Months", label: "Son 6 Ay" },
                { id: "thisYear", label: "Bu Yıl" },
              ].map((fast) => (
                <button
                  key={fast.id}
                  onClick={() => handleQuickSelect(fast.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                    activeQuickSelect === fast.id
                      ? "bg-primary-50 text-primary-700 border-primary-200"
                      : "bg-white text-text-secondary border-border hover:bg-gray-50"
                  }`}
                >
                  {fast.label}
                </button>
              ))}
            </div>

            {/* Date Range Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {(() => {
                  const s = new Date(startDate);
                  const e = new Date(endDate);
                  const sStr = `${s.getDate()} ${MONTH_SHORT[s.getMonth()]}`;
                  const eStr = `${e.getDate()} ${MONTH_SHORT[e.getMonth()]}`;
                  return `Seçili Dönem Özeti (${sStr} - ${eStr})`;
                })()}
              </h2>
              <div className="flex items-center gap-3">
                <DatePicker
                  value={startDate}
                  onChange={(val) => handleManualDateChange("start", val)}
                  className="w-[140px] sm:w-[160px] py-2 text-sm"
                />
                <span className="text-text-muted">-</span>
                <DatePicker
                  id="end-date-picker"
                  value={endDate}
                  onChange={(val) => handleManualDateChange("end", val)}
                  className="w-[140px] sm:w-[160px] py-2 text-sm"
                  isOpen={endDateOpen}
                  onOpenChange={setEndDateOpen}
                  minDate={getNextDayStr(startDate)}
                  align="right"
                />
              </div>
            </div>
          </div>

          {/* Opacity/Loading overlay */}
          <div className={`transition-opacity duration-300 relative ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
              </div>
            )}
            
            <div className="space-y-4">
              {/* Yearly Summary Cards */}
              <div className="grid sm:grid-cols-3 gap-4">
              <Card className="relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-success-600" />
                    </div>
                    <span className="text-sm text-text-secondary">
                      Toplam Gelir
                    </span>
                  </div>
                  <ChangeIndicator value={periodTotals.incomeChange} />
                </div>
                <p className="text-xl font-bold text-success-700">
                  {formatCurrencyFull(periodTotals.income)}
                </p>
              </Card>
              <Card className="relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-danger-50 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-danger-600" />
                    </div>
                    <span className="text-sm text-text-secondary">
                      Toplam Gider
                    </span>
                  </div>
                  <ChangeIndicator value={periodTotals.expenseChange} inverse />
                </div>
                <p className="text-xl font-bold text-danger-700">
                  {formatCurrencyFull(periodTotals.expense)}
                </p>
              </Card>
              <Card
                className={`relative overflow-hidden ring-1 ${
                  periodTotals.net >= 0 ? "ring-success-200" : "ring-danger-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        periodTotals.net >= 0 ? "bg-primary-50" : "bg-warning-50"
                      }`}
                    >
                      <Wallet
                        className={`w-4 h-4 ${
                          periodTotals.net >= 0
                            ? "text-primary-600"
                            : "text-warning-600"
                        }`}
                      />
                    </div>
                    <span className="text-sm text-text-secondary">Net Durum</span>
                  </div>
                  <ChangeIndicator value={periodTotals.netChange} />
                </div>
                <p
                  className={`text-xl font-bold ${
                    periodTotals.net >= 0
                      ? "text-primary-700"
                      : "text-danger-700"
                  }`}
                >
                  {formatCurrencyFull(periodTotals.net)}
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
                          {formatCurrency(periodChartData.maxValue * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars */}
                  {periodChartData.items.map((m, i) => {
                    const availableWidth = 640; 
                    const groupWidth = Math.max(availableWidth / Math.max(periodChartData.items.length, 1), 10);
                    const groupX = 60 + i * groupWidth;
                    
                    const maxBarWidth = 24; 
                    const calculatedBarWidth = groupWidth * 0.35;
                    const barWidth = Math.max(Math.min(calculatedBarWidth, maxBarWidth), 2);
                    
                    const centerOffset = groupWidth / 2;
                    const incomeX = groupX + centerOffset - barWidth - 1;
                    const expenseX = groupX + centerOffset + 1;

                    const incomeH = (m.income / periodChartData.maxValue) * 220;
                    const expenseH = (m.expense / periodChartData.maxValue) * 220;

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
                            x={groupX}
                            y="60"
                            width={groupWidth}
                            height="240"
                            fill="#f8fafc"
                            rx="4"
                          />
                        )}
                        {/* Income bar */}
                        <rect
                          x={incomeX}
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
                          x={expenseX}
                          y={290 - expenseH}
                          width={barWidth}
                          height={Math.max(expenseH, 0)}
                          fill="#ef4444"
                          rx="3"
                          className="transition-all duration-300"
                          opacity={hoveredBar === i ? 1 : 0.85}
                        />
                        {/* Label */}
                        <text
                          x={groupX + centerOffset}
                          y="310"
                          textAnchor="middle"
                          className="fill-text-secondary"
                          fontSize={periodChartData.items.length > 20 ? "8" : "10"}
                          fontWeight={hoveredBar === i ? "600" : "400"}
                        >
                          {m.label}
                        </text>

                        {/* Tooltip */}
                        {hoveredBar === i && (
                          <g>
                            <rect
                              x={groupX + centerOffset - 65}
                              y="4"
                              width="130"
                              height="48"
                              fill="white"
                              stroke="#e2e8f0"
                              rx="8"
                              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.1))"
                            />
                            <text
                              x={groupX + centerOffset - 56}
                              y="24"
                              fontSize="11"
                              className="fill-success-700"
                              fontWeight="600"
                            >
                              Gelir: {formatCurrency(m.income)}
                            </text>
                            <text
                              x={groupX + centerOffset - 56}
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
              SECTION 2: EXPENSE DISTRIBUTION (DONUT CHART)
          ═══════════════════════════════════════════ */}
          <div className="grid lg:grid-cols-2 gap-6 pb-2">
            <Card>
              <div className="flex flex-col mb-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Ana Kategori Gider Dağılımı (Seçili Dönem)
                </h3>
                <p className="text-sm text-text-secondary">
                  Detayları görmek için bir dilime tıklayın.
                </p>
              </div>

              {expenseChartData.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Seçili döneme ait gider verisi bulunamadı.
                  </p>
                </div>
              ) : (
                <>
                  <div className="h-[450px] w-full mt-4 cursor-pointer select-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseChartData}
                          cx="50%"
                          cy="45%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          onClick={handlePieClick}
                          stroke="none"
                          style={{ outline: "none", cursor: "pointer" }}
                        >
                          {expenseChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${entry.id}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                              className="hover:opacity-80 transition-opacity"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => {
                            const percent = props.payload.percentage.toFixed(1);
                            return [
                              `${formatCurrency(value)} (%${percent})`,
                              name,
                            ];
                          }}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow:
                              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          wrapperStyle={{ paddingTop: "20px" }}
                          iconType="circle"
                          formatter={(value, entry) => (
                            <span className="text-sm font-medium text-text-secondary whitespace-nowrap">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </Card>

            {/* Selected Category Details Table */}
            <Card className="flex flex-col h-full overflow-hidden">
              {selectedParentCategory ? (
                <>
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              CHART_COLORS[
                                expenseChartData.findIndex(
                                  (d) => d.id === selectedParentCategory,
                                ) % CHART_COLORS.length
                              ] || "#ccc",
                          }}
                        />
                        {
                          expenseChartData.find(
                            (d) => d.id === selectedParentCategory,
                          )?.name
                        }{" "}
                        Detayları
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        Bu kategori ve alt kategorilerindeki tüm harcamalar.
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedParentCategory(null)}
                      className="p-1.5 text-text-muted hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Kapat
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-[200px] max-h-[450px]">
                    {selectedParentTransactions.length === 0 ? (
                      <p className="text-sm text-text-muted text-center py-6">
                        İşlem bulunamadı.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {selectedParentTransactions.map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text-primary truncate">
                                {tx.categories?.name || "Kategorisiz"}
                              </p>
                              <p className="text-xs text-text-muted truncate">
                                {new Date(tx.date).toLocaleDateString("tr-TR")}{" "}
                                {tx.description && `• ${tx.description}`}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-danger-700 shrink-0">
                              {formatCurrency(tx.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-text-muted">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
                    <PieChart className="w-8 h-8 opacity-30" />
                  </div>
                  <h4 className="text-sm font-semibold mb-2 text-text-primary">
                    Detay Görünümü
                  </h4>
                  <p className="text-sm max-w-[200px]">
                    Sağdaki grafikten bir kategoriye tıklayarak altındaki tüm
                    harcama detaylarını inceleyebilirsiniz.
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* ═══════════════════════════════════════════
              SECTION 3 & 4: CATEGORY TREND + COMPARISON
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
        </div>
    </div>
  );
}
