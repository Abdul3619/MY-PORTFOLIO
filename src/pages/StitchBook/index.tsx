// StitchBook: the desktop-app project. A tailor-shop management tool -- order book + fabric/inventory
// tracker -- designed for a wide screen and a mouse/keyboard, not a thumb: dense tables, inline edits,
// keyboard-friendly forms. This is a live, public demo (no login) so a visitor can try adding an order or
// adjusting stock right away; see stitchbook/route.ts for why that's safe here.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Scissors, Package, Plus, Trash2, AlertTriangle, LayoutDashboard, Radio, ExternalLink, Lock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ADMIN_EMAIL } from "../../components/admin/AdminLayout";
import AdminAtelierFit from "../admin/AdminAtelierFit";

type OrderStatus = "New" | "Cutting" | "Sewing" | "Fitting" | "Ready" | "Delivered" | "Cancelled";

interface Order {
  id: string;
  client_name: string;
  client_phone: string | null;
  garment: string;
  fabric_source: "client_provided" | "shop_stock" | null;
  price_naira: number;
  deposit_naira: number;
  due_date: string | null;
  status: OrderStatus;
  notes: string | null;
}

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  notes: string | null;
}

const STATUSES: OrderStatus[] = ["New", "Cutting", "Sewing", "Fitting", "Ready", "Delivered", "Cancelled"];
const STATUS_COLORS: Record<OrderStatus, string> = {
  New: "bg-white/10 text-gray-300",
  Cutting: "bg-blue-500/15 text-blue-300",
  Sewing: "bg-amber-500/15 text-amber-300",
  Fitting: "bg-purple-500/15 text-purple-300",
  Ready: "bg-emerald-500/15 text-emerald-300",
  Delivered: "bg-gold/15 text-gold",
  Cancelled: "bg-red-500/15 text-red-300",
};

function naira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

type Tab = "dashboard" | "orders" | "inventory" | "live" | "manage";

interface LiveAtelierFitOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  garment_type: string;
  fabric: string | null;
  occasion: string | null;
  amount_kobo: number;
  payment_status: string;
  status: string;
  delivery_method: string;
  shipping_address: string | null;
  tracking_number: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  created_at: string;
}

interface LiveProduct {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  category: string;
  image_url: string | null;
}

interface LiveBooking {
  id: string;
  kind: string;
  full_name: string;
  email: string;
  phone: string | null;
  service: string | null;
  preferred_date: string | null;
  status: string;
  created_at: string;
}

interface LiveInventoryItem {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  supplier: string | null;
  updated_at: string;
}

interface LiveOverview {
  atelierfit: { totalOrders: number; activeOrders: number; paidRevenueKobo: number };
  atelierNoir: { publishedProducts: number; totalBookings: number };
  inventory: { totalItems: number; lowStockCount: number };
}

export default function StitchBook() {
  // Supports linking straight to a tab (e.g. /stitchbook?tab=manage from the admin sidebar) without
  // adding a real sub-route for what's otherwise client-side tab state.
  const initialTab = (): Tab => {
    if (typeof window === "undefined") return "dashboard";
    const t = new URLSearchParams(window.location.search).get("tab");
    return (t === "orders" || t === "inventory" || t === "live" || t === "manage") ? t : "dashboard";
  };
  const [tab, setTab] = useState<Tab>(initialTab);
  // Manage is the one real, write-capable tab -- it's the actual AtelierFit order-management screen
  // (formerly its own locked /admin/atelierfit page), now folded into StitchBook since this is meant to
  // be the one shared dashboard for the Atelier Noir / AtelierFit family. Writes still go through the
  // same requireAuth-gated /api/atelierfit/admin/* routes either way, so showing/hiding this tab is a
  // UX nicety, not the actual security boundary -- but there's no reason to render it, or send the
  // authed fetches it makes on mount, to a visitor who isn't signed in as the real admin.
  const { user: adminUser, loading: adminLoading } = useAuth();
  const isRealAdmin = !adminLoading && adminUser?.email?.toLowerCase() === ADMIN_EMAIL;
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newOrder, setNewOrder] = useState({ client_name: "", garment: "", price_naira: "", deposit_naira: "" });
  const [newItem, setNewItem] = useState({ item_name: "", quantity: "", unit: "yards" });

  // Live tab -- real data from AtelierFit + Atelier Noir + the real inventory tracker, loaded only once the
  // visitor actually opens that tab (no point fetching it if they never look). Read-only: this tab has no
  // add/edit/delete controls anywhere, unlike the three demo tabs above.
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveOverview, setLiveOverview] = useState<LiveOverview | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveAtelierFitOrder[]>([]);
  const [liveProducts, setLiveProducts] = useState<LiveProduct[]>([]);
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [liveInventory, setLiveInventory] = useState<LiveInventoryItem[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, invRes] = await Promise.all([fetch("/api/stitchbook/orders"), fetch("/api/stitchbook/inventory")]);
      if (!ordersRes.ok || !invRes.ok) throw new Error("Could not load StitchBook data.");
      setOrders(await ordersRes.json());
      setInventory(await invRes.json());
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab !== "live" || liveLoaded) return;
    (async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const [overviewRes, ordersRes, noirRes, invRes] = await Promise.all([
          fetch("/api/stitchbook/live/overview"),
          fetch("/api/stitchbook/live/atelierfit-orders"),
          fetch("/api/stitchbook/live/atelier-noir"),
          fetch("/api/stitchbook/live/inventory"),
        ]);
        if (!overviewRes.ok || !ordersRes.ok || !noirRes.ok || !invRes.ok) throw new Error("Could not load live data.");
        setLiveOverview(await overviewRes.json());
        setLiveOrders(await ordersRes.json());
        const noir = await noirRes.json();
        setLiveProducts(noir.products || []);
        setLiveBookings(noir.bookings || []);
        setLiveInventory(await invRes.json());
        setLiveLoaded(true);
      } catch (e: any) {
        setLiveError(e?.message || "Something went wrong loading live data.");
      } finally {
        setLiveLoading(false);
      }
    })();
  }, [tab, liveLoaded]);

  const stats = useMemo(() => {
    const active = orders.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled");
    const outstanding = active.reduce((sum, o) => sum + (o.price_naira - o.deposit_naira), 0);
    const lowStock = inventory.filter((i) => i.quantity <= i.reorder_level);
    return { activeCount: active.length, outstanding, lowStock };
  }, [orders, inventory]);

  async function addOrder() {
    if (!newOrder.client_name.trim() || !newOrder.garment.trim()) return;
    const res = await fetch("/api/stitchbook/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: newOrder.client_name,
        garment: newOrder.garment,
        priceNaira: Number(newOrder.price_naira) || 0,
        depositNaira: Number(newOrder.deposit_naira) || 0,
      }),
    });
    if (res.ok) {
      setNewOrder({ client_name: "", garment: "", price_naira: "", deposit_naira: "" });
      load();
    }
  }

  async function updateOrderStatus(id: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    await fetch(`/api/stitchbook/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteOrder(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/stitchbook/orders/${id}`, { method: "DELETE" });
  }

  async function addItem() {
    if (!newItem.item_name.trim()) return;
    const res = await fetch("/api/stitchbook/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: newItem.item_name, quantity: Number(newItem.quantity) || 0, unit: newItem.unit }),
    });
    if (res.ok) {
      setNewItem({ item_name: "", quantity: "", unit: "yards" });
      load();
    }
  }

  async function adjustStock(id: string, delta: number) {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    const quantity = Math.max(0, item.quantity + delta);
    setInventory((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
    await fetch(`/api/stitchbook/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
  }

  async function deleteItem(id: string) {
    setInventory((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/stitchbook/inventory/${id}`, { method: "DELETE" });
  }

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: Scissors },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "live", label: "Live", icon: Radio },
    { id: "manage", label: "Manage", icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-[#0b0a08] text-white flex">
      {/* Sidebar -- desktop-app chrome, always visible on wide screens */}
      <aside className="w-56 shrink-0 border-r border-white/10 bg-white/[0.02] p-4 hidden sm:flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <Scissors size={20} className="text-gold" />
          <span className="font-display font-semibold tracking-wide">StitchBook</span>
        </div>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors interactive ${
              tab === id ? "bg-gold text-black font-medium" : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
        <div className="mt-auto px-2 py-3 text-[11px] text-gray-500 leading-relaxed">
          Dashboard/Orders/Inventory: a live demo &mdash; edits are visible to every visitor and old rows are
          pruned automatically. Live is real, read-only data from AtelierFit &amp; Atelier Noir, intentionally
          left unlocked. Manage is the one real write screen, for the shop owner only.
        </div>
      </aside>

      {/* Mobile tab bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 flex border-t border-white/10 bg-[#0b0a08]">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] ${tab === id ? "text-gold" : "text-gray-500"}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 p-6 sm:p-10 pb-20 sm:pb-10 overflow-x-auto">
        {error && <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

        {tab === "dashboard" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h1 className="text-2xl font-display font-semibold mb-4">Shop overview</h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Active orders</p>
                <p className="text-3xl font-display font-semibold">{loading ? "—" : stats.activeCount}</p>
              </div>
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Balance outstanding</p>
                <p className="text-3xl font-display font-semibold text-gold">{loading ? "—" : naira(stats.outstanding)}</p>
              </div>
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Low stock
                </p>
                <p className="text-3xl font-display font-semibold">{loading ? "—" : stats.lowStock.length}</p>
              </div>
            </div>
            {stats.lowStock.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-200">
                Running low: {stats.lowStock.map((i) => i.item_name).join(", ")}.
              </div>
            )}
          </motion.div>
        )}

        {tab === "orders" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h1 className="text-2xl font-display font-semibold">Order book</h1>
            <div className="flex flex-wrap gap-2">
              <input
                value={newOrder.client_name}
                onChange={(e) => setNewOrder({ ...newOrder, client_name: e.target.value })}
                placeholder="Client name"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-40"
              />
              <input
                value={newOrder.garment}
                onChange={(e) => setNewOrder({ ...newOrder, garment: e.target.value })}
                placeholder="Garment"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-40"
              />
              <input
                value={newOrder.price_naira}
                onChange={(e) => setNewOrder({ ...newOrder, price_naira: e.target.value })}
                placeholder="Price (NGN)"
                type="number"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-32"
              />
              <input
                value={newOrder.deposit_naira}
                onChange={(e) => setNewOrder({ ...newOrder, deposit_naira: e.target.value })}
                placeholder="Deposit (NGN)"
                type="number"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-32"
              />
              <button onClick={addOrder} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium interactive">
                <Plus size={14} /> Add order
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-left text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Garment</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-white/5">
                      <td className="px-4 py-3">{o.client_name}</td>
                      <td className="px-4 py-3 text-gray-400">{o.garment}</td>
                      <td className="px-4 py-3">{naira(o.price_naira)}</td>
                      <td className="px-4 py-3">{naira(o.price_naira - o.deposit_naira)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                          className={`px-2 py-1 rounded-md text-xs border border-white/10 bg-transparent ${STATUS_COLORS[o.status]}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-[#0b0a08] text-white">
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteOrder(o.id)} className="text-gray-500 hover:text-red-400 interactive">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No orders yet &mdash; add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {tab === "inventory" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h1 className="text-2xl font-display font-semibold">Fabric & supplies</h1>
            <div className="flex flex-wrap gap-2">
              <input
                value={newItem.item_name}
                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                placeholder="Item name"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-48"
              />
              <input
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                placeholder="Quantity"
                type="number"
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm w-28"
              />
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                {["yards", "meters", "rolls", "pieces", "sets"].map((u) => (
                  <option key={u} value={u} className="bg-[#0b0a08]">
                    {u}
                  </option>
                ))}
              </select>
              <button onClick={addItem} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium interactive">
                <Plus size={14} /> Add item
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-left text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((i) => (
                    <tr key={i.id} className="border-t border-white/5">
                      <td className="px-4 py-3">{i.item_name}</td>
                      <td className="px-4 py-3 text-gray-400">{i.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => adjustStock(i.id, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 interactive">
                            &minus;
                          </button>
                          <span className={i.quantity <= i.reorder_level ? "text-amber-300 font-medium" : ""}>
                            {i.quantity} {i.unit}
                          </span>
                          <button onClick={() => adjustStock(i.id, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 interactive">
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteItem(i.id)} className="text-gray-500 hover:text-red-400 interactive">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && inventory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No stock tracked yet &mdash; add an item above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {tab === "live" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-display font-semibold">Live</h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-medium">
                <Radio size={11} /> Real data, not a demo
              </span>
            </div>
            <p className="text-sm text-gray-400 max-w-2xl">
              This tab is genuinely connected to Abdulwahab's actual AtelierFit and Atelier Noir businesses &mdash;
              real orders, real bookings, real stock. It's intentionally left unlocked, read-only, so you can see
              it's really wired up rather than take that on faith. (The Dashboard/Orders/Inventory tabs are the
              separate, editable demo &mdash; this one can't be edited by visitors.)
            </p>

            {liveError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{liveError}</div>}
            {liveLoading && !liveLoaded && <p className="text-gray-500 text-sm">Loading live data&hellip;</p>}

            {liveOverview && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">AtelierFit orders</p>
                  <p className="text-3xl font-display font-semibold">{liveOverview.atelierfit.totalOrders}</p>
                  <p className="text-xs text-gray-500 mt-1">{liveOverview.atelierfit.activeOrders} active</p>
                </div>
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Atelier Noir</p>
                  <p className="text-3xl font-display font-semibold">{liveOverview.atelierNoir.publishedProducts}</p>
                  <p className="text-xs text-gray-500 mt-1">published pieces &middot; {liveOverview.atelierNoir.totalBookings} bookings</p>
                </div>
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="text-xs uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Real stock
                  </p>
                  <p className="text-3xl font-display font-semibold">{liveOverview.inventory.totalItems}</p>
                  <p className="text-xs text-gray-500 mt-1">{liveOverview.inventory.lowStockCount} running low</p>
                </div>
              </div>
            )}

            {liveOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-2">AtelierFit &mdash; real orders</h2>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/[0.03] text-left text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Garment</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Delivery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveOrders.map((o) => (
                        <tr key={o.id} className="border-t border-white/5">
                          <td className="px-4 py-3">
                            <div>{o.customer_name}</div>
                            <div className="text-xs text-gray-500">{o.customer_email}{o.customer_phone ? ` · ${o.customer_phone}` : ""}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{o.garment_type}{o.fabric ? ` (${o.fabric})` : ""}</td>
                          <td className="px-4 py-3">{naira(Math.round(o.amount_kobo / 100))}</td>
                          <td className="px-4 py-3">{o.status}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {o.delivery_method === "shipping" ? `Shipping${o.shipping_address ? ` — ${o.shipping_address}` : ""}` : "Pickup"}
                            {o.tracking_number && <div className="text-xs text-gold font-mono">Tracking: {o.tracking_number}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {liveProducts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-2">Atelier Noir &mdash; published catalog</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {liveProducts.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2" />}
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.category}</p>
                      {p.price != null && <p className="text-xs text-gold">{p.currency} {p.price.toLocaleString()}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {liveBookings.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-2">Atelier Noir &mdash; real bookings</h2>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/[0.03] text-left text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Kind / service</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveBookings.map((b) => (
                        <tr key={b.id} className="border-t border-white/5">
                          <td className="px-4 py-3">{b.full_name}</td>
                          <td className="px-4 py-3 text-gray-400">{b.email}{b.phone ? ` · ${b.phone}` : ""}</td>
                          <td className="px-4 py-3 text-gray-400">{b.kind}{b.service ? ` — ${b.service}` : ""}</td>
                          <td className="px-4 py-3">{b.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {liveInventory.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 mb-2">Real fabric &amp; supplies stock</h2>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/[0.03] text-left text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveInventory.map((i) => (
                        <tr key={i.id} className="border-t border-white/5">
                          <td className="px-4 py-3">{i.item_name}</td>
                          <td className="px-4 py-3 text-gray-400">{i.category}</td>
                          <td className="px-4 py-3">
                            <span className={i.quantity <= i.reorder_level ? "text-amber-300 font-medium" : ""}>
                              {i.quantity} {i.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{i.supplier || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {liveLoaded && liveOrders.length === 0 && liveProducts.length === 0 && liveBookings.length === 0 && liveInventory.length === 0 && (
              <p className="text-gray-500 text-sm flex items-center gap-1.5">
                Nothing real to show yet. <ExternalLink size={12} />
              </p>
            )}
          </motion.div>
        )}

        {tab === "manage" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {isRealAdmin ? (
              <AdminAtelierFit />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
                <Lock size={28} className="text-gray-500" />
                <h1 className="text-xl font-display font-semibold">Manage is for the shop owner</h1>
                <p className="text-sm text-gray-400 max-w-md">
                  This is the real order-management screen for AtelierFit &mdash; the same one that used to
                  live at <code className="text-gray-300">/admin/atelierfit</code>, now folded into StitchBook
                  since this is meant to be the one shared dashboard for the business. Sign in as the owner to
                  see and update real customer orders.
                </p>
                <Link
                  to="/admin/login"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-black text-sm font-medium"
                >
                  Owner sign-in
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
