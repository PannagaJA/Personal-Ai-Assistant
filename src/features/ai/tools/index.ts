import { registry } from "./registry";
import { listTasksTool, createTaskTool, completeTaskTool, dailyOverviewTool } from "@/features/tasks/tools";
import { rememberTool, searchMemoryTool } from "@/features/memory/tools";
import {
  listTodayEventsTool,
  listTomorrowEventsTool,
  listWeekEventsTool,
  searchCalendarEventsTool,
  createCalendarEventTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  findFreeTimeTool,
  detectConflictsTool,
  getNextEventTool,
} from "@/features/calendar/tools";

export function initializeToolRegistry() {
  // Tasks Tools
  registry.register(listTasksTool);
  registry.register(createTaskTool);
  registry.register(completeTaskTool);
  registry.register(dailyOverviewTool);

  // Memory Tools
  registry.register(rememberTool);
  registry.register(searchMemoryTool);

  // Calendar Tools (10 total)
  registry.register(listTodayEventsTool);
  registry.register(listTomorrowEventsTool);
  registry.register(listWeekEventsTool);
  registry.register(searchCalendarEventsTool);
  registry.register(createCalendarEventTool);
  registry.register(updateCalendarEventTool);
  registry.register(deleteCalendarEventTool);
  registry.register(findFreeTimeTool);
  registry.register(detectConflictsTool);
  registry.register(getNextEventTool);
}
