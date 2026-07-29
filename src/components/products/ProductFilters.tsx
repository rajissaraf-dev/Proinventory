// src/components/products/ProductFilters.tsx
import { Category } from "../../types";

interface ProductFiltersProps {
  categories: Category[];
  selectedCategory: string;
  selectedStatus: string;
  onCategoryChange: (categoryId: string) => void;
  onStatusChange: (status: string) => void;
}

const ProductFilters = ({
  categories,
  selectedCategory,
  selectedStatus,
  onCategoryChange,
  onStatusChange,
}: ProductFiltersProps) => {
  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "in_stock", label: "In Stock" },
    { value: "low_stock", label: "Low Stock" },
    { value: "out_of_stock", label: "Out of Stock" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category Filter */}
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="rounded-xl px-3 py-2 text-xs outline-none min-w-[140px]"
        style={{
          background: "var(--color-input-bg)",
          border: "1px solid var(--color-input-border)",
          color: "var(--color-input-text)",
        }}
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-xl px-3 py-2 text-xs outline-none min-w-[130px]"
        style={{
          background: "var(--color-input-bg)",
          border: "1px solid var(--color-input-border)",
          color: "var(--color-input-text)",
        }}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ProductFilters;