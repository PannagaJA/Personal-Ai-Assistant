import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markNotificationRead,
  clearReadNotifications,
  createNotification,
  registerDeviceToken,
} from "@/lib/assistant.functions";
import type { ListNotificationsOptions } from "../types";

export function useNotifications(options: ListNotificationsOptions = {}) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", options],
    queryFn: () => fetchNotifications(options),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const clearReadMutation = useMutation({
    mutationFn: clearReadNotifications,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: createNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const registerTokenMutation = useMutation({
    mutationFn: registerDeviceToken,
  });

  return {
    notifications: notificationsQuery.data ?? [],
    isLoading: notificationsQuery.isLoading,
    markAsRead: markReadMutation,
    clearRead: clearReadMutation,
    createNotification: createMutation,
    registerToken: registerTokenMutation,
  };
}
