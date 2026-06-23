import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variant_id: number;
  product_name: string;
  sku: string;
  selected_attributes: Record<string, string>;
  price: number;
  quantity: number;
  primary_image?: string;
  custom_width_ft?: number;
  custom_height_ft?: number;
  price_type: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (variant_id: number, quantity: number) => void;
  removeItem: (variant_id: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find(i => i.variant_id === item.variant_id);
        if (existing) {
          set({ items: get().items.map(i => i.variant_id === item.variant_id ? { ...i, quantity: i.quantity + item.quantity } : i) });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      updateQuantity: (variant_id, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter(i => i.variant_id !== variant_id) });
        } else {
          set({ items: get().items.map(i => i.variant_id === variant_id ? { ...i, quantity } : i) });
        }
      },

      removeItem: (variant_id) => {
        set({ items: get().items.filter(i => i.variant_id !== variant_id) });
      },

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, item) => {
        const price = item.price_type === "per_sqft" && item.custom_width_ft && item.custom_height_ft
          ? item.price * item.custom_width_ft * item.custom_height_ft * item.quantity
          : item.price * item.quantity;
        return sum + price;
      }, 0),
    }),
    { name: "cart-store" }
  )
);
