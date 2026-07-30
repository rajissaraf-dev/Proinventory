// src/app/store.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer    from "../features/auth/authSlice";
import stockReducer   from "../features/stock/stockSlice";
import businessReducer from "../features/business/businessSlice";
import companyReducer from "../features/company/companySlice";
import modalReducer   from "../features/ui/modalSlice";
import uiReducer      from "../features/ui/uiSlice";
import messagingReducer from "../features/messaging/messagingSlice"; // ← ADD

export const store = configureStore({
  reducer: {
    auth:     authReducer,
    stock:    stockReducer,
    business: businessReducer,  // legacy — kept for existing components
    company:  companyReducer,   // new: companies/{companyId}
    modal:    modalReducer,
    ui:       uiReducer,        // UI state like sidebar
    messaging: messagingReducer, // ← ADD - Messaging state
  },
});

export type RootState    = ReturnType<typeof store.getState>;
export type AppDispatch  = typeof store.dispatch;