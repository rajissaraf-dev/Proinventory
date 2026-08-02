// src/components/dashboard/CompanySettingsModal.tsx
import React, { useState, useEffect } from "react";
import { MdClose, MdCloudUpload, MdSave } from "react-icons/md";
import { CompanyUserService } from "../../services/company-user.service";
import { uploadImageToCloudinary } from "../../services/cloudinary.service"; // Import your existing service
import { CompanyUser, UserRole } from "../../types";
import { CompanySettingsService } from "../../services/company-settings.service";

interface Props {
  companyId: string;
  staffList: CompanyUser[];
  onClose: () => void;
  onStaffUpdated: () => void;
  onSettingsUpdated?: () => void;
}

const STAFF_ROLES: UserRole[] = ["staff", "company_admin"];

export const CompanySettingsModal: React.FC<Props> = ({
  companyId,
  staffList,
  onClose,
  onStaffUpdated,
  onSettingsUpdated,
}) => {
  const [currency, setCurrency] = useState("USD");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [logoUrl, setLogoUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    CompanySettingsService.getSettings(companyId).then((data) => {
      setCurrency(data.currency);
      setCurrencySymbol(data.currencySymbol || data.currency || "$" );
      setLowStockThreshold(data.lowStockThreshold);
      setLogoUrl(data.logoUrl || "");
      setCompanyName(data.companyName || "");
    });
  }, [companyId]);

  // Updated to use your existing upload function
  // 1. Handle Logo Upload via Cloudinary
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage(null);

    try {
      const uploadedUrl = await uploadImageToCloudinary(file, "company_logos");
      setLogoUrl(uploadedUrl);
      setMessage({ text: "Logo uploaded successfully!", type: "success" });
    } catch {
      setMessage({ text: "Failed to upload logo", type: "error" });
    } finally {
      setUploadingLogo(false);
    }
  };

  // 2. Handle Staff Role Change
  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await CompanyUserService.updateRole(companyId, uid, newRole);
      onStaffUpdated();
      setMessage({ text: "Staff role updated.", type: "success" });
    } catch {
      setMessage({ text: "Failed to update role.", type: "error" });
    }
  };

  // 3. Save General Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await CompanySettingsService.updateSettings(companyId, {
        currency,
        currencySymbol,
        lowStockThreshold,
        logoUrl,
        companyName,
      });
      setMessage({ text: "Settings saved successfully!", type: "success" });
      if (onSettingsUpdated) onSettingsUpdated();
    } catch {
      setMessage({ text: "Failed to save settings.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-2xl rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border-brand)",
          color: "var(--color-text-primary)",
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b border-(--color-border-subtle)">
          <h2 className="text-lg font-semibold">Company Settings</h2>
          <button onClick={onClose} className="p-1 hover:opacity-75">
            <MdClose size={20} />
          </button>
        </div>

        {message && (
          <div
            className={`my-3 p-3 rounded-lg text-xs ${
              message.type === "success"
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6 mt-4">
          {/* Logo Section */}
          <div>
            <label className="block text-xs font-medium mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  className="w-16 h-16 rounded-xl object-cover border border-(--color-border-soft)"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-(--color-border-soft) flex items-center justify-center text-xs text-(--color-text-muted)">
                  No Logo
                </div>
              )}
              <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-(--color-surface-3) hover:opacity-80">
                <MdCloudUpload size={16} />
                {uploadingLogo ? "Uploading..." : "Upload Logo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Supplies"
              className="w-full p-2.5 rounded-xl text-xs bg-(--color-input-bg) border border-(--color-input-border) text-(--color-input-text)"
            />
          </div>

          {/* Currency & Threshold Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Currency Code</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="e.g. USD, NGN, EUR"
                className="w-full p-2.5 rounded-xl text-xs bg-(--color-input-bg) border border-(--color-input-border) text-(--color-input-text)"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Currency Symbol</label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="e.g. $, ₦, €"
                className="w-full p-2.5 rounded-xl text-xs bg-(--color-input-bg) border border-(--color-input-border) text-(--color-input-text)"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Low Stock Alert Threshold</label>
              <input
                type="number"
                min={1}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl text-xs bg-(--color-input-bg) border border-(--color-input-border) text-(--color-input-text)"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploadingLogo}
            className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-brand-primary text-white disabled:opacity-50"
          >
            <MdSave size={16} />
            {loading ? "Saving Settings..." : "Save Company Settings"}
          </button>
        </form>

        {/* Staff Role Management */}
        <div className="mt-8 pt-4 border-t border-(--color-border-subtle)">
          <h3 className="text-sm font-semibold mb-3">Staff Role Management</h3>
          <div className="space-y-2">
            {staffList.length === 0 ? (
              <p className="text-xs text-(--color-text-muted)">No staff members found.</p>
            ) : (
              staffList.map((member) => (
                <div
                  key={member.uid}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-1 border border-(--color-border-soft)"
                >
                  <div>
                    <p className="text-xs font-semibold">{member.displayName || member.email}</p>
                    <p className="text-[10px] text-(--color-text-muted)">{member.email}</p>
                  </div>
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.uid, e.target.value as UserRole)}
                    className="p-1.5 rounded-lg text-xs bg-(--color-surface-3) border border-(--color-border-soft) text-(--color-text-secondary)"
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};