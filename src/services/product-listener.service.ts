// src/services/product-listener.service.ts

import { 
  collection, 
  query, 
  onSnapshot, 
  QuerySnapshot,
  DocumentData,
  limit
} from "firebase/firestore";
import db from "./firebase";
import { Product } from "../types";

type ProductListenerCallback = (products: Product[]) => void;

class ProductListenerService {
  private unsubscribers: Map<string, () => void> = new Map();

  subscribeToProducts(
    companyId: string, 
    callback: ProductListenerCallback
  ): () => void {
    if (this.unsubscribers.has(companyId)) {
      this.unsubscribers.get(companyId)?.();
      this.unsubscribers.delete(companyId);
    }

    const productsQuery = query(
      collection(db, "companies", companyId, "products"),
      limit(1000)
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const products = snapshot.docs.map((doc) => {
          const raw = doc.data();
          return {
            id: doc.id,
            name: raw.name || raw.product_name || "",
            product_name: raw.name || raw.product_name || "",
            sku: raw.sku || `SKU-${doc.id.slice(0, 6).toUpperCase()}`,
            categoryId: raw.categoryId || "",
            categoryName: raw.categoryName || raw.product_description || "",
            price: Number(raw.price || raw.product_Price || 0),
            product_Price: Number(raw.price || raw.product_Price || 0),
            stockQuantity: Number(raw.stockQuantity || raw.product_Qty || 0),
            product_Qty: Number(raw.stockQuantity || raw.product_Qty || 0),
            status: (raw.status || "in_stock") as Product["status"],
            imageUrl: raw.imageUrl || raw.img || "",
            img: raw.imageUrl || raw.img || "",
            companyId: raw.companyId || companyId,
            createdBy: raw.createdBy || "",
            createdAt: raw.createdAt || new Date(),
            updatedAt: raw.updatedAt || new Date(),
            size: raw.size || "Piece",
            warehouseId: raw.warehouseId || "", // ← ADDED
            warehouseName: raw.warehouseName || "", // ← ADDED
            initialStock: raw.initialStock || 0,
            timestamp: raw.timestamp || null,
          } as Product;
        });
        
        console.log(`📦 [ProductListener] ${products.length} products updated`);
        callback(products);
      },
      (error) => {
        console.error("❌ [ProductListener] Error:", error);
      }
    );

    this.unsubscribers.set(companyId, unsubscribe);
    return unsubscribe;
  }

  unsubscribeAll(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers.clear();
    console.log("🧹 [ProductListener] All listeners cleared");
  }

  hasListener(companyId: string): boolean {
    return this.unsubscribers.has(companyId);
  }
}

export const productListener = new ProductListenerService();