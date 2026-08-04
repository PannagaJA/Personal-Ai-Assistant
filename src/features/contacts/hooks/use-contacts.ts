import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchContacts,
  searchContacts,
  getContactDetails,
  toggleFavoriteContact,
} from "@/lib/assistant.functions";

export function useContacts(options: { pageSize?: number; query?: string; favoriteOnly?: boolean } = {}) {
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ["contacts", options],
    queryFn: () => {
      if (options.query && options.query.trim()) {
        return searchContacts(options.query);
      }
      const fetchOpts: any = {};
      if (options.pageSize !== undefined) fetchOpts.pageSize = options.pageSize;
      if (options.favoriteOnly !== undefined) fetchOpts.favoriteOnly = options.favoriteOnly;
      return fetchContacts(fetchOpts);
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: (input: { resourceName: string; isFavorite: boolean }) =>
      toggleFavoriteContact(input.resourceName, input.isFavorite),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  return {
    contacts: contactsQuery.data ?? [],
    isLoading: contactsQuery.isLoading,
    error: contactsQuery.error,
    refetch: contactsQuery.refetch,
    toggleFavorite,
  };
}

export function useContactDetails(resourceName: string | null) {
  return useQuery({
    queryKey: ["contact", resourceName],
    queryFn: () => (resourceName ? getContactDetails(resourceName) : null),
    enabled: Boolean(resourceName),
  });
}
