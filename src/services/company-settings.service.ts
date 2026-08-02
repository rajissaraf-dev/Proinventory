// src/services/company-settings.service.ts
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import db from "./firebase";

interface CompanySettingsData {
  currency?: string;
  currencySymbol?: string;
  lowStockThreshold?: number;
  lowStockAlert?: number;
  logoUrl?: string;
  companyName?: string;
}

export interface CompanySettings {
  currency: string;
  currencySymbol?: string;
  lowStockThreshold: number;
  logoUrl?: string;
  companyName?: string;
}

const normalizeSettings = (data: CompanySettingsData | undefined): CompanySettings => ({
  currency: data?.currency || "USD",
  currencySymbol: data?.currencySymbol || data?.currency || "$",
  lowStockThreshold: data?.lowStockThreshold ?? data?.lowStockAlert ?? 10,
  logoUrl: data?.logoUrl || "",
  companyName: data?.companyName?.trim() || "",
});

export const CompanySettingsService = {
  async getSettings(companyId: string): Promise<CompanySettings> {
    const docRef = doc(db, "companies", companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return normalizeSettings(snap.data());
    }
    return { currency: "USD", currencySymbol: "$", lowStockThreshold: 10, logoUrl: "", companyName: "" };
  },

  async updateSettings(companyId: string, settings: Partial<CompanySettings>): Promise<void> {
    const docRef = doc(db, "companies", companyId);
    await updateDoc(docRef, {
      ...settings,
      updatedAt: new Date(),
    });
  },

  watchSettings(companyId: string, onChange: (settings: CompanySettings) => void) {
    const docRef = doc(db, "companies", companyId);
    return onSnapshot(docRef, (snap) => {
      const settings = snap.exists() ? normalizeSettings(snap.data()) : { currency: "USD", currencySymbol: "$", lowStockThreshold: 10, logoUrl: "", companyName: "" };
      onChange(settings);
    });
  },
};