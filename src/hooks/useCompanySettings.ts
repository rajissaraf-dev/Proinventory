import { useEffect, useState } from "react";
import { CompanySettings, CompanySettingsService } from "../services/company-settings.service";

const DEFAULT_SETTINGS: CompanySettings = {
  currency: "USD",
  currencySymbol: "$",
  lowStockThreshold: 10,
  logoUrl: "",
  companyName: "",
};

const useCompanySettings = (companyId?: string) => {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const unsubscribe = CompanySettingsService.watchSettings(companyId, (nextSettings) => {
      if (!isMounted) return;
      setSettings(nextSettings);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [companyId]);

  return { settings, loading };
};

export default useCompanySettings;
