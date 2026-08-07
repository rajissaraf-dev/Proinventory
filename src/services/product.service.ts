/**
 * product.service.ts
 * CRUD for companies/{companyId}/products/{productId}
 */
import {
  collection, doc, setDoc, getDoc,
  updateDoc, deleteDoc, getDocs,
  query, where, orderBy,
} from "firebase/firestore";
import db from "./firebase";
import { Product } from "../types";
import { InventoryService } from "./inventory.service";
import { StockMovementService } from "./stock-movement.service";

export interface CreateProductInput {
  companyId:     string;
  createdBy:     string;
  name:          string;
  sku:           string;
  categoryId:    string;
  categoryName:  string;
  price:         number;
  stockQuantity: number;
  imageUrl?:     string;
  size?:         string;
  warehouseId?:  string;
  warehouseName?: string;
}

export const ProductService = {

  /**
   * Find an existing product matching name + categoryName (case-insensitive).
   * Returns the first match or null.
   */
  async findByNameAndCategory(
    companyId: string,
    name: string,
    categoryName: string,
  ): Promise<Product | null> {
    const snap = await getDocs(
      query(
        collection(db, "companies", companyId, "products"),
        where("name", "==", name.trim()),
        where("categoryName", "==", categoryName.trim()),
      )
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Product;
  },

  /**
   * Create a new product OR merge the quantity into an existing one if a product
   * with the same name and category already exists.
   *
   * Returns:
   *   { product, merged: false }  — a brand-new product was created
   *   { product, merged: true  }  — quantity was added to an existing product
   */
  async createOrMerge(
    input: CreateProductInput,
  ): Promise<{ product: Product; merged: boolean }> {
    const existing = await ProductService.findByNameAndCategory(
      input.companyId,
      input.name,
      input.categoryName,
    );

    if (!existing) {
      const product = await ProductService.create(input);
      return { product, merged: false };
    }

    // ── Duplicate found — merge the quantity ──
    const newQty  = (existing.stockQuantity ?? 0) + input.stockQuantity;
    const status  = newQty === 0 ? "out_of_stock"
      : newQty <= 10 ? "low_stock" : "in_stock";

    await updateDoc(
      doc(db, "companies", input.companyId, "products", existing.id),
      {
        stockQuantity: newQty,
        product_Qty:   newQty,
        status,
        updatedAt:     new Date(),
      }
    );

    // Update inventory record for the target warehouse
    const warehouseId   = input.warehouseId   ?? "main_warehouse";
    const warehouseName = input.warehouseName ?? warehouseId;

    await InventoryService.upsert({
      companyId:    input.companyId,
      productId:    existing.id,
      productName:  existing.name,
      warehouseId,
      warehouseName,
      quantity:     newQty,
      reorderLevel: 10,
    });

    // Log stock movement for the added quantity
    await StockMovementService.log({
      companyId:     input.companyId,
      createdBy:     input.createdBy,
      productId:     existing.id,
      productName:   existing.name,
      sku:           existing.sku,
      warehouseId,
      type:          "stock_in",
      quantity:      input.stockQuantity,
      balanceBefore: existing.stockQuantity ?? 0,
      balanceAfter:  newQty,
      notes:         "Quantity merged from duplicate product upload",
    });

    const updated: Product = {
      ...existing,
      stockQuantity: newQty,
      product_Qty:   newQty,
      status,
      updatedAt:     new Date(),
    };

    console.log(`🔀 [ProductService] Merged qty into existing product "${existing.name}" → new qty: ${newQty}`);
    return { product: updated, merged: true };
  },

  async create(input: CreateProductInput): Promise<Product> {
    const ref  = doc(collection(db, "companies", input.companyId, "products"));
    const status = input.stockQuantity === 0 ? "out_of_stock"
      : input.stockQuantity <= 10 ? "low_stock" : "in_stock";
    const data: Omit<Product, "id"> = {
      name:          input.name,
      sku:           input.sku,
      categoryId:    input.categoryId,
      categoryName:  input.categoryName,
      price:         input.price,
      stockQuantity: input.stockQuantity,
      status,
      imageUrl:      input.imageUrl ?? "",
      companyId:     input.companyId,
      createdBy:     input.createdBy,
      createdAt:     new Date(),
      updatedAt:     new Date(),
      // Legacy compat
      product_name:        input.name,
      product_Qty:         input.stockQuantity,
      product_Price:       input.price,
      product_description: input.categoryName,
      size:                input.size ?? "Piece",
      img:                 input.imageUrl ?? "",
    };
    await setDoc(ref, data);

    const warehouseId = input.warehouseId ?? "main_warehouse";
    const warehouseName = input.warehouseName ?? warehouseId;

    await InventoryService.upsert({
      companyId:     input.companyId,
      productId:     ref.id,
      productName:   input.name,
      warehouseId,
      warehouseName,
      quantity:      input.stockQuantity,
      reorderLevel:  10,
    });

    // Log initial stock movement
    await StockMovementService.log({
      companyId:     input.companyId,
      createdBy:     input.createdBy,
      productId:     ref.id,
      productName:   input.name,
      sku:           input.sku,
      warehouseId,
      type:          "stock_in",
      quantity:      input.stockQuantity,
      balanceBefore: 0,
      balanceAfter:  input.stockQuantity,
      notes:         "Initial stock on product creation",
    });

    console.log(`✅ [ProductService] products/${ref.id} written`);
    return { id: ref.id, ...data };
  },

  async get(companyId: string, productId: string): Promise<Product> {
    const snap = await getDoc(doc(db, "companies", companyId, "products", productId));
    if (!snap.exists()) throw new Error(`Product not found: ${productId}`);
    return { id: snap.id, ...snap.data() } as Product;
  },

  async list(companyId: string): Promise<Product[]> {
    const snap = await getDocs(collection(db, "companies", companyId, "products"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
  },

  async update(companyId: string, productId: string, updates: Partial<Product>): Promise<void> {
    const status = updates.stockQuantity !== undefined
      ? updates.stockQuantity === 0 ? "out_of_stock"
        : updates.stockQuantity <= 10 ? "low_stock" : "in_stock"
      : undefined;
    await updateDoc(
      doc(db, "companies", companyId, "products", productId),
      { ...updates, ...(status ? { status } : {}), updatedAt: new Date() }
    );
  },

  async delete(companyId: string, productId: string): Promise<void> {
    await deleteDoc(doc(db, "companies", companyId, "products", productId));
  },
};
