"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types";

/** Realtime count of conversations currently waiting for human attention. */
export function useAiHandoffCount(): number {
  const [total, setTotal] = useState(0);
  const statesRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, ai_autoreply_disabled");
      if (cancelled || error || !data) return;

      const map = new Map<string, boolean>();
      for (const row of data as {
        id: string;
        ai_autoreply_disabled: boolean | null;
      }[]) {
        map.set(row.id, row.ai_autoreply_disabled === true);
      }
      statesRef.current = map;
      setTotal(Array.from(map.values()).filter(Boolean).length);
    })();

    const channel = supabase
      .channel("ai-handoff-count-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          const map = statesRef.current;
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Conversation>;
            if (oldRow.id) map.delete(oldRow.id);
          } else {
            const row = payload.new as Conversation;
            map.set(row.id, row.ai_autoreply_disabled === true);
          }
          setTotal(Array.from(map.values()).filter(Boolean).length);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return total;
}
