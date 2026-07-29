// scripts/add-permissions.mjs
import { getFirestore, doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { app } from '../src/services/firebase.js';

const db = getFirestore(app);

// ✅ Complete permissions for each role (matching your rules)
const PERMISSIONS_BY_ROLE = {
  company_owner: {
    dashboard: { read: true },
    products: { read: true, write: true, delete: true },
    categories: { read: true, write: true, delete: true },
    orders: { read: true, write: true, delete: true },
    purchaseOrders: { read: true, write: true, delete: true },
    stock: { read: true, write: true, delete: true, adjust: true },
    suppliers: { read: true, write: true, delete: true },
    customers: { read: true, write: true, delete: true },
    reports: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: true },
    users: { read: true, write: true, delete: true },
    sales: { read: true, write: true, delete: true },
    notifications: { read: true, write: true, delete: true },
    warehouses: { read: true, write: true, delete: true },
    transfers: { read: true, write: true, delete: true },
  },
  company_admin: {
    dashboard: { read: true },
    products: { read: true, write: true, delete: false },
    categories: { read: true, write: true, delete: false },
    orders: { read: true, write: true, delete: false },
    purchaseOrders: { read: true, write: true, delete: false },
    stock: { read: true, write: true, delete: false, adjust: true },
    suppliers: { read: true, write: true, delete: false },
    customers: { read: true, write: true, delete: false },
    reports: { read: true, write: true, delete: false },
    settings: { read: true, write: true, delete: false },
    users: { read: true, write: true, delete: false },
    sales: { read: true, write: true, delete: false },
    notifications: { read: true, write: true, delete: false },
    warehouses: { read: true, write: true, delete: false },
    transfers: { read: true, write: true, delete: false },
  },
  staff: {
    dashboard: { read: true },
    products: { read: true, write: true, delete: false },
    categories: { read: true, write: false, delete: false },
    orders: { read: true, write: true, delete: false },
    purchaseOrders: { read: false, write: false, delete: false },
    stock: { read: true, write: true, delete: false, adjust: false },
    suppliers: { read: true, write: false, delete: false },
    customers: { read: true, write: false, delete: false },
    reports: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    users: { read: false, write: false, delete: false },
    sales: { read: true, write: true, delete: false },
    notifications: { read: true, write: false, delete: false },
    warehouses: { read: true, write: false, delete: false },
    transfers: { read: true, write: true, delete: false },
  },
  guest: {
    dashboard: { read: true },
    products: { read: true, write: false, delete: false },
    categories: { read: true, write: false, delete: false },
    orders: { read: false, write: false, delete: false },
    purchaseOrders: { read: false, write: false, delete: false },
    stock: { read: true, write: false, delete: false, adjust: false },
    suppliers: { read: true, write: false, delete: false },
    customers: { read: true, write: false, delete: false },
    reports: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    users: { read: false, write: false, delete: false },
    sales: { read: false, write: false, delete: false },
    notifications: { read: true, write: false, delete: false },
    warehouses: { read: true, write: false, delete: false },
    transfers: { read: false, write: false, delete: false },
  },
  super_admin: {
    dashboard: { read: true },
    products: { read: true, write: true, delete: true },
    categories: { read: true, write: true, delete: true },
    orders: { read: true, write: true, delete: true },
    purchaseOrders: { read: true, write: true, delete: true },
    stock: { read: true, write: true, delete: true, adjust: true },
    suppliers: { read: true, write: true, delete: true },
    customers: { read: true, write: true, delete: true },
    reports: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: true },
    users: { read: true, write: true, delete: true },
    sales: { read: true, write: true, delete: true },
    notifications: { read: true, write: true, delete: true },
    warehouses: { read: true, write: true, delete: true },
    transfers: { read: true, write: true, delete: true },
  },
};

async function addPermissionsToUsers() {
  console.log('🔍 Checking users for missing permissions...');
  
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`📊 Found ${usersSnap.size} users`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const docSnapshot of usersSnap.docs) {
    const data = docSnapshot.data();
    const email = data.email || docSnapshot.id;
    const role = data.role || 'company_owner';
    
    // Check if permissions exist
    if (!data.permissions) {
      console.log(`🔄 Adding permissions for ${email} (${role})`);
      
      const permissions = PERMISSIONS_BY_ROLE[role];
      if (!permissions) {
        console.warn(`⚠️ Unknown role "${role}" for ${email}, using company_owner`);
      }
      
      await updateDoc(doc(db, 'users', docSnapshot.id), {
        permissions: permissions || PERMISSIONS_BY_ROLE.company_owner,
        updatedAt: new Date().toISOString(),
      });
      
      updated++;
    } else {
      console.log(`✅ ${email} already has permissions`);
      skipped++;
    }
  }
  
  console.log(`\n✅ Complete! Updated: ${updated}, Skipped: ${skipped}`);
}

addPermissionsToUsers();