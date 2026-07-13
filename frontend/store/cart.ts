import { create } from "zustand";
import api from "@/lib/api";
export interface CartItem {
  id: number;                 
  variant_id: number;
  quantity: number;
  custom_width_ft?: number;
  custom_height_ft?: number;
  product_name: string;
  sku: string;
  selected_attributes: Record<string, string>;
  unit_price: number;
  line_total: number;
  primary_image?: string;
  stock_qty?: number;
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  hydrated: boolean;
  fetchCart: () => Promise<void>;
  addItem: (
    variant_id: number,
    quantity: number,
    opts?: { custom_width_ft?: number; custom_height_ft?: number }
  ) => Promise<void>;
  updateQuantity: (id: number, quantity: number) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  clearCart: () => Promise<void>;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  loading: false,
  hydrated: false,

  // Pulls the authoritative cart from the backend. Call on login/app mount
  // and after every mutation so the UI always reflects what checkout will see.
  fetchCart: async () => {
    set({ loading: true });
    try {
      const res = await api.get("/cart/");
      set({ items: res.data || [], hydrated: true });
    } catch {
      set({ items: [] });
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (variant_id, quantity, opts) => {
    await api.post("/cart/", { variant_id, quantity, ...opts });
    await get().fetchCart();
  },

  updateQuantity: async (id, quantity) => {
    if (quantity <= 0) {
      await get().removeItem(id);
      return;
    }
    await api.patch(`/cart/${id}`, null, { params: { quantity } });
    await get().fetchCart();
  },

  removeItem: async (id) => {
    await api.delete(`/cart/${id}`);
    await get().fetchCart();
  },

  clearCart: async () => {
    const items = get().items;
    await Promise.all(
      items.map((i) =>
        api.delete(`/cart/${i.id}`).catch((err: any) => {
          // 404 just means the row is already gone (e.g. order was just placed,
          // which deletes cart rows server-side) — safe to ignore.
          if (err?.response?.status !== 404) throw err;
        })
      )
    );
    set({ items: [] });
  },

  total: () => get().items.reduce((sum, item) => sum + item.line_total, 0),
}));