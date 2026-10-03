import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GlassCard } from "@/components/GlassCard";
import { Loader2 } from "lucide-react";

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  garment_type: string;
  fabric: string | null;
  fabric_surcharge_kobo: number | null;
  embroidery_notes: string | null;
  occasion: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  measurements: Record<string, number>;
  measurement_method: "camera_ai" | "manual";
  amount_kobo: number;
  payment_status: "pending" | "paid" | "failed";
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUSES = ["New", "Confirmed", "In Progress", "Ready", "Delivered", "Cancelled"];

async function authedFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}`, ...(init?.headers || {}) },
  });
}

export default function AdminAtelierFit() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await authedFetch("/api/atelierfit/admin/orders");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await authedFetch(`/api/atelierfit/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await load();
    setUpdating(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[#00F0FF]" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-semibold text-white">AtelierFit Orders</h1>
      {orders.length === 0 && <p className="text-gray-400 font-mono text-sm">No orders yet -- share the project's QR code to get the first one.</p>}
      <div className="grid grid-cols-1 gap-4">
        {orders.map((o) => (
          <GlassCard key={o.id} className="p-5 border-white/10">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <div className="font-semibold text-white">
                  {o.customer_name} -- {o.garment_type}
                  {o.fabric ? <span className="text-gray-400 font-normal"> in {o.fabric}</span> : null}
                </div>
                <div className="text-xs text-gray-400 font-mono">{o.customer_email} {o.customer_phone ? `· ${o.customer_phone}` : ""}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(o.created_at).toLocaleString()}</div>
                {o.appointment_date && (
                  <div className="text-xs text-[#D4AF37] mt-1">
                    Fitting booked: {new Date(o.appointment_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    {o.appointment_time ? ` · ${o.appointment_time}` : ""}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-[#D4AF37]">₦{(o.amount_kobo / 100).toLocaleString("en-NG")} deposit</div>
                {!!o.fabric_surcharge_kobo && (
                  <div className="text-[10px] text-gray-500 font-mono">(incl. ₦{(o.fabric_surcharge_kobo / 100).toLocaleString("en-NG")} fabric surcharge)</div>
                )}
                <div className={`text-xs font-mono mt-1 ${o.payment_status === "paid" ? "text-green-400" : "text-yellow-400"}`}>
                  {o.payment_status.toUpperCase()}
                </div>
                {o.occasion && <div className="text-[10px] text-gray-500 font-mono mt-1">For: {o.occasion}</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono uppercase text-gray-300">
              {Object.entries(o.measurements || {}).map(([k, v]) => (
                <span key={k} className="px-2 py-1 bg-white/5 border border-white/10 rounded">{k}: {v}cm</span>
              ))}
              <span className="px-2 py-1 bg-white/5 border border-white/10 rounded">{o.measurement_method === "camera_ai" ? "AI camera estimate" : "Manual entry"}</span>
            </div>
            {o.embroidery_notes && <p className="text-sm text-gray-400 mt-3 italic">Embroidery/detail request: "{o.embroidery_notes}"</p>}
            {o.notes && <p className="text-sm text-gray-400 mt-2 italic">"{o.notes}"</p>}
            <div className="mt-4 flex items-center gap-3">
              <label className="text-xs text-gray-400 font-mono">Status</label>
              <select
                value={o.status}
                disabled={updating === o.id}
                onChange={(e) => updateStatus(o.id, e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
