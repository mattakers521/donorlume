/**
 * Type stubs for the ProPublica Nonprofit Explorer API.
 * Reference: https://projects.propublica.org/nonprofits/api
 *
 * Only the fields the UI consumes are typed — the API returns more.
 */

export const PROPUBLICA_BASE =
  "https://projects.propublica.org/nonprofits/api/v2";

export type SearchOrg = {
  ein: number | string;
  name: string;
  city?: string;
  state?: string;
  ntee_code?: string;
  income_amount?: number;
  asset_amount?: number;
  sub_status?: string;
};

export type SearchResponse = {
  total_results: number;
  organizations: SearchOrg[];
};

export type Filing = {
  tax_prd?: number;
  tax_prd_yr?: number;
  pdf_url?: string;
  totrevenue?: number;
  totfuncexpns?: number;
  totassetsend?: number;
  grntstogovt?: number;
  grntstoindiv?: number;
  grntstofrgngovt?: number;
};

export type OrgDetail = {
  ein: number | string;
  name: string;
  city?: string;
  state?: string;
  ntee_code?: string;
};

export type DetailsResponse = {
  organization: OrgDetail;
  filings_with_data: Filing[];
};
