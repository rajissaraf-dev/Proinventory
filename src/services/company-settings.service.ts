// src/services/company-settings.service.ts
import { doc, getDoc, updateDoc } from "firebase/firestore";
import db from "./firebase";

export interface CompanySettings {
  currency: string;
  lowStockThreshold: number;
  logoUrl?: string;
}

export const CompanySettingsService = {
  async getSettings(companyId: string): Promise<CompanySettings> {
    const docRef = doc(db, "companies", companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        currency: data.currency || "USD",
        lowStockThreshold: data.lowStockThreshold ?? 10,
        logoUrl: data.logoUrl || "",
      };
    }
    return { currency: "USD", lowStockThreshold: 10, logoUrl: "" };
  },

  async updateSettings(companyId: string, settings: Partial<CompanySettings>): Promise<void> {
    const docRef = doc(db, "companies", companyId);
    await updateDoc(docRef, settings);
  },
};