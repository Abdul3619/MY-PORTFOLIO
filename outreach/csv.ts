// Minimal CSV parser for the "import a CSV of URLs/business names" input path.
// Handles quoted fields and commas inside quotes; does not try to be a full
// RFC 4180 implementation, which would be overkill for a single-user tool.

export interface CsvLeadRow {
  website: string;
  businessName?: string;
  city?: string;
  country?: string;
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

const HEADER_ALIASES: Record<string, string> = {
  url: 'website',
  website: 'website',
  site: 'website',
  domain: 'website',
  name: 'businessName',
  business: 'businessName',
  businessname: 'businessName',
  'business_name': 'businessName',
  company: 'businessName',
  city: 'city',
  country: 'country',
};

/** Parses CSV text into lead rows. Requires a header row containing at least a URL/website column. */
export function parseCsv(text: string): { rows: CsvLeadRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], skipped: 0 };

  const header = parseLine(lines[0]).map((h) => HEADER_ALIASES[h.toLowerCase().trim()] || null);
  const websiteIdx = header.indexOf('website');

  const rows: CsvLeadRow[] = [];
  let skipped = 0;
  const dataLines = websiteIdx === -1 ? lines : lines.slice(1);

  for (const line of dataLines) {
    const fields = parseLine(line);
    let row: CsvLeadRow;
    if (websiteIdx === -1) {
      // No recognizable header — treat every non-empty line as a bare URL.
      if (!fields[0]) {
        skipped++;
        continue;
      }
      row = { website: fields[0] };
    } else {
      const obj: Record<string, string> = {};
      header.forEach((key, i) => {
        if (key && fields[i]) obj[key] = fields[i];
      });
      if (!obj.website) {
        skipped++;
        continue;
      }
      row = {
        website: obj.website,
        businessName: obj.businessName,
        city: obj.city,
        country: obj.country,
      };
    }
    rows.push(row);
  }
  return { rows, skipped };
}
