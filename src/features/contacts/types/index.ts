export interface ContactName {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  middleName?: string;
}

export interface ContactEmail {
  value: string;
  type?: string; // e.g. "work", "home"
  primary?: boolean;
}

export interface ContactPhone {
  value: string;
  type?: string; // e.g. "mobile", "work", "home"
  primary?: boolean;
}

export interface ContactOrganization {
  name?: string;
  title?: string;
  department?: string;
  type?: string;
  primary?: boolean;
}

export interface ContactAddress {
  formattedValue?: string;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: string;
}

export interface ContactBirthday {
  date?: {
    year?: number;
    month?: number;
    day?: number;
  };
  text?: string;
}

export interface ContactPhoto {
  url: string;
  primary?: boolean;
}

export interface ContactGroup {
  resourceName: string;
  name: string;
}

export interface GoogleContact {
  resourceName: string; // e.g. "people/c123456789"
  etag?: string;
  names?: ContactName[];
  emails?: ContactEmail[];
  phones?: ContactPhone[];
  organizations?: ContactOrganization[];
  addresses?: ContactAddress[];
  birthdays?: ContactBirthday[];
  photos?: ContactPhoto[];
  biographies?: Array<{ value: string }>;
  userDefined?: Array<{ key: string; value: string }>;
  memberships?: Array<{ contactGroupMembership?: { contactGroupResourceName: string } }>;
  // AI and local metadata extensions
  isFavorite?: boolean;
  isFrequentlyContacted?: boolean;
  aiTags?: string[];
  relationshipMetadata?: Record<string, any>;
  lastSyncedAt?: string;
}

export interface ContactMetadataRow {
  id: string;
  user_id: string;
  resource_name: string;
  etag?: string;
  is_favorite: boolean;
  frequently_contacted: boolean;
  interaction_count: number;
  ai_tags: string[];
  relationship_metadata: Record<string, any>;
  last_synced_at: string;
}

export interface ListContactsOptions {
  pageSize?: number;
  pageToken?: string;
  query?: string;
  favoriteOnly?: boolean;
  organizationOnly?: boolean;
}
