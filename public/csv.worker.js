/* global Papa */
importScripts("/papaparse.min.js");

const aliases = {
  name: ["name", "full name", "fullname", "contact", "contact name", "first name", "firstname"],
  title: ["title", "job title", "position", "role", "designation"],
  organization: ["organization", "organisation", "company", "company name", "account", "business"],
  email: ["email", "email address", "e mail", "e-mail", "mail", "contact email", "primary email", "work email", "emailaddress"],
};

const normalizeHeader = (value) => value.trim().toLowerCase().replace(/[\W_]+/g, " ").replace(/\s+/g, " ").trim();

const findColumn = (headers, candidates) => {
  const normalized = headers.map(normalizeHeader);
  let index = normalized.findIndex((header) => candidates.includes(header));
  if (index < 0) {
    index = normalized.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
  }
  return index >= 0 ? headers[index] : undefined;
};

self.onmessage = ({ data }) => {
  Papa.parse(data.text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    complete: ({ data: rawRows, meta, errors }) => {
      if (errors.length && !rawRows.length) {
        self.postMessage({ error: errors[0].message });
        return;
      }

      const headers = meta.fields || [];
      let emailColumn = findColumn(headers, aliases.email);

      // Fallback: look through sample data rows to detect which column contains email addresses
      if (!emailColumn) {
        for (const col of headers) {
          const sampleHasEmail = rawRows.slice(0, 15).some((r) => {
            const val = String(r[col] || "").trim();
            return val.includes("@") && val.includes(".");
          });
          if (sampleHasEmail) {
            emailColumn = col;
            break;
          }
        }
      }

      if (!emailColumn) {
        self.postMessage({ error: "We couldn’t find an email column. Please ensure your CSV has an Email or Email Address column." });
        return;
      }

      const nameColumn = findColumn(headers, aliases.name);
      const titleColumn = findColumn(headers, aliases.title);
      const organizationColumn = findColumn(headers, aliases.organization);
      const seen = new Set();
      const rows = [];
      let duplicates = 0;
      let emptyEmails = 0;

      rawRows.forEach((raw) => {
        const email = String(raw[emailColumn] || "").trim().toLowerCase();
        if (!email) {
          emptyEmails += 1;
          return;
        }
        if (seen.has(email)) {
          duplicates += 1;
          return;
        }
        seen.add(email);
        rows.push({
          id: rows.length + 1,
          name: nameColumn ? String(raw[nameColumn] || "").trim() : "",
          title: titleColumn ? String(raw[titleColumn] || "").trim() : "",
          organization: organizationColumn ? String(raw[organizationColumn] || "").trim() : "",
          email,
          raw,
        });
      });

      self.postMessage({
        payload: { rows, duplicates, emptyEmails, sourceRows: rawRows.length, headers },
      });
    },
  });
};
