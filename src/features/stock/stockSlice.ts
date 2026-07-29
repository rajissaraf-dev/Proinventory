import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Product, ProductState } from "../../types";

const initialState: ProductState = {
  productData: [],
  isLoading: true,
};

const stockSlice = createSlice({
  name: "stock",
  initialState,
  reducers: {
    setStockData(state, action: PayloadAction<Product[]>) {
      state.productData = action.payload;
      state.isLoading = false;
    },
    // ✅ ADD THIS REDUCER
    updateProduct: (state, action: PayloadAction<{ id: string; changes: Partial<Product> }>) => {
      const { id, changes } = action.payload;
      const index = state.productData.findIndex(p => p.id === id);
      if (index !== -1) {
        state.productData[index] = { ...state.productData[index], ...changes };
      }
    },
    // ✅ ADD THIS REDUCER (optional - for adding new products)
    addProduct: (state, action: PayloadAction<Product>) => {
      state.productData.push(action.payload);
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