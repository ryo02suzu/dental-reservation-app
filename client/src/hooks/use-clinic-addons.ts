import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function useClinicAddons() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<{ addonKeys: string[] }>({
    queryKey: ["/api/my-addons"],
    enabled: !!user && !user.isSuperAdmin,
    staleTime: 0,
    retry: 2,
  });

  if (error) {
    console.error("[useClinicAddons] failed to fetch addons:", error);
  }

  const addonKeys = new Set(data?.addonKeys ?? []);

  return {
    addonKeys,
    isLoading,
    hasAddon: (key: string) => addonKeys.has(key),
  };
}
