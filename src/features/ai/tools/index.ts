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
import {
  listUnreadGmailTool,
  searchGmailTool,
  readGmailMessageTool,
  summarizeInboxGmailTool,
  replyGmailTool,
  createDraftGmailTool,
  archiveGmailTool,
  markReadGmailTool,
  markUnreadGmailTool,
  listLabelsGmailTool,
  getThreadGmailTool,
} from "@/features/gmail/tools";
import {
  contactsSearchTool,
  contactsListTool,
  contactsEmailTool,
  contactsPhoneTool,
  contactsOrganizationTool,
  contactsRecentTool,
  contactsFavoriteTool,
  contactsDetailsTool,
} from "@/features/contacts/tools";
import {
  notesCreateTool,
  notesUpdateTool,
  notesDeleteTool,
  notesSearchTool,
  notesPinTool,
  notesArchiveTool,
  notesSummaryTool,
  notesRelatedTool,
  notesTodayTool,
  notesRecentTool,
} from "@/features/notes/tools";
import {
  followupsCreateTool,
  followupsUpdateTool,
  followupsDeleteTool,
  followupsSearchTool,
  followupsTodayTool,
  followupsOverdueTool,
  followupsNextTool,
  followupsCompleteTool,
  followupsTimelineTool,
  followupsHistoryTool,
  followupsRelatedTool,
} from "@/features/followups/tools";
import {
  plannerDailyTool,
  plannerWeeklyTool,
  plannerTodayTool,
  plannerTomorrowTool,
  plannerPrioritiesTool,
  plannerScheduleTool,
  plannerRisksTool,
  plannerWorkloadTool,
  plannerSummaryTool,
  plannerReviewTool,
  plannerNextTaskTool,
  plannerTimeblockTool,
  plannerSuggestTool,
} from "@/features/planner/tools";

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

  // Gmail Tools (11 total - draft ONLY, send requires explicit human button click)
  registry.register(listUnreadGmailTool);
  registry.register(searchGmailTool);
  registry.register(readGmailMessageTool);
  registry.register(summarizeInboxGmailTool);
  registry.register(replyGmailTool);
  registry.register(createDraftGmailTool);
  registry.register(archiveGmailTool);
  registry.register(markReadGmailTool);
  registry.register(markUnreadGmailTool);
  registry.register(listLabelsGmailTool);
  registry.register(getThreadGmailTool);

  // Google Contacts Tools (8 total)
  registry.register(contactsSearchTool);
  registry.register(contactsListTool);
  registry.register(contactsEmailTool);
  registry.register(contactsPhoneTool);
  registry.register(contactsOrganizationTool);
  registry.register(contactsRecentTool);
  registry.register(contactsFavoriteTool);
  registry.register(contactsDetailsTool);

  // Personal Knowledge System / Notes Tools (10 total)
  registry.register(notesCreateTool);
  registry.register(notesUpdateTool);
  registry.register(notesDeleteTool);
  registry.register(notesSearchTool);
  registry.register(notesPinTool);
  registry.register(notesArchiveTool);
  registry.register(notesSummaryTool);
  registry.register(notesRelatedTool);
  registry.register(notesTodayTool);
  registry.register(notesRecentTool);

  // Follow-Up & Relationship Manager Tools (11 total)
  registry.register(followupsCreateTool);
  registry.register(followupsUpdateTool);
  registry.register(followupsDeleteTool);
  registry.register(followupsSearchTool);
  registry.register(followupsTodayTool);
  registry.register(followupsOverdueTool);
  registry.register(followupsNextTool);
  registry.register(followupsCompleteTool);
  registry.register(followupsTimelineTool);
  registry.register(followupsHistoryTool);
  registry.register(followupsRelatedTool);

  // AI Planning & Daily Intelligence Tools (13 total)
  registry.register(plannerDailyTool);
  registry.register(plannerWeeklyTool);
  registry.register(plannerTodayTool);
  registry.register(plannerTomorrowTool);
  registry.register(plannerPrioritiesTool);
  registry.register(plannerScheduleTool);
  registry.register(plannerRisksTool);
  registry.register(plannerWorkloadTool);
  registry.register(plannerSummaryTool);
  registry.register(plannerReviewTool);
  registry.register(plannerNextTaskTool);
  registry.register(plannerTimeblockTool);
  registry.register(plannerSuggestTool);
}
