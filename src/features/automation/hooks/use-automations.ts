import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAutomations,
  saveAutomation,
  toggleAutomation,
  removeAutomation,
  triggerAutomation,
  fetchAutomationHistory,
} from "@/lib/assistant.functions";
import type { ListAutomationsOptions } from "../types";

export function useAutomations(options: ListAutomationsOptions = {}) {
  const queryClient = useQueryClient();

  const automationsQuery = useQuery({
    queryKey: ["automations", options],
    queryFn: () => fetchAutomations(options),
  });

  const saveMutation = useMutation({
    mutationFn: saveAutomation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAutomation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeAutomation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const runMutation = useMutation({
    mutationFn: triggerAutomation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations"] });
      void queryClient.invalidateQueries({ queryKey: ["automation_history"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  return {
    automations: automationsQuery.data ?? [],
    isLoading: automationsQuery.isLoading,
    saveAutomation: saveMutation,
    toggleAutomation: toggleMutation,
    deleteAutomation: deleteMutation,
    runAutomation: runMutation,
  };
}

export function useAutomationHistory() {
  return useQuery({
    queryKey: ["automation_history"],
    queryFn: () => fetchAutomationHistory(),
  });
}
