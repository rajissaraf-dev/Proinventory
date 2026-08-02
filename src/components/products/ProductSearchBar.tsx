// src/components/products/ProductSearchBar.tsx
import { useState, useEffect } from "react";
import { MdSearch, MdClose } from "react-icons/md";
import useDebounce from "../../hooks/useDebounce";

interface ProductSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const ProductSearchBar = ({
  onSearch,
  placeholder = "Search products by name, SKU, or category...",
  className = "",
}: ProductSearchBarProps) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  return (
    <div className={`relative flex-1 min-w-50 ${className}`}>
      <div className="relative">
        <MdSearch
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-input-icon)" }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-4 py-2.5 pl-10 pr-10 text-sm outline-none transition-all"
          style={{
            background: "var(--color-input-bg)",
            border: "1px solid var(--color-input-border)",
            color: "var(--color-input-text)",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)";
          }}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
            style={{ color: "var(--color-input-icon)" }}
            aria-label="Clear search"
          >
            <MdClose size={16} />
          </button>
        )}
      </div>
      {query && (
        <div className="absolute -bottom-6 left-0 text-[10px]" style={{ color: "var(--color-text-faint)" }}>
          Showing results for: "{query}"
        </div>
      )}
    </div>
  );
};

export default ProductSearchBar;