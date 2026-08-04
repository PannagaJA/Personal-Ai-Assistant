import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFollowUps,
  saveFollowUp,
  markFollowUpComplete,
  removeFollowUp,
  fetchRelationshipTimeline,
} from "@/lib/assistant.functions";
import type { ListFollowUpsOptions } from "../types";

export function useFollowUps(options: ListFollowUpsOptions = {}) {
  const queryClient = useQueryClient();

  const followupsQuery = useQuery({
    queryKey: ["followups", options],
    queryFn: () => fetchFollowUps(options),
  });

  const upsertMutation = useMutation({
    mutationFn: saveFollowUp,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followups"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: markFollowUpComplete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followups"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeFollowUp,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["followups"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  return {
    followups: followupsQuery.data ?? [],
    isLoading: followupsQuery.isLoading,
    error: followupsQuery.error,
    refetch: followupsQuery.refetch,
    saveFollowUp: upsertMutation,
    completeFollowUp: completeMutation,
    deleteFollowUp: deleteMutation,
  };
}

export function useRelationshipTimeline(personOrOrg: string | null) {
  return useQuery({
    queryKey: ["relationship_timeline", personOrOrg],
    queryFn: () => (personOrOrg ? fetchRelationshipTimeline(personOrOrg) : null),
    enabled: Boolean(personOrOrg),
  });
}
