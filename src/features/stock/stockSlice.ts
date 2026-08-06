import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Product, ProductState } from "../../types";

const toSerializableValue = (value: unknown): unknown => {
  if (!value) return value;

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeDate = value as { toDate?: () => Date };
    if (typeof maybeDate.toDate === "function") {
      return maybeDate.toDate().toISOString();
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const normalizeProduct = (product: Product): Product => ({
  ...product,
  createdAt: toSerializableValue(product.createdAt) as Product["createdAt"],
  updatedAt: toSerializableValue(product.updatedAt) as Product["updatedAt"],
  timestamp: product.timestamp ? toSerializableValue(product.timestamp) as Product["timestamp"] : product.timestamp,
});

const initialState: ProductState = {
  productData: [],
  isLoading: true,
};

const stockSlice = createSlice({
  name: "stock",
  initialState,
  reducers: {
    setStockData(state, action: PayloadAction<Product[]>) {
      state.productData = action.payload.map(normalizeProduct);
      state.isLoading = false;
    },
    // ✅ ADD THIS REDUCER
    updateProduct: (state, action: PayloadAction<{ id: string; changes: Partial<Product> }>) => {
      const { id, changes } = action.payload;
      const index = state.productData.findIndex(p => p.id === id);
      if (index !== -1) {
        state.productData[index] = normalizeProduct({ ...state.productData[index], ...changes });
      }
    },
    // ✅ ADD THIS REDUCER (optional - for adding new products)
    addProduct: (state, action: PayloadAction<Product>) => {
      state.productData.push(normalizeProduct(action.payload));
    },
    // ✅ ADD THIS REDUCER (optional - for removing products)
    removeProduct: (state, action: PayloadAction<string>) => {
      state.productData = state.productData.filter(p => p.id !== action.payload);
    },
  },
});

// ✅ EXPORT ALL ACTIONS
export const { setStockData, updateProduct, addProduct, removeProduct } = stockSlice.actions;

export default stockSlice.reducer;