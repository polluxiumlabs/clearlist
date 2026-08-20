/* global Papa */
importScripts("/papaparse.min.js");

const aliases = {
  name: ["name", "full name", "fullname", "contact", "contact name"],
  title: ["title", "job title", "position", "role"],
  organization: ["organization", "organisation", "company", "company name", "account"],
  email: ["email", "email address", "e-mail", "mail"],
};

const normalizeHeader = (value) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const findColumn = (headers, candidates) => {
  const normalized = headers.map(normalizeHeader);
  const index = normalized.findIndex((header) => candidates.includes(header));
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
      const emailColumn = findColumn(headers, aliases.email);
      if (!emailColumn) {
        self.postMessage({ error: "We couldn’t find an email column. Name it Email or Email Address and try again." });
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
        });
      });

      self.postMessage({
        payload: { rows, duplicates, emptyEmails, sourceRows: rawRows.length },
      });
    },
  });
};
