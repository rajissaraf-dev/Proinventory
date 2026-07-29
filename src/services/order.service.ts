// src/services/order.service.ts

import {
  collection, doc, setDoc, runTransaction,
  serverTimestamp, getDocs, query, where,
  orderBy, limit, getCountFromServer,
  QueryDocumentSnapshot, startAfter,
  updateDoc,
} from "firebase/firestore";
import db from "./firebase";
import { InventoryService } from "./inventory.service";
import { StockMovementService } from "./stock-movement.service";

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  companyId: string;
  orderNumber: string;
  warehouseId: string;
  warehouseName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateOrderInput {
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  items: OrderItem[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  createdBy: string;
}

export interface PaginatedOrders {
  orders: Order[];
  totalCount: number;
  lastVisible: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export const OrderService = {
  /**
   * Create a new order
   * Reserves stock from the specified warehouse
   */
  async createOrder(input: CreateOrderInput): Promise<string> {
    const { companyId, warehouseId, items, createdBy } = input;
    
    // Generate order number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    let orderId = "";

    await runTransaction(db, async (transaction) => {
      // Check stock availability for all items
      for (const item of items) {
        const inventoryId = `${item.productId}_${warehouseId}`;
        const inventoryRef = doc(db, "companies", companyId, "inventory", inventoryId);
        const inventorySnap = await transaction.get(inventoryRef);
        
        if (!inventorySnap.exists()) {
          throw new Error(`Product "${item.productName}" not found in warehouse`);
        }
        
        const inventoryData = inventorySnap.data();
        const availableStock = inventoryData.quantity - (inventoryData.reservedQty || 0);
        
        if (availableStock < item.quantity) {
          throw new Error(`Insufficient stock for "${item.productName}". Available: ${availableStock}, Requested: ${item.quantity}`);
        }
        
        // Reserve stock
        const newReserved = (inventoryData.reservedQty || 0) + item.quantity;
        transaction.update(inventoryRef, {
          reservedQty: newReserved,
          availableQty: inventoryData.quantity - newReserved,
          updatedAt: serverTimestamp(),
        });
      }

      // Create order
      const orderRef = doc(collection(db, "companies", companyId, "orders"));
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const orderData: Omit<Order, "id" | "createdAt" | "updatedAt"> = {
        companyId,
        orderNumber,
        warehouseId,
        warehouseName: input.warehouseName,
        items,
        totalAmount,
        status: 'pending',
        customerName: input.customerName || "",
        customerEmail: input.customerEmail || "",
        customerPhone: input.customerPhone || "",
        notes: input.notes || "",
        createdBy,
      };

      transaction.set(orderRef, {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      orderId = orderRef.id;

      // Log stock movement for each item (reservation)
      for (const item of items) {
        const movementRef = doc(collection(db, "companies", companyId, "stockMovements"));
        transaction.set(movementRef, {
          companyId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId,
          warehouseName: input.warehouseName,
          type: "order_placed",
          quantity: -item.quantity,
          balanceBefore: 0, // We don't track this easily in transaction
          balanceAfter: 0,
          reference: orderNumber,
          notes: `Order placed for ${item.quantity} units of ${item.productName}`,
          createdBy,
          createdAt: serverTimestamp(),
        });
      }
    });

    return orderId;
  },

  /**
   * Complete an order - deduct stock and mark as completed
   */
  async completeOrder(companyId: string, orderId: string): Promise<void> {
    const orderRef = doc(db, "companies", companyId, "orders", orderId);

    await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }

      const order = orderSnap.data() as Order;
      if (order.status === 'completed') {
        throw new Error("Order is already completed");
      }
      if (order.status === 'cancelled') {
        throw new Error("Cannot complete a cancelled order");
      }

      const { warehouseId, items } = order;

      // Update inventory for each item - deduct from stock
      for (const item of items) {
        const inventoryId = `${item.productId}_${warehouseId}`;
        const inventoryRef = doc(db, "companies", companyId, "inventory", inventoryId);
        const inventorySnap = await transaction.get(inventoryRef);
        
        if (!inventorySnap.exists()) {
          throw new Error(`Product "${item.productName}" not found in inventory`);
        }

        const inventoryData = inventorySnap.data();
        const currentStock = inventoryData.quantity || 0;
        const reserved = inventoryData.reservedQty || 0;
        const newReserved = Math.max(0, reserved - item.quantity);
        const newStock = currentStock - item.quantity;

        // Update inventory
        transaction.update(inventoryRef, {
          quantity: newStock,
          reservedQty: newReserved,
          availableQty: newStock - newReserved,
          updatedAt: serverTimestamp(),
        });

        // Log stock movement
        const movementRef = doc(collection(db, "companies", companyId, "stockMovements"));
        transaction.set(movementRef, {
          companyId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId,
          warehouseName: order.warehouseName,
          type: "order_completed",
          quantity: -item.quantity,
          balanceBefore: currentStock,
          balanceAfter: newStock,
          reference: order.orderNumber,
          notes: `Order ${order.orderNumber} completed - ${item.quantity} units of ${item.productName}`,
          createdBy: order.createdBy,
          createdAt: serverTimestamp(),
        });

        // Update product total stock
        const productRef = doc(db, "companies", companyId, "products", item.productId);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const productData = productSnap.data();
          const totalQty = (productData.stockQuantity || 0) - item.quantity;
          transaction.update(productRef, {
            stockQuantity: Math.max(0, totalQty),
            status: totalQty <= 0 ? "out_of_stock" : totalQty <= 10 ? "low_stock" : "in_stock",
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Mark order as completed
      transaction.update(orderRef, {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Cancel an order - release reserved stock
   */
  async cancelOrder(companyId: string, orderId: string): Promise<void> {
    const orderRef = doc(db, "companies", companyId, "orders", orderId);

    await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }

      const order = orderSnap.data() as Order;
      if (order.status === 'completed') {
        throw new Error("Cannot cancel a completed order");
      }
      if (order.status === 'cancelled') {
        throw new Error("Order is already cancelled");
      }

      const { warehouseId, items } = order;

      // Release reserved stock for each item
      for (const item of items) {
        const inventoryId = `${item.productId}_${warehouseId}`;
        const inventoryRef = doc(db, "companies", companyId, "inventory", inventoryId);
        const inventorySnap = await transaction.get(inventoryRef);
        
        if (inventorySnap.exists()) {
          const inventoryData = inventorySnap.data();
          const reserved = inventoryData.reservedQty || 0;
          const newReserved = Math.max(0, reserved - item.quantity);
          
          transaction.update(inventoryRef, {
            reservedQty: newReserved,
            availableQty: inventoryData.quantity - newReserved,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Mark order as cancelled
      transaction.update(orderRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Get orders with pagination
   */
  async list(
    companyId: string,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot,
    statusFilter?: string
  ): Promise<PaginatedOrders> {
    const ref = collection(db, "companies", companyId, "orders");
    
    let q = query(
      ref,
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    if (statusFilter && statusFilter !== "all") {
      q = query(q, where("status", "==", statusFilter));
    }

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const countQuery = statusFilter && statusFilter !== "all" 
      ? query(ref, where("status", "==", statusFilter))
      : ref;
    const countSnapshot = await getCountFromServer(countQuery);
    const totalCount = countSnapshot.data().count;

    const snap = await getDocs(q);
    const orders = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Order[];

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      orders,
      totalCount,
      lastVisible: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  },

  /**
   * Get pending orders count
   */
  async getPendingCount(companyId: string, warehouseId?: string): Promise<number> {
    const ref = collection(db, "companies", companyId, "orders");
    let q = query(ref, where("status", "==", "pending"));
    
    if (warehouseId) {
      q = query(q, where("warehouseId", "==", warehouseId));
    }
    
    const snap = await getCountFromServer(q);
    return snap.data().count;
  },

  /**
   * Get orders by warehouse
   */
  async listByWarehouse(
    companyId: string,
    warehouseId: string,
    pageSize: number = 20,
    lastVisible?: QueryDocumentSnapshot
  ): Promise<PaginatedOrders> {
    const ref = collection(db, "companies", companyId, "orders");
    
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
    const orders = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Order[];

    const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    return {
      orders,
      totalCount,
      lastVisible: lastDoc,
      hasMore: snap.docs.length === pageSize,
    };
  },
};