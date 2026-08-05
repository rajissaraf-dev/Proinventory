import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import imageCompression from "browser-image-compression";
import { useAuth } from "../../services/firebase";
import { FaCloudUploadAlt, FaMoneyBill, FaProductHunt, FaSortNumericUp } from "react-icons/fa";
import StockInputField from "../forms/StockInputField";
import { RootState } from "../../app/store";
import { ProductService } from "../../services/product.service";
import { WarehouseService } from "../../services/warehouse.service";
import { uploadImageToCloudinary } from "../../services/cloudinary.service";
import { Warehouse } from "../../types";

interface StockData {
  product_name: string;
  product_Qty: string | number;
  product_Price: string | number;
  size: string;
  product_description: string;
  img?: string;
}

const INPUTS = [
  { id: 1, name: "product_name", type: "text", placeholder: "Product Name", label: "Product Name", icon: <FaProductHunt />, required: true, errMessages: "Product name is required." },
  { id: 2, name: "product_Qty", type: "number", placeholder: "Quantity", label: "Quantity", icon: <FaSortNumericUp />, required: true, errMessages: "Quantity is required." },
  { id: 3, name: "product_Price", type: "number", placeholder: "Price", label: "Price", icon: <FaMoneyBill />, required: true, errMessages: "Price is required." },
  { id: 4, name: "product_description", type: "text", placeholder: "Description", label: "Description", icon: <FaProductHunt />, required: false, errMessages: "" },
];

const EMPTY: StockData = { product_name: "", product_Qty: 0, product_Price: 0, size: "", product_description: "" };

interface AddStockModalProps {
  onClose: () => void;
}

const AddStockModal = ({ onClose }: AddStockModalProps) => {
  const currentUser = useAuth();
  const companyId = useSelector((s: RootState) => s.auth.user?.companyId ?? "");
  const [data, setData] = useState<StockData>(EMPTY);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;
    const loadWarehouses = async () => {
      if (!companyId) {
        console.warn("⚠️ [AddStockModal] No companyId available for loadWarehouses, skipping warehouse load.");
        return;
      }
      setWarehousesLoading(true);
      try {
        const list = await WarehouseService.list(companyId);
        if (cancelled) return;
        const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
        setWarehouses(sorted);
        setWarehouseId((current) => current || sorted[0]?.id || "");
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Failed to load warehouses.");
        }
      } finally {
        if (!cancelled) {
          setWarehousesLoading(false);
        }
      }
    };

    void loadWarehouses();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Only JPG, PNG or WEBP images allowed."); return;
    }

    setError("");
    const compressed = f.size > 1_048_576
      ? await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1024 })
      : f;

    setFile(compressed);
    setProgress(0);

    try {
      const url = await uploadImageToCloudinary(compressed, "products");
      setData((p) => ({ ...p, img: url }));
      setProgress(100);
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.product_name || !data.product_Qty || !data.product_Price || !data.size) {
      setError("Please fill all required fields."); return;
    }
    if (!companyId) {
      setError("Company context is not available yet."); return;
    }
    if (!warehouseId) {
      setError("Please select a warehouse for this item."); return;
    }
    if (file && !data.img) {
      setError("Please wait for the image upload to finish."); return;
    }

    const selectedWarehouse = warehouses.find((item) => item.id === warehouseId);
    if (!selectedWarehouse) {
      setError("Selected warehouse is no longer available. Please choose another warehouse.");
      return;
    }

    try {
      await ProductService.create({
        companyId,
        createdBy: currentUser?.uid ?? "",
        name: data.product_name,
        sku: `SKU-${Date.now().toString(36).toUpperCase()}`,
        categoryId: "legacy",
        categoryName: data.product_description || "Other",
        price: Number(data.product_Price),
        stockQuantity: Number(data.product_Qty),
        imageUrl: data.img ?? "",
        size: data.size,
        warehouseId: selectedWarehouse.id,
        warehouseName: selectedWarehouse.name,
      });
      setData(EMPTY); setFile(null); setProgress(null); setError("");
      setWarehouseId(warehouses[0]?.id ?? "");
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="bg-black/60 z-[1000] w-full h-full fixed top-0 right-0 flex items-start justify-center overflow-y-auto">
      <div
        className="w-full md:w-[480px] rounded-2xl mx-auto mt-16 p-6"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border-brand)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="mb-5 flex justify-between items-center">
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-primary)" }}>
            Add New Inventory Item
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{
              background: "var(--color-surface-3)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-soft)",
            }}
          >
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        {progress !== null && progress < 100 && (
          <div className="h-1 mb-3 bg-green-500 transition-all" style={{ width: `${progress}%` }} />
        )}

        <form className="flex flex-col gap-1" onSubmit={handleSubmit}>
          {INPUTS.map((input) => (
            <StockInputField key={input.id} type={input.type} name={input.name}
              placeholder={input.placeholder} required={input.required}
              value={data[input.name as keyof StockData] as string | number}
              onChange={(e) => setData({ ...data, [e.target.name]: e.target.value })}
              errMessages={input.errMessages}
              style={{
                background: "var(--color-input-bg)",
                border: "1px solid var(--color-input-border)",
                color: "var(--color-input-text)",
                borderRadius: "0.5rem",
                padding: "0.625rem 0.75rem",
              }}
            />
          ))}

          <select value={data.size} required name="size"
            onChange={(e) => setData({ ...data, size: e.target.value })}
            className="w-full text-sm rounded-lg p-2.5 outline-none mb-2"
            style={{
              background: "var(--color-input-bg)",
              border: "1px solid var(--color-input-border)",
              color: "var(--color-input-text)",
            }}>
            <option value="" disabled>Choose packaging size</option>
            {["Pack", "Carton", "Piece", "Sachet", "Bag"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={warehousesLoading || warehouses.length === 0}
            className="w-full text-sm rounded-lg p-2.5 outline-none mb-2"
            style={{
              background: "var(--color-input-bg)",
              border: "1px solid var(--color-input-border)",
              color: "var(--color-input-text)",
            }}
          >
            <option value="" disabled>
              {warehousesLoading ? "Loading warehouses..." : warehouses.length === 0 ? "Create a warehouse first" : "Select warehouse"}
            </option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.code} — {warehouse.name}</option>
            ))}
          </select>
          <label htmlFor="productImg"
            className="flex items-center text-sm font-medium pb-2 cursor-pointer gap-2"
            style={{ color: "var(--color-brand-primary-soft)" }}>
            <FaCloudUploadAlt /> Upload Item Image
            <input accept="image/*" required id="productImg" type="file"
              className="hidden" onChange={handleFileChange} />
          </label>

          <button type="submit" disabled={progress !== null && progress < 100}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: "var(--color-brand-primary)", color: "white" }}>
            Add Item
          </button>
        </form>

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
      </div>
    </div>
  );
};

export default AddStockModal;
