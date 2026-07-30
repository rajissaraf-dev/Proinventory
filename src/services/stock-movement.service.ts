// src/services/stock-movement.service.ts

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  startAfter,
  QueryDocumentSnapshot,
  CollectionReference,
  Query,
} from "firebase/firestore";
import db from "./firebase";
import { StockMovement, StockMovementType } from "../types";

// Type for pagination response
export interface PaginatedMovements {
  movements: StockMovement[];
  totalCount: number;
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export interface LogMovementInput {
  companyId: string;
  createdBy: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string;
  notes?: string;
}

export const StockMovementService = {

  /** Append a new movement record — ID is auto-generated */
  async log(input: LogMovementInput): Promise<StockMovement> {
    const ref = doc(collection(db, "companies", input.companyId, "stockMovements"));
    const data: Omit<StockMovement, "id"> = {
      productId: input.productId,
      productName: input.productName,
      sku: input.sku,
      warehouseId: input.warehouseId,
      type: input.type,
      quantity: input.quantity,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
      reference: input.reference ?? "",
      notes: input.notes ?? "",
      companyId: input.companyId,
      createdBy: input.createdBy,
      createdAt: new Date(),
    };
    await setDoc(ref, data);
    return { id: ref.id, ...data };
  },

  async listByProduct(companyId: string, productId: string, maxResults = 50): Promise<StockMovement[]> {
    const snap = await getDocs(
      query(
        collection(db, "companies", companyId, "stockMovements"),
        where("productId", "==", productId),
        orderBy("createdAt", "desc"),
        limit(maxResults),
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement));
  },

  async listRecent(companyId: string, maxResults = 20): Promise<StockMovement[]> {
    const snap = await getDocs(
      query(
        collection(db, "companies", companyId, "stockMovements"),
        orderBy("createdAt", "desc"),
        limit(maxResults),
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement));
  },

  /**
   * Fetch movements with pagination
   */
  async listPaginated(
    companyId: string,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot,
    typeFilter?: string
  ): Promise<PaginatedMovements> {
    const ref: CollectionReference = collection(db, "companies", companyId, "stockMovements");
    
    // Build base query
    let q: Query = query(
      ref,
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    // Add type filter if provided
    if (typeFilter && typeFilter !== "all") {
      q = query(q, where("type", "==", typeFilter));
    }

    // Add startAfter for pagination
    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    // ─── FIX: Properly type countQuery ───
    let countQuery: CollectionReference | Query = ref;
    if (typeFilter && typeFilter !== "all") {
      countQuery = query(ref, where("type", "==", typeFilter));
    }
    const countSnapshot = await getCountFromServer(countQuery);
    const totalCount = countSnapshot.data().count;

    // Get paginated results
    const snap = await getDocs(q);
    const movements: StockMovement[] = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as StockMovement[];

    const lastDoc: QueryDocumentSnapshot | null = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      movements,
      totalCount,
      lastVisible: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  },

  /**
   * Get movements by type (for filtering)
   */
  async listByType(
    companyId: string,
    type: StockMovementType,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot
  ): Promise<PaginatedMovements> {
    return this.listPaginated(companyId, pageSize, lastVisible, type);
  },
};