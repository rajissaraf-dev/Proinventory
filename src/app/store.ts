// src/app/store.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer    from "../features/auth/authSlice";
import stockReducer   from "../features/stock/stockSlice";
import businessReducer from "../features/business/businessSlice";
import companyReducer from "../features/company/companySlice";
import modalReducer   from "../features/ui/modalSlice";
import uiReducer      from "../features/ui/uiSlice"; // ← ADD THIS (NEW)

export const store = configureStore({
  reducer: {
    auth:     authReducer,
    stock:    stockReducer,
    business: businessReducer,  // legacy — kept for existing components
    company:  companyReducer,   // new: companies/{companyId}
    modal:    modalReducer,
    ui:       uiReducer,        // ← ADD THIS (NEW) - for UI state like sidebar
  },
});

export type RootState    = ReturnType<typeof store.getState>;
export type AppDispatch  = typeof store.dispatch;