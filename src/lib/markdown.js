const escapeHtml = (str) => String(str)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function parseInline(text) {
  return text
    .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+?)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
      const safeUrl = /^https?:\/\//i.test(url) ? url : "#";
      return `<a href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(linkText)}</a>`;
    })
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safeUrl = /^https?:\/\//i.test(url) ? url : "";
      if (!safeUrl) return "";
      return `<img src="${safeUrl}" alt="${escapeHtml(alt)}" loading="lazy">`;
    });
}

function parseBlocks(text) {
  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      result.push("");
      i++;
      continue;
    }

    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      const lang = codeMatch[1] || "";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++;
      const code = codeLines.join("\n");
      const langBadge = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
      result.push(`<div class="code-block">${langBadge}<pre><code>${code}</code></pre><button class="code-copy" data-action="code-copy">Copy</button></div>`);
      continue;
    }

    const hrMatch = line.match(/^---+$/);
    if (hrMatch) {
      result.push("<hr>");
      i++;
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      result.push(`<h${level}>${parseInline(escapeHtml(hMatch[2]))}</h${level}>`);
      i++;
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      const quoteLines = [];
      while (i < lines.length && lines[i].match(/^>\s?/)) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const content = quoteLines.map(l => parseInline(escapeHtml(l))).join("<br>");
      result.push(`<blockquote>${content}</blockquote>`);
      continue;
    }

    const ulMatch = line.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        items.push(`<li>${parseInline(escapeHtml(lines[i].replace(/^[-*+]\s+/, "")))}</li>`);
        i++;
      }
      result.push("<ul>" + items.join("") + "</ul>");
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(`<li>${parseInline(escapeHtml(lines[i].replace(/^\d+\.\s+/, "")))}</li>`);
        i++;
      }
      result.push("<ol>" + items.join("") + "</ol>");
      continue;
    }

    const taskMatch = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const items = [];
      while (i < lines.length && lines[i].match(/^-\s+\[[ xX]\]/)) {
        const isChecked = lines[i].includes("[x]") || lines[i].includes("[X]");
        const itemText = lines[i].replace(/^-\s+\[[ xX]\]\s+/, "");
        const checkedAttr = isChecked ? " checked" : "";
        items.push(`<div class="checkbox"><input type="checkbox"${checkedAttr} disabled> ${parseInline(escapeHtml(itemText))}</div>`);
        i++;
      }
      result.push(items.join(""));
      continue;
    }

    const tableMatch = line.match(/^\|.+\|$/);
    if (tableMatch) {
      const tableLines = [];
      while (i < lines.length && lines[i].match(/^\|.+\|$/)) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2 && !tableLines[1].includes("---")) {
        const header = tableLines[0].split("|").slice(1, -1).map(c => `<th>${parseInline(escapeHtml(c.trim()))}</th>`).join("");
        const rows = tableLines.slice(1).map(row => {
          const cells = row.split("|").slice(1, -1).map(c => `<td>${parseInline(escapeHtml(c.trim()))}</td>`).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
        result.push(`<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`);
      }
      continue;
    }

    result.push(parseInline(escapeHtml(line)));
    i++;
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n");
}

function md(text) {
  if (!text) return "";
  return parseBlocks(text);
}

window.md = md;
window.sanitizeHtml = escapeHtml;