import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleAuthService } from "@/services/google-auth.server";
import { logger } from "@/services/logger";
import type { GoogleContact, ListContactsOptions } from "./types";
import { getPrimaryEmail, getPrimaryName, getPrimaryOrganization, getPrimaryPhone } from "./utils";

const PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,photos,biographies,userDefined,memberships";

export class GoogleContactsService {
  private static async fetchPeopleApi(
    supabase: SupabaseClient,
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ) {
    const startTime = Date.now();
    const accessToken = await GoogleAuthService.getValidAccessToken(supabase, userId);
    if (!accessToken) {
      logger.error("system", "Google People API access token missing", {}, userId);
      throw new Error("Google access token missing or expired. Please re-authenticate.");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");

    try {
      const url = endpoint.startsWith("http") ? endpoint : `https://people.googleapis.com/v1${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "provider",
          `People API error ${response.status}: ${errorText}`,
          { endpoint, status: response.status, durationMs },
          userId,
        );
        throw new Error(`Google People API Error (${response.status}): ${errorText}`);
      }

      logger.info(
        "provider",
        `People API call success: ${endpoint}`,
        { durationMs, status: response.status },
        userId,
      );

      return await response.json();
    } catch (err: any) {
      logger.error(
        "provider",
        `People API network failure: ${err.message}`,
        { endpoint, error: String(err) },
        userId,
      );
      throw err;
    }
  }

  /**
   * Fetch contacts from Google People API with optional DB metadata merge
   */
  public static async listContacts(
    supabase: SupabaseClient,
    userId: string,
    options: ListContactsOptions = {},
  ): Promise<{ contacts: GoogleContact[]; nextPageToken?: string }> {
    const params = new URLSearchParams();
    params.set("personFields", PERSON_FIELDS);
    params.set("pageSize", String(options.pageSize || 100));
    if (options.pageToken) params.set("pageToken", options.pageToken);
    params.set("sortOrder", "FIRST_NAME_ASCENDING");

    const data = await this.fetchPeopleApi(supabase, userId, `/people/me/connections?${params.toString()}`);
    const connections: any[] = data.connections || [];

    // Map People API response to canonical GoogleContact
    const contacts: GoogleContact[] = connections.map(this.mapPeoplePersonToContact);

    // Fetch DB local metadata cache
    const { data: dbMeta } = await (supabase.from as any)("contact_metadata")
      .select("*")
      .eq("user_id", userId);

    const metaMap = new Map<string, any>();
    if (dbMeta) {
      dbMeta.forEach((m: any) => metaMap.set(m.resource_name, m));
    }

    const mergedContacts = contacts.map((c) => {
      const meta = metaMap.get(c.resourceName);
      return {
        ...c,
        isFavorite: meta ? meta.is_favorite : false,
        isFrequentlyContacted: meta ? meta.frequently_contacted : false,
        aiTags: meta ? meta.ai_tags || [] : [],
        relationshipMetadata: meta ? meta.relationship_metadata || {} : {},
        lastSyncedAt: meta ? meta.last_synced_at : undefined,
      };
    });

    let filtered = mergedContacts;
    if (options.favoriteOnly) {
      filtered = filtered.filter((c) => c.isFavorite);
    }
    if (options.organizationOnly) {
      filtered = filtered.filter((c) => c.organizations && c.organizations.length > 0 && c.organizations[0]?.name);
    }

    return {
      contacts: filtered,
      nextPageToken: data.nextPageToken,
    };
  }

  /**
   * Search contacts across name, email, phone, organization, notes
   */
  public static async searchContacts(
    supabase: SupabaseClient,
    userId: string,
    query: string,
  ): Promise<GoogleContact[]> {
    if (!query || !query.trim()) {
      const res = await this.listContacts(supabase, userId, { pageSize: 50 });
      return res.contacts;
    }

    const q = query.trim().toLowerCase();

    // 1. Try Directory search API
    try {
      const params = new URLSearchParams();
      params.set("query", query);
      params.set("readMask", PERSON_FIELDS);
      params.set("pageSize", "30");

      const data = await this.fetchPeopleApi(supabase, userId, `/people:searchContacts?${params.toString()}`);
      const results: any[] = data.results || [];
      if (results.length > 0) {
        const contacts = results.map((r: any) => this.mapPeoplePersonToContact(r.person));
        return this.mergeWithDbMetadata(supabase, userId, contacts);
      }
    } catch (e) {
      // Fallback to client/memory side full scan list filtering
    }

    // 2. Full scan list search fallback
    const res = await this.listContacts(supabase, userId, { pageSize: 200 });
    return res.contacts.filter((c) => {
      const name = getPrimaryName(c).toLowerCase();
      const email = (getPrimaryEmail(c) || "").toLowerCase();
      const phone = (getPrimaryPhone(c) || "").toLowerCase();
      const org = getPrimaryOrganization(c);
      const company = (org?.name || "").toLowerCase();
      const title = (org?.title || "").toLowerCase();
      const notes = (c.biographies || []).map((b) => b.value.toLowerCase()).join(" ");

      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        company.includes(q) ||
        title.includes(q) ||
        notes.includes(q)
      );
    });
  }

  /**
   * Get specific contact by resourceName (e.g. people/c1234567)
   */
  public static async getContact(
    supabase: SupabaseClient,
    userId: string,
    resourceName: string,
  ): Promise<GoogleContact | null> {
    const formattedName = resourceName.startsWith("people/") ? resourceName : `people/${resourceName}`;
    const params = new URLSearchParams();
    params.set("personFields", PERSON_FIELDS);

    const person = await this.fetchPeopleApi(supabase, userId, `/${formattedName}?${params.toString()}`);
    if (!person) return null;

    const contact = this.mapPeoplePersonToContact(person);
    const [merged] = await this.mergeWithDbMetadata(supabase, userId, [contact]);
    return merged || null;
  }

  /**
   * Toggle favorite or metadata for a contact
   */
  public static async updateContactMetadata(
    supabase: SupabaseClient,
    userId: string,
    resourceName: string,
    updates: {
      isFavorite?: boolean;
      frequentlyContacted?: boolean;
      aiTags?: string[];
      relationshipMetadata?: Record<string, any>;
    },
  ) {
    const formattedName = resourceName.startsWith("people/") ? resourceName : `people/${resourceName}`;
    const payload: any = {
      user_id: userId,
      resource_name: formattedName,
      last_synced_at: new Date().toISOString(),
    };

    if (updates.isFavorite !== undefined) payload.is_favorite = updates.isFavorite;
    if (updates.frequentlyContacted !== undefined) payload.frequently_contacted = updates.frequentlyContacted;
    if (updates.aiTags !== undefined) payload.ai_tags = updates.aiTags;
    if (updates.relationshipMetadata !== undefined) payload.relationship_metadata = updates.relationshipMetadata;

    const { error } = await (supabase.from as any)("contact_metadata").upsert(payload, {
      onConflict: "user_id,resource_name",
    });

    if (error) {
      logger.error("database", "Failed to update contact_metadata", { error: error.message }, userId);
      throw new Error(`Failed to save contact metadata: ${error.message}`);
    }

    return { ok: true };
  }

  private static async mergeWithDbMetadata(
    supabase: SupabaseClient,
    userId: string,
    contacts: GoogleContact[],
  ): Promise<GoogleContact[]> {
    if (contacts.length === 0) return contacts;

    const { data: dbMeta } = await (supabase.from as any)("contact_metadata")
      .select("*")
      .eq("user_id", userId);

    const metaMap = new Map<string, any>();
    if (dbMeta) {
      dbMeta.forEach((m: any) => metaMap.set(m.resource_name, m));
    }

    return contacts.map((c) => {
      const meta = metaMap.get(c.resourceName);
      return {
        ...c,
        isFavorite: meta ? meta.is_favorite : false,
        isFrequentlyContacted: meta ? meta.frequently_contacted : false,
        aiTags: meta ? meta.ai_tags || [] : [],
        relationshipMetadata: meta ? meta.relationship_metadata || {} : {},
        lastSyncedAt: meta ? meta.last_synced_at : undefined,
      };
    });
  }

  private static mapPeoplePersonToContact(person: any): GoogleContact {
    return {
      resourceName: person.resourceName,
      etag: person.etag,
      names: (person.names || []).map((n: any) => ({
        displayName: n.displayName,
        givenName: n.givenName,
        familyName: n.familyName,
        middleName: n.middleName,
      })),
      emails: (person.emailAddresses || []).map((e: any) => ({
        value: e.value,
        type: e.type,
        primary: e.metadata?.primary,
      })),
      phones: (person.phoneNumbers || []).map((p: any) => ({
        value: p.value,
        type: p.type,
        primary: p.metadata?.primary,
      })),
      organizations: (person.organizations || []).map((o: any) => ({
        name: o.name,
        title: o.title,
        department: o.department,
        type: o.type,
        primary: o.metadata?.primary,
      })),
      addresses: (person.addresses || []).map((a: any) => ({
        formattedValue: a.formattedValue,
        streetAddress: a.streetAddress,
        city: a.city,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
        type: a.type,
      })),
      birthdays: (person.birthdays || []).map((b: any) => ({
        date: b.date,
        text: b.text,
      })),
      photos: (person.photos || []).map((p: any) => ({
        url: p.url,
        primary: p.metadata?.primary,
      })),
      biographies: (person.biographies || []).map((b: any) => ({
        value: b.value,
      })),
    };
  }
}
