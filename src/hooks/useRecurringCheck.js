import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

/**
 * useRecurringCheck
 *
 * Neden useRef guard?
 * React StrictMode ve sayfa geçişlerinde useEffect birden fazla
 * kez tetiklenebilir. Ref ile "zaten çalışıyor" kontrolü yaparak
 * aynı anda birden fazla insert işleminin olmasını engelliyoruz.
 */
export function useRecurringCheck() {
  const { user } = useAuth();
  const [generatedCount, setGeneratedCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!user) return;
    // Guard: zaten çalışıyorsa tekrar başlatma
    if (running.current) return;
    running.current = true;

    checkAndGenerate().finally(() => {
      running.current = false;
    });
  }, [user]);

  const checkAndGenerate = async () => {
    try {
      // 1. Fetch active recurring transactions — sadece bu kullanıcıya ait
      const { data: recurring, error: recError } = await supabase
        .from("recurring_transactions")
        .select("*, categories(name)")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (recError || !recurring?.length) {
        setChecked(true);
        return;
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const today = now.getDate();
      let count = 0;

      for (const rec of recurring) {
        if (rec.frequency === "monthly") {
          // Check if already generated this month
          const lastGen = rec.last_generated
            ? new Date(rec.last_generated)
            : null;
          const alreadyGenerated =
            lastGen &&
            lastGen.getFullYear() === currentYear &&
            lastGen.getMonth() === currentMonth;

          if (alreadyGenerated) continue;

          // Only generate if we've passed the day_of_month
          const dayToGenerate = rec.day_of_month || 1;
          if (today < dayToGenerate) continue;

          // Generate the transaction — user_id zorunlu
          const genDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayToGenerate).padStart(2, "0")}`;

          // Önce last_generated'ı güncelle ki tekrar çalışırsa skip etsin
          const { error: updateError } = await supabase
            .from("recurring_transactions")
            .update({ last_generated: genDate })
            .eq("id", rec.id);

          if (updateError) continue;

          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              user_id: user.id,
              date: genDate,
              amount: rec.amount,
              type: rec.type,
              category_id: rec.category_id,
              description: rec.description
                ? `${rec.description} (otomatik)`
                : "Otomatik tekrarlayan işlem",
            });

          if (!insertError) {
            count++;
          }
        } else if (rec.frequency === "weekly") {
          // For weekly: check if generated this week
          const lastGen = rec.last_generated
            ? new Date(rec.last_generated)
            : null;
          const oneWeekAgo = new Date(now);
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          if (lastGen && lastGen > oneWeekAgo) continue;

          const genDate = now.toISOString().split("T")[0];

          // Önce last_generated'ı güncelle
          const { error: updateError } = await supabase
            .from("recurring_transactions")
            .update({ last_generated: genDate })
            .eq("id", rec.id);

          if (updateError) continue;

          const { error: insertError } = await supabase
            .from("transactions")
            .insert({
              user_id: user.id,
              date: genDate,
              amount: rec.amount,
              type: rec.type,
              category_id: rec.category_id,
              description: rec.description
                ? `${rec.description} (otomatik)`
                : "Otomatik haftalık işlem",
            });

          if (!insertError) {
            count++;
          }
        }
      }

      setGeneratedCount(count);
      setChecked(true);
    } catch (err) {
      console.error("Recurring check error:", err);
      setChecked(true);
    }
  };

  return { generatedCount, checked };
}
