// Real Inventory: the shop's actual fabric/supplies stock, managed inside StitchBook (it used to be a page in
// the portfolio /admin). Everyone can see it; only the signed-in owner gets the add/adjust/delete controls,
// and the server enforces the same rule (see stitchbook/route.ts's /manage/inventory routes).

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GlassCard } from "@/components/GlassCard";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  cost_naira: number | null;
  supplier: string | null;
  notes: string | null;
  updated_at: string;
}

const CATEGORIES = ["Fabric", "Thread", "Button/Zip", "Lining", "Embroidery Supplies", "Other"];
const UNITS = ["yards", "meters", "rolls", "pieces", "sets", "spools"];

async function authedFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}`, ...(init?.headers || {}) },
  });
}

export default function RealInventory({ isOwner }: { isOwner: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ item_name: "", category: "Fabric", quantity: "", unit: "yards", reorder_level: "5", supplier: "" });

  const load = async () => {
    setLoading(true);
    const res = await authedFetch("/api/stitchbook/manage/inventory");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addItem = async () => {
    if (!newItem.item_name.trim()) return;
    const res = await authedFetch("/api/stitchbook/manage/inventory", {
      method: "POST",
      body: JSON.stringify({
        itemName: newItem.item_name,
        category: newItem.category,
        quantity: Number(newItem.quantity) || 0,
        unit: newItem.unit,
        reorderLevel: Number(newItem.reorder_level) || 0,
        supplier: newItem.supplier || null,
      }),
    });
    if (res.ok) {
      setNewItem({ item_name: "", category: "Fabric", quantity: "", unit: "yards", reorder_level: "5", supplier: "" });
      load();
    }
  };

  const adjustStock = async (id: string, delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const quantity = Math.max(0, item.quantity + delta);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
    await authedFetch(`/api/stitchbook/manage/inventory/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await authedFetch(`/api/stitchbook/manage/inventory/${id}`, { method: "DELETE" });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[#00F0FF]" /></div>;
  }

  const lowStock = items.filter((i) => i.quantity <= i.reorder_level);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold text-white">Real Inventory</h2>
      <p className="text-sm text-gray-400">
        {isOwner
          ? "Your actual fabric and supplies stock. Changes here show up in the Live tab straight away."
          : "The shop's actual fabric and supplies stock. Only the shop owner can change these numbers."}
      </p>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Running low: {lowStock.map((i) => i.item_name).join(", ")}.</span>
        </div>
      )}

      {isOwner && (
      <GlassCard className="p-5 border-white/10">
        <div className="flex flex-wrap gap-2">
          <input
            value={newItem.item_name}
            onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
            placeholder="Item name"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-48 text-white"
          />
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-[#0b0a08]">{c}</option>
            ))}
          </select>
          <input
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            placeholder="Quantity"
            type="number"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-28 text-white"
          />
          <select
            value={newItem.unit}
            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          >
            {UNITS.map((u) => (
              <option key={u} value={u} className="bg-[#0b0a08]">{u}</option>
            ))}
          </select>
          <input
            value={newItem.reorder_level}
            onChange={(e) => setNewItem({ ...newItem, reorder_level: e.target.value })}
            placeholder="Reorder level"
            type="number"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-32 text-white"
          />
          <input
            value={newItem.supplier}
            onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
            placeholder="Supplier (optional)"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-44 text-white"
          />
          <button onClick={addItem} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-medium interactive">
            <Plus size={14} /> Add item
          </button>
        </div>
      </GlassCard>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-left text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{i.item_name}</td>
                <td className="px-4 py-3 text-gray-400">{i.category}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isOwner && (
                      <button onClick={() => adjustStock(i.id, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white interactive">
                        &minus;
                      </button>
                    )}
                    <span className={i.quantity <= i.reorder_level ? "text-amber-300 font-medium" : "text-white"}>
                      {i.quantity} {i.unit}
                    </span>
                    {isOwner && (
                      <button onClick={() => adjustStock(i.id, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white interactive">
                        +
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{i.supplier || "—"}</td>
                <td className="px-4 py-3">
                  {isOwner && (
                    <button onClick={() => deleteItem(i.id)} className="text-gray-500 hover:text-red-400 interactive">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {isOwner ? "No real stock tracked yet -- add an item above." : "No real stock tracked yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
