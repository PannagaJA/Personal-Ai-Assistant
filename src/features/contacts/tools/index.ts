import { z } from "zod";
import type { AITool } from "../../ai/tools/registry.js";
import { GoogleContactsService } from "../services.server.js";
import { getPrimaryEmail, getPrimaryName, getPrimaryOrganization, getPrimaryPhone } from "../utils/index.js";
import type { GoogleContact } from "../types.js";

export const contactsSearchTool: AITool = {
  id: "contacts_search",
  name: "search_contacts",
  description: "Search Google Contacts by name, phone, email, organization, job title, city, or notes.",
  parameters: z.object({
    query: z.string().describe("The search term (name, email, phone, company, title, etc.)"),
  }),
  execute: async ({ query }, { supabase, userId }) => {
    try {
      const contacts = await GoogleContactsService.searchContacts(supabase, userId, query);
      const summary = contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
        organization: getPrimaryOrganization(c),
        isFavorite: c.isFavorite,
      }));

      return {
        success: true,
        data: summary,
        message: `Found ${contacts.length} matching contact(s) for query "${query}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsListTool: AITool = {
  id: "contacts_list",
  name: "list_contacts",
  description: "List contacts from Google Contacts directory.",
  parameters: z.object({
    pageSize: z.number().optional().default(20).describe("Number of contacts to retrieve"),
  }),
  execute: async ({ pageSize }, { supabase, userId }) => {
    try {
      const res = await GoogleContactsService.listContacts(supabase, userId, { pageSize });
      const summary = res.contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
        organization: getPrimaryOrganization(c),
      }));

      return {
        success: true,
        data: summary,
        message: `Retrieved ${res.contacts.length} contact(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsEmailTool: AITool = {
  id: "contacts_email",
  name: "get_contact_email",
  description: "Find the email address of a specific person or organization by name.",
  parameters: z.object({
    name: z.string().describe("The name or title of the person or organization"),
  }),
  execute: async ({ name }, { supabase, userId }) => {
    try {
      const matches = await GoogleContactsService.searchContacts(supabase, userId, name);
      if (matches.length === 0) {
        return { success: false, message: `No contact found for "${name}".` };
      }

      const results = matches.map((c) => ({
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        allEmails: c.emails?.map((e) => e.value) || [],
      })).filter((r) => r.email);

      if (results.length === 0) {
        return { success: false, message: `Found contact for "${name}" but no email address is on record.` };
      }

      return {
        success: true,
        data: results,
        message: `Found ${results.length} email match(es).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsPhoneTool: AITool = {
  id: "contacts_phone",
  name: "get_contact_phone",
  description: "Find the phone number of a specific person by name.",
  parameters: z.object({
    name: z.string().describe("The name of the person to lookup phone number for"),
  }),
  execute: async ({ name }, { supabase, userId }) => {
    try {
      const matches = await GoogleContactsService.searchContacts(supabase, userId, name);
      if (matches.length === 0) {
        return { success: false, message: `No contact found for "${name}".` };
      }

      const results = matches
        .map((c) => {
          const primary = getPrimaryPhone(c);
          const phones = c.phones?.map((p) => ({
            type: p.type || "Mobile",
            value: p.value,
          })) || (primary ? [{ type: "Mobile", value: primary }] : []);

          return {
            name: getPrimaryName(c),
            phone: primary,
            phones,
          };
        })
        .filter((r) => r.phone || r.phones.length > 0);

      if (results.length === 0) {
        return { success: false, message: `Found contact for "${name}" but no phone number is on record.` };
      }

      return {
        success: true,
        data: results,
        message: `Found ${results.length} phone match(es).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsOrganizationTool: AITool = {
  id: "contacts_organization",
  name: "get_contacts_by_organization",
  description: "Find contacts belonging to a specific organization or company.",
  parameters: z.object({
    organization: z.string().describe("The name of the company or organization (e.g. Smart Path, College, Google)"),
  }),
  execute: async ({ organization }, { supabase, userId }) => {
    try {
      const matches = await GoogleContactsService.searchContacts(supabase, userId, organization);
      const orgMatches = matches.filter((c) => {
        const org = getPrimaryOrganization(c);
        return org && org.name.toLowerCase().includes(organization.toLowerCase());
      });

      const list = (orgMatches.length > 0 ? orgMatches : matches).map((c) => ({
        name: getPrimaryName(c),
        organization: getPrimaryOrganization(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
      }));

      return {
        success: true,
        data: list,
        message: `Found ${list.length} contact(s) associated with "${organization}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsRecentTool: AITool = {
  id: "contacts_recent",
  name: "get_recent_contacts",
  description: "Get recent contacts or frequently interacted contacts.",
  parameters: z.object({
    limit: z.number().optional().default(10).describe("Maximum number of contacts to retrieve"),
  }),
  execute: async ({ limit }, { supabase, userId }) => {
    try {
      const res = await GoogleContactsService.listContacts(supabase, userId, { pageSize: limit });
      const summary = res.contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        organization: getPrimaryOrganization(c),
        isFrequentlyContacted: c.isFrequentlyContacted,
      }));

      return {
        success: true,
        data: summary,
        message: `Retrieved ${summary.length} recent/frequently contacted person(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsFavoriteTool: AITool = {
  id: "contacts_favorite",
  name: "get_favorite_contacts",
  description: "Get favorite or starred contacts.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const res = await GoogleContactsService.listContacts(supabase, userId, { favoriteOnly: true });
      const summary = res.contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
        organization: getPrimaryOrganization(c),
      }));

      return {
        success: true,
        data: summary,
        message: `Retrieved ${summary.length} favorite contact(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const contactsDetailsTool: AITool = {
  id: "contacts_details",
  name: "get_contact_details",
  description: "Get full profile details of a specific contact by resourceName or exact name.",
  parameters: z.object({
    query: z.string().describe("Resource name (e.g. people/c123456) or person's full name"),
  }),
  execute: async ({ query }, { supabase, userId }) => {
    try {
      let contact = null;
      if (query.startsWith("people/")) {
        contact = await GoogleContactsService.getContact(supabase, userId, query);
      } else {
        const matches = await GoogleContactsService.searchContacts(supabase, userId, query);
        contact = matches[0] || null;
      }

      if (!contact) {
        return { success: false, message: `Contact not found for "${query}".` };
      }

      return {
        success: true,
        data: contact,
        message: `Retrieved details for ${getPrimaryName(contact)}.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
