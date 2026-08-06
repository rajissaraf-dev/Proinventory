import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Company, CompanyState } from "../../types";

// ─── Helper: Convert Firestore Timestamps to serializable values ───
const toSerializableValue = (value: unknown): unknown => {
  if (!value) return value;

  // Handle Firestore Timestamp
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeDate = value as { toDate?: () => Date };
    if (typeof maybeDate.toDate === "function") {
      return maybeDate.toDate().toISOString();
    }
  }

  // Handle Date object
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

// ─── Helper: Normalize company data ───
const normalizeCompany = (company: Company): Company => ({
  ...company,
  createdAt: toSerializableValue(company.createdAt) as Company["createdAt"],
  updatedAt: toSerializableValue(company.updatedAt) as Company["updatedAt"],
});

const initialState: CompanyState = {
  company:   null,
  companyId: null,
  isLoading: false,   // start false — only true while actively fetching
};

const companySlice = createSlice({
  name: "company",
  initialState,
  reducers: {
    setCompany(state, action: PayloadAction<Company>) {
      const normalizedCompany = normalizeCompany(action.payload);
      state.company   = normalizedCompany;
      state.companyId = normalizedCompany.id;
      state.isLoading = false;
    },
    setCompanyLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    clearCompany(state) {
      state.company   = null;
      state.companyId = null;
      state.isLoading = false;
    },
  },
});

export const { setCompany, setCompanyLoading, clearCompany } = companySlice.actions;
export default companySlice.reducer;