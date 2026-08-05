// src/App.tsx

import { useEffect, useRef } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import db, { useAuth } from "./services/firebase";
import { PlatformAdminService } from "./services/platform-admin.service";
import { setStockData } from "./features/stock/stockSlice";
import { setBusinessData } from "./features/business/businessSlice";
import { setCompany } from "./features/company/companySlice";
import { setCurrentUser, fetchUserProfile } from "./features/auth/authSlice";
import useAppDispatch from "./hooks/useAppDispatch";
import useAppSelector from "./hooks/useAppSelector";
import AppRouter from "./app/router";
import { Company, BusinessProfile } from "./types";
import { productListener } from "./services/product-listener.service";

// ── Helper: Convert Firestore Timestamp to Date or keep as string ──────────
const toDate = (value: unknown): Date | string => {
  if (!value) return new Date();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === "string") return value;
  return new Date();
};

const logRootCollections = async (): Promise<void> => {
  try {
    const [users, companies] = await Promise.all([
      PlatformAdminService.listAllUsers(),
      PlatformAdminService.listAllCompanies(),
    ]);
    console.groupCollapsed(`📦 [App] "users" — ${users.length} document(s)`);
    users.forEach((u, i) => console.log(`  [${i}]`, u));
    console.groupEnd();

    console.groupCollapsed(`📦 [App] "companies" — ${companies.length} document(s)`);
    companies.forEach((c, i) => console.log(`  [${i}]`, c));
    console.groupEnd();
  } catch (err) {
    console.warn("⚠️ [App] Could not log root collections:", err);
  }
};

const App = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const firebaseUser = useAuth();
  const reduxUser = useAppSelector((s) => s.auth.user);
  const companyId = reduxUser?.companyId;
  const listenersAttached = useRef(false);

  // ── Step 1: Auth resolved → sync Redux + fetch Firestore profile ──────────
  useEffect(() => {
    if (firebaseUser === undefined) return;

    if (!firebaseUser) {
      console.log("🔓 [App] No authenticated user.");
      return;
    }

    console.log("🔑 [App] Firebase Auth user:", {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
    });

    dispatch(setCurrentUser({ uid: firebaseUser.uid, email: firebaseUser.email ?? "" }));
    dispatch(fetchUserProfile(firebaseUser.uid));
    console.log("🔄 [App] Fetching user profile for uid:", firebaseUser.uid);
  }, [firebaseUser?.uid, dispatch]);

  // ── Step 1b: Keep the logged in user's Firestore profile in sync ───────────
  useEffect(() => {
    if (!firebaseUser?.uid) return;

    const userRef = doc(db, "users", firebaseUser.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        console.log("🔁 [App] User profile updated in Firestore, reloading profile.");
        dispatch(fetchUserProfile(firebaseUser.uid));
      },
      (err) => console.error("❌ [App] user profile listener:", err)
    );

    return unsubscribe;
  }, [firebaseUser?.uid, dispatch]);

  // ── Step 2: companyId resolved → attach real-time Firestore listeners ─────
  useEffect(() => {
    if (!companyId) {
      if (listenersAttached.current) {
        productListener.unsubscribeAll();
        listenersAttached.current = false;
      }
      return;
    }

    if (listenersAttached.current) {
      console.log("📡 [App] Listeners already attached for companyId:", companyId);
      return;
    }

    console.log("🏢 [App] companyId resolved:", companyId);
    console.log("📡 [App] Attaching listeners for company:", companyId);

    const unsubs: (() => void)[] = [];

    // ── Listener A: companies/{companyId} ─────────────────────────────────
    unsubs.push(
      onSnapshot(
        doc(db, "companies", companyId),
        (snap) => {
          if (!snap.exists()) {
            console.warn(`⚠️ [App] companies/${companyId} does not exist.`);
            return;
          }

          const raw = snap.data() as Record<string, unknown>;
          
          // ─── Build company ───
          const company: Company = {
            id: snap.id,
            name: (raw.name as string) ?? "",
            slug: (raw.slug as string) ?? "",
            email: (raw.email as string) ?? "",
            phone: raw.phone as string | undefined,
            industry: raw.industry as string | undefined,
            plan: (raw.plan as Company["plan"]) ?? "starter",
            status: (raw.status as Company["status"]) ?? "trial",
            trialEndsAt: (raw.trialEndsAt as string) ?? new Date().toISOString(),
            subscriptionStatus: (raw.subscriptionStatus as Company["subscriptionStatus"]) ?? "trialing",
            ownerId: (raw.ownerId as string) ?? "",
            createdAt: toDate(raw.createdAt) as Date,
            updatedAt: toDate(raw.updatedAt) as Date,
          };

          console.group(`✅ [App] companies/${companyId}`);
          console.log(company);
          console.groupEnd();

          // ─── Dispatch Company to Redux ───
          dispatch(setCompany(company));

          // ─── Build BusinessProfile (separate from Company) ───
          const businessProfile: BusinessProfile = {
            id: companyId,
            name: company.name,
            businessName: company.name,
            businessAddress: (raw.address as string) || "",
            logo: (raw.logo as string) || "",
            email: company.email,
            phone: company.phone,
          };
          
          // ─── Dispatch BusinessProfile as an array ───
          dispatch(setBusinessData([businessProfile]));
        },
        (err) => console.error("❌ [App] company listener:", err)
      )
    );

    // ─── Listener B: companies/{companyId}/products (via service) ────────
    try {
      const unsubscribeProducts = productListener.subscribeToProducts(
        companyId,
        (products) => {
          console.group(`✅ [App] products updated — ${products.length} item(s)`);
          products.forEach((p, i) => console.log(`  [${i}]`, p));
          console.groupEnd();
          dispatch(setStockData(products));
        }
      );
      unsubs.push(unsubscribeProducts);
      console.log("📡 [App] Product listener attached");
    } catch (error) {
      console.error("❌ [App] Failed to attach product listener:", error);
    }

    listenersAttached.current = true;

    return () => {
      console.log("🧹 [App] Unsubscribing listeners for companyId:", companyId);
      unsubs.forEach((fn) => fn());
      productListener.unsubscribeAll();
      listenersAttached.current = false;
    };
  }, [companyId, dispatch]);

  // ── Cleanup all listeners on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      productListener.unsubscribeAll();
      listenersAttached.current = false;
    };
  }, []);

  // ── Log root collections for debugging (Vite uses import.meta.env) ──────
  useEffect(() => {
    if (import.meta.env.MODE === "development") {
      logRootCollections();
    }
  }, []);

  return <AppRouter />;
};

export default App;