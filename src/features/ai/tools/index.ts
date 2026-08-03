import { registry } from "./registry";
import { listTasksTool, createTaskTool, completeTaskTool, dailyOverviewTool } from "@/features/tasks/tools";
import { rememberTool, searchMemoryTool } from "@/features/memory/tools";
import {
  listCalendarEventsTool,
  createCalendarEventTool,
  updateCalendarEventTool,
  deleteCalendarEventTool,
  findFreeTimeTool,
  detectConflictsTool,
} from "@/features/calendar/tools";

export function initializeToolRegistry() {
  registry.register(listTasksTool);
  registry.register(createTaskTool);
  registry.register(completeTaskTool);
  registry.register(dailyOverviewTool);
  registry.register(rememberTool);
  registry.register(searchMemoryTool);
  registry.register(listCalendarEventsTool);
  registry.register(createCalendarEventTool);
  registry.register(updateCalendarEventTool);
  registry.register(deleteCalendarEventTool);
  registry.register(findFreeTimeTool);
  registry.register(detectConflictsTool);
}
