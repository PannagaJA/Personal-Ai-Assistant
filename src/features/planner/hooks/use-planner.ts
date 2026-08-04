import { useQuery } from "@tanstack/react-query";
import {
  fetchMorningBrief,
  fetchEveningReview,
  fetchDailyTimeline,
} from "@/lib/assistant.functions";

export function useMorningBrief(dateStr?: string) {
  return useQuery({
    queryKey: ["morning_brief", dateStr],
    queryFn: () => fetchMorningBrief(dateStr),
  });
}

export function useEveningReview(dateStr?: string) {
  return useQuery({
    queryKey: ["evening_review", dateStr],
    queryFn: () => fetchEveningReview(dateStr),
  });
}

export function useDailyTimeline() {
  return useQuery({
    queryKey: ["daily_timeline"],
    queryFn: () => fetchDailyTimeline(),
  });
}
