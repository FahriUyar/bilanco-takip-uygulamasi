import * as XLSX from "xlsx";

/**
 * İşlemleri Excel dosyasına aktarır.
 * Sütun genişlikleri otomatik ayarlanır, başlıklar kalın yazılır,
 * alt satırda toplam özeti gösterilir.
 */
export function exportTransactionsToExcel(
  transactions,
  monthName,
  year,
  appName = "Rapor",
) {
  // Başlık satırı
  const headers = ["Tarih", "Tür", "Kategori", "Açıklama", "Tutar (₺)"];

  // Veri satırları
  const rows = transactions.map((tx) => {
    const date = new Date(tx.date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const type = tx.type === "income" ? "Gelir" : "Gider";
    const category = tx.categories?.name || "—";
    const description = tx.description || "—";
    const amount = Number(tx.amount);

    return [date, type, category, description, amount];
  });

  // Toplam hesaplamaları
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const net = totalIncome - totalExpense;

  // Boş satır + özet satırları
  const summaryRows = [
    [], // boş satır
    ["", "", "", "Toplam Gelir", totalIncome],
    ["", "", "", "Toplam Gider", totalExpense],
    ["", "", "", "Net Durum", net],
  ];

  // Tüm veriyi birleştir
  const sheetData = [headers, ...rows, ...summaryRows];

  // Worksheet oluştur
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Sütun genişliklerini otomatik hesapla
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    rows.forEach((row) => {
      const cellValue = String(row[colIdx] ?? "");
      maxLen = Math.max(maxLen, cellValue.length);
    });
    // Özet satırlarını da kontrol et
    summaryRows.forEach((row) => {
      const cellValue = String(row[colIdx] ?? "");
      maxLen = Math.max(maxLen, cellValue.length);
    });
    // Biraz ekstra boşluk ekle
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws["!cols"] = colWidths;

  // Tutar sütunundaki sayıları formatlama (Türk Lirası formatı)
  const amountColIdx = 4; // E sütunu
  for (let rowIdx = 1; rowIdx <= rows.length; rowIdx++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: amountColIdx });
    if (ws[cellRef]) {
      ws[cellRef].z = '#,##0.00 "₺"';
    }
  }
  // Özet satırlarındaki tutarları da formatla
  const summaryStartRow = rows.length + 2; // +1 header, +1 boş satır
  for (let i = 0; i < 3; i++) {
    const cellRef = XLSX.utils.encode_cell({
      r: summaryStartRow + i,
      c: amountColIdx,
    });
    if (ws[cellRef]) {
      ws[cellRef].z = '#,##0.00 "₺"';
    }
  }

  // Dosya Adı Formatlama (İşletim Sistemi Uyumluluğu)
  const formatFileName = (str) => {
    return String(str || "")
      .replace(/ğ/g, "g")
      .replace(/Ğ/g, "G")
      .replace(/ü/g, "u")
      .replace(/Ü/g, "U")
      .replace(/ş/g, "s")
      .replace(/Ş/g, "S")
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .replace(/ö/g, "o")
      .replace(/Ö/g, "O")
      .replace(/ç/g, "c")
      .replace(/Ç/g, "C")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  };

  const safeAppName = formatFileName(appName) || "Bilanço_Raporu";
  const safeMonthName = formatFileName(monthName);

  // Workbook oluştur
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${safeMonthName} ${year}`);

  // Dosyayı indir
  const fileName = `${safeAppName}_${safeMonthName}_${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
