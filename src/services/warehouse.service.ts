/**
 * warehouse.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD for companies/{companyId}/warehouses/{warehouseId}
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  collection, doc, setDoc, getDoc,
  updateDoc, deleteDoc, getDocs,
  query, where, // ← Added query, where
} from "firebase/firestore";
import db from "./firebase";
import { Warehouse } from "../types";

export interface CreateWarehouseInput {
  companyId:  string;
  createdBy:  string;
  name:       string;
  code:       string;
  address?:   string;
  city?:      string;
  country?:   string;
  isDefault?: boolean;
}

export const WarehouseService = {

  /**
   * Create a warehouse — uses a deterministic ID for the main warehouse
   * Safety: Prevents duplicate default warehouses
   */
  async create(input: CreateWarehouseInput): Promise<Warehouse> {
    // Validate required fields
    if (!input.companyId) throw new Error("Company ID is required");
    if (!input.createdBy) throw new Error("Created by is required");
    if (!input.name?.trim()) throw new Error("Warehouse name is required");
    if (!input.code?.trim()) throw new Error("Warehouse code is required");

    // If creating a default warehouse, check if one already exists
    if (input.isDefault) {
      try {
        const existingDefault = await getDoc(
          doc(db, "companies", input.companyId, "warehouses", "main_warehouse")
        );
        if (existingDefault.exists()) {
          // Instead of throwing, return the existing default warehouse
          const data = existingDefault.data();
          console.log(`ℹ️ [WarehouseService] Default warehouse already exists, reusing: main_warehouse`);
          return { 
            id: existingDefault.id, 
            ...data 
          } as Warehouse;
        }
      } catch (error) {
        // If error is not "not found", log it but continue
        if (error instanceof Error && !error.message.includes("not found")) {
          console.warn("⚠️ [WarehouseService] Error checking for existing default:", error);
        }
      }
    }

    // Use deterministic ID for default warehouse
    const id = input.isDefault ? "main_warehouse" : undefined;
    
    const data: Omit<Warehouse, "id"> = {
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      address: input.address ?? "",
      city: input.city ?? "",
      country: input.country ?? "",
      isDefault: input.isDefault ?? false,
      companyId: input.companyId,
      createdBy: input.createdBy,
      // status is optional in the type, so we can add it
      // but make sure it's defined in the Warehouse interface
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ref = id
      ? doc(db, "companies", input.companyId, "warehouses", id)
      : doc(collection(db, "companies", input.companyId, "warehouses"));

    await setDoc(ref, data);
    console.log(`✅ [WarehouseService] Warehouse created: ${ref.id}`);
    return { id: ref.id, ...data };
  },

  /**
   * Get a warehouse by ID
   * Safety: Returns null if not found instead of throwing
   */
  async get(companyId: string, warehouseId: string): Promise<Warehouse | null> {
    if (!companyId || !warehouseId) {
      console.warn("⚠️ [WarehouseService] Missing companyId or warehouseId");
      return null;
    }

    try {
      const snap = await getDoc(doc(db, "companies", companyId, "warehouses", warehouseId));
      if (!snap.exists()) {
        console.warn(`⚠️ [WarehouseService] Warehouse not found: ${warehouseId}`);
        return null;
      }
      const data = snap.data();
      return { id: snap.id, ...data } as Warehouse;
    } catch (error) {
      console.error(`❌ [WarehouseService] Error getting warehouse ${warehouseId}:`, error);
      return null;
    }
  },

  /**
   * List all warehouses for a company
   * Safety: Returns empty array on error, always includes default warehouse if it exists
   */
  async list(companyId: string): Promise<Warehouse[]> {
    if (!companyId) {
      console.warn("⚠️ [WarehouseService] No companyId provided for list");
      return [];
    }

    try {
      console.log(`📝 [WarehouseService] Listing warehouses for company: ${companyId}`);
      
      const snap = await getDocs(collection(db, "companies", companyId, "warehouses"));
      
      if (snap.empty) {
        console.log(`ℹ️ [WarehouseService] No warehouses found for company: ${companyId}`);
        return [];
      }

      const warehouses = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Unnamed Warehouse",
          code: data.code || "",
          address: data.address || "",
          city: data.city || "",
          country: data.country || "",
          isDefault: data.isDefault || false,
          companyId: data.companyId || companyId,
          createdBy: data.createdBy || "",
          status: data.status || "active",
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        } as Warehouse;
      });

      // Sort: default warehouse first, then alphabetically
      const sorted = warehouses.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log(`✅ [WarehouseService] Found ${sorted.length} warehouses:`, sorted.map(w => `${w.name} (${w.id})`));
      return sorted;
    } catch (error) {
      console.error(`❌ [WarehouseService] Error listing warehouses for ${companyId}:`, error);
      return [];
    }
  },

  /**
   * Get the default warehouse for a company
   * Safety: Returns null if not found
   */
  async getDefault(companyId: string): Promise<Warehouse | null> {
    if (!companyId) {
      console.warn("⚠️ [WarehouseService] No companyId provided for getDefault");
      return null;
    }

    console.log(`📝 [WarehouseService] Getting default warehouse for: ${companyId}`);

    try {
      // First try to get the main_warehouse by ID
      const snap = await getDoc(doc(db, "companies", companyId, "warehouses", "main_warehouse"));
      if (snap.exists()) {
        const data = snap.data();
        console.log(`✅ [WarehouseService] Found default warehouse: main_warehouse`);
        return { id: snap.id, ...data } as Warehouse;
      }

      // If not found, query for any warehouse with isDefault: true
      console.log(`ℹ️ [WarehouseService] main_warehouse not found, searching by isDefault flag...`);
      const q = query(
        collection(db, "companies", companyId, "warehouses"),
        where("isDefault", "==", true)
      );
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const doc = querySnap.docs[0];
        const data = doc.data();
        console.log(`✅ [WarehouseService] Found default warehouse: ${data.name}`);
        return { id: doc.id, ...data } as Warehouse;
      }

      // If no default found, return the first warehouse
      const allWarehouses = await this.list(companyId);
      if (allWarehouses.length > 0) {
        console.log(`ℹ️ [WarehouseService] No default found, returning first warehouse: ${allWarehouses[0].name}`);
        return allWarehouses[0];
      }

      console.log(`⚠️ [WarehouseService] No warehouses found for company: ${companyId}`);
      return null;
    } catch (error) {
      console.error(`❌ [WarehouseService] Error getting default warehouse for ${companyId}:`, error);
      return null;
    }
  },

  /**
   * Update a warehouse
   * Safety: Prevents deleting the default warehouse flag if it's the last one
   */
  async update(companyId: string, warehouseId: string, updates: Partial<Warehouse>): Promise<void> {
    if (!companyId || !warehouseId) {
      throw new Error("Company ID and Warehouse ID are required for update");
    }

    console.log(`📝 [WarehouseService] Updating warehouse: ${warehouseId}`);

    // If setting this as default, unset other defaults
    if (updates.isDefault) {
      const allWarehouses = await this.list(companyId);
      for (const wh of allWarehouses) {
        if (wh.id !== warehouseId && wh.isDefault) {
          console.log(`ℹ️ [WarehouseService] Unsetting default from: ${wh.id}`);
          await this.update(companyId, wh.id, { isDefault: false });
        }
      }
    }

    // Prevent setting isDefault: false if this is the only warehouse
    if (updates.isDefault === false) {
      const allWarehouses = await this.list(companyId);
      const activeWarehouses = allWarehouses.filter(w => w.status !== "inactive");
      if (activeWarehouses.length <= 1 && activeWarehouses.some(w => w.id === warehouseId)) {
        console.warn(`⚠️ [WarehouseService] Cannot unset default on the last warehouse`);
        throw new Error("Cannot unset default on the last warehouse. At least one warehouse must be the default.");
      }
    }

    await updateDoc(
      doc(db, "companies", companyId, "warehouses", warehouseId),
      { ...updates, updatedAt: new Date() }
    );
    console.log(`✅ [WarehouseService] Warehouse updated: ${warehouseId}`);
  },

  /**
   * Delete a warehouse
   * Safety: Prevents deleting the default warehouse and prevents deleting the last warehouse
   */
  async delete(companyId: string, warehouseId: string): Promise<void> {
    if (!companyId || !warehouseId) {
      throw new Error("Company ID and Warehouse ID are required for delete");
    }

    console.log(`📝 [WarehouseService] Deleting warehouse: ${warehouseId}`);

    // Prevent deleting the default warehouse
    try {
      const warehouse = await this.get(companyId, warehouseId);
      if (!warehouse) {
        console.warn(`⚠️ [WarehouseService] Warehouse not found, skipping delete: ${warehouseId}`);
        return;
      }

      if (warehouse.isDefault) {
        // Check if there are other warehouses
        const allWarehouses = await this.list(companyId);
        const otherWarehouses = allWarehouses.filter(w => w.id !== warehouseId);
        
        if (otherWarehouses.length === 0) {
          throw new Error("Cannot delete the only warehouse. Create another warehouse first.");
        }
        
        throw new Error(
          `Cannot delete the default warehouse "${warehouse.name}". ` +
          `Please set another warehouse as default first.`
        );
      }

      // Check if this is the last active warehouse
      const allWarehouses = await this.list(companyId);
      const activeWarehouses = allWarehouses.filter(w => w.status !== "inactive");
      if (activeWarehouses.length <= 1) {
        throw new Error("Cannot delete the last active warehouse. At least one warehouse must remain.");
      }

      await deleteDoc(doc(db, "companies", companyId, "warehouses", warehouseId));
      console.log(`✅ [WarehouseService] Warehouse deleted: ${warehouseId}`);
    } catch (error) {
      console.error(`❌ [WarehouseService] Error deleting warehouse ${warehouseId}:`, error);
      throw error;
    }
  },

  /**
   * Check if a warehouse exists
   */
  async exists(companyId: string, warehouseId: string): Promise<boolean> {
    if (!companyId || !warehouseId) return false;
    try {
      const snap = await getDoc(doc(db, "companies", companyId, "warehouses", warehouseId));
      return snap.exists();
    } catch {
      return false;
    }
  },

  /**
   * Get warehouse by name (case-insensitive)
   */
  async getByName(companyId: string, name: string): Promise<Warehouse | null> {
    if (!companyId || !name) return null;
    
    try {
      const allWarehouses = await this.list(companyId);
      return allWarehouses.find(
        w => w.name.toLowerCase() === name.toLowerCase().trim()
      ) || null;
    } catch (error) {
      console.error(`❌ [WarehouseService] Error finding warehouse by name:`, error);
      return null;
    }
  }
};