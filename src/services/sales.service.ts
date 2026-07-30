// src/services/sales.service.ts

import {
  collection, doc, runTransaction,
  serverTimestamp, getDocs, query, where,
  orderBy, limit, getCountFromServer,
  QueryDocumentSnapshot, startAfter,
} from "firebase/firestore";
import db from "./firebase";

export interface SaleRecord {
  id: string;
  companyId: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  customerName?: string;
  customerEmail?: string;
  notes?: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'bank_deposit';
  discount: number;
  tax: number;
  createdAt: Date;
  createdBy: string;
}

export interface RecordSaleInput {
  companyId: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  customerName?: string;
  customerEmail?: string;
  notes?: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'bank_deposit';
  discount: number;
  tax: number;
  createdBy: string;
}

export interface PaginatedSales {
  sales: SaleRecord[];
  totalCount: number;
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// Type for inventory data from Firestore
interface InventoryData {
  quantity: number;
  reservedQty?: number;
  productName?: string;
  warehouseName?: string;
  reorderLevel?: number;
  availableQty?: number;
  companyId?: string;
  productId?: string;
  warehouseId?: string;
}

// ─── NEW: Event listener for real-time updates ───
type InventoryChangeListener = (data: {
  companyId: string;
  productId: string;
  warehouseId: string;
  newQuantity: number;
  oldQuantity: number;
}) => void;

const listeners: InventoryChangeListener[] = [];

export const SalesService = {
  /**
   * ─── NEW: Subscribe to inventory changes ───
   */
  subscribeToInventoryChanges(listener: InventoryChangeListener): () => void {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  },

  /**
   * ─── NEW: Notify all listeners of inventory change ───
   */
  notifyInventoryChange(data: {
    companyId: string;
    productId: string;
    warehouseId: string;
    newQuantity: number;
    oldQuantity: number;
  }): void {
    listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        console.error("Error in inventory change listener:", error);
      }
    });
  },

  /**
   * Record a sale - updates inventory and creates sale record
   * Now supports warehouse-specific sales with real-time sync
   */
  async recordSale(input: RecordSaleInput): Promise<string> {
    const { companyId, productId, quantity, createdBy, warehouseId, warehouseName } = input;

    // Get the product document
    const productRef = doc(db, "companies", companyId, "products", productId);

    // Get inventory record for the specific warehouse
    const inventoryId = `${productId}_${warehouseId}`;
    const inventoryRef = doc(db, "companies", companyId, "inventory", inventoryId);

    let saleId = "";
    let oldQuantity = 0;
    let newQuantity = 0;

    await runTransaction(db, async (transaction) => {
      // Read current data
      const productSnap = await transaction.get(productRef);
      const inventorySnap = await transaction.get(inventoryRef);

      if (!productSnap.exists()) {
        throw new Error(`Product ${input.productName} not found`);
      }

      if (!inventorySnap.exists()) {
        throw new Error(`Product "${input.productName}" not found in warehouse "${warehouseName}". Please ensure the product exists in this warehouse.`);
      }

      const inventoryData = inventorySnap.data() as InventoryData;

      // Check stock availability in this warehouse
      const currentStock = inventoryData.quantity || 0;
      oldQuantity = currentStock;
      
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock in "${warehouseName}". Available: ${currentStock}, Requested: ${quantity}`);
      }

      newQuantity = currentStock - quantity;
      const newReserved = inventoryData.reservedQty || 0;

      // 1. Update inventory for this specific warehouse
      transaction.update(inventoryRef, {
        quantity: newQuantity,
        availableQty: newQuantity - newReserved,
        updatedAt: serverTimestamp(),
      });

      // 2. Get total stock across all warehouses
      const allInventoryRef = collection(db, "companies", companyId, "inventory");
      const q = query(allInventoryRef, where("productId", "==", productId));
      const allInventorySnap = await getDocs(q);
      
      let totalQty = 0;
      allInventorySnap.forEach((doc) => {
        const data = doc.data() as InventoryData;
        totalQty += data.quantity || 0;
      });

      // 3. Update product total stock
      transaction.update(productRef, {
        stockQuantity: totalQty,
        status: totalQty === 0 ? "out_of_stock" : totalQty <= 10 ? "low_stock" : "in_stock",
        updatedAt: serverTimestamp(),
      });

      // 4. Create sale record with warehouse info
      const saleRef = doc(collection(db, "companies", companyId, "sales"));
      const saleData: Omit<SaleRecord, "id" | "createdAt"> = {
        companyId,
        productId,
        productName: input.productName,
        sku: input.sku,
        warehouseId,
        warehouseName,
        quantity,
        price: input.price,
        totalAmount: input.totalAmount,
        customerName: input.customerName || "",
        customerEmail: input.customerEmail || "",
        notes: input.notes || "",
        paymentMethod: input.paymentMethod,
        discount: input.discount || 0,
        tax: input.tax || 0,
        createdBy,
      };

      transaction.set(saleRef, {
        ...saleData,
        createdAt: serverTimestamp(),
      });

      saleId = saleRef.id;

      // 5. Log stock movement for this warehouse
      const movementRef = doc(collection(db, "companies", companyId, "stockMovements"));
      transaction.set(movementRef, {
        companyId,
        productId,
        productName: input.productName,
        sku: input.sku,
        warehouseId,
        warehouseName,
        type: "sale",
        quantity: -quantity,
        balanceBefore: currentStock,
        balanceAfter: newQuantity,
        reference: `SALE-${saleRef.id.slice(0, 8).toUpperCase()}`,
        notes: `Sale of ${quantity} units from ${warehouseName} to ${input.customerName || "Walk-in Customer"}`,
        createdBy,
        createdAt: serverTimestamp(),
      });
    });

    // ─── NEW: Notify listeners of inventory change ───
    this.notifyInventoryChange({
      companyId,
      productId,
      warehouseId,
      newQuantity,
      oldQuantity,
    });

    console.log(`✅ Sale recorded for ${input.productName}: ${oldQuantity} → ${newQuantity} units in ${warehouseName}`);

    return saleId;
  },

  /**
   * Calculate total quantity of a product across all warehouses
   */
  async calculateTotalProductQuantity(
    companyId: string,
    productId: string
  ): Promise<number> {
    const inventoryRef = collection(db, "companies", companyId, "inventory");
    const q = query(inventoryRef, where("productId", "==", productId));
    
    const snap = await getDocs(q);
    
    let total = 0;
    snap.forEach((doc) => {
      const data = doc.data() as InventoryData;
      total += data.quantity || 0;
    });
    
    return total;
  },

  /**
   * Get sales for a specific warehouse
   */
  async listByWarehouse(
    companyId: string,
    warehouseId: string,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot
  ): Promise<PaginatedSales> {
    const ref = collection(db, "companies", companyId, "sales");
    
    let q = query(
      ref,
      where("warehouseId", "==", warehouseId),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const countSnapshot = await getCountFromServer(q);
    const totalCount = countSnapshot.data().count;

    const snap = await getDocs(q);
    const sales = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as SaleRecord[];

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      sales,
      totalCount,
      lastVisible: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  },

  /**
   * Get total sales amount for a warehouse
   */
  async getWarehouseTotalSales(companyId: string, warehouseId: string, days: number = 30): Promise<number> {
    const ref = collection(db, "companies", companyId, "sales");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - days);
    
    const q = query(
      ref,
      where("warehouseId", "==", warehouseId),
      where("createdAt", ">=", thirtyDaysAgo),
      orderBy("createdAt", "desc")
    );
    
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach((doc) => {
      const data = doc.data() as SaleRecord;
      total += data.totalAmount || 0;
    });
    
    return total;
  },

  /**
   * Get sales for a company with pagination
   */
  async list(
    companyId: string,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot
  ): Promise<PaginatedSales> {
    const ref = collection(db, "companies", companyId, "sales");
    
    let q = query(
      ref,
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const countSnapshot = await getCountFromServer(ref);
    const totalCount = countSnapshot.data().count;

    const snap = await getDocs(q);
    const sales = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as SaleRecord[];

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      sales,
      totalCount,
      lastVisible: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  },
};