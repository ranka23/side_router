const CAVEMAN_SYSTEM_PROMPT =
  "Caveman mode. Terse. Technical substance exact. No filler. No pleasantries. " +
  "Use short sentences, symbols, arrows. Code blocks, URLs, paths, commands unchanged. " +
  "If nuance matters, keep nuance. Maximum meaning, minimum tokens.";

const PRESERVE_PATTERN = /```[\s\S]*?```|`[^`]+`|https?:\/\/\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:^|\s)\/[\w./-]+|\b[\w.-]+\/[\w./-]+\b/g;
const FILLER_PATTERN = /\b(the|a|an|that|this|which|very|really|basically|actually|probably|maybe|perhaps|just|clearly|obviously|however|therefore|in order to|it is important to note|worth noting)\b/gi;

function protectBlocks(text, fn) {
  const blocks = [];
  const safe = String(text || "").replace(PRESERVE_PATTERN, function (match) {
    blocks.push(match);
    return "\u0000" + (blocks.length - 1) + "\u0000";
  });
  const compressed = fn(safe);
  return compressed.replace(/\u0000(\d+)\u0000/g, function (_, index) {
    return blocks[Number(index)];
  });
}

function looksLikeStructuredData(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if ((t[0] === "{" && t[t.length - 1] === "}") || (t[0] === "[" && t[t.length - 1] === "]")) {
    return (t.match(/"/g) || []).length >= 4;
  }
  return false;
}

function shouldCompressText(text) {
  const t = String(text || "");
  if (t.length < 120) return false;
  if (looksLikeStructuredData(t)) return false;
  if (/```/.test(t)) return true;

  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const ratio = letters / Math.max(1, t.length);
  const codeLike = /function\s*\(|=>|\bconst\b|\blet\b|\bvar\b|class\s+\w+|\{[\s\S]*\}/.test(t);
  if (codeLike && ratio < 0.45) return false;
  return ratio > 0.35;
}

function compressCavemanText(text) {
  if (!shouldCompressText(text)) return String(text || "");
  return protectBlocks(text, function (safe) {
    return safe
      .replace(/\bbecause\b/gi, "->")
      .replace(FILLER_PATTERN, " ")
      .replace(/\s+/g, " ")
      .trim();
  });
}

function compressContextText(text, maxChars) {
  const compressed = compressCavemanText(text);
  return maxChars ? compressed.slice(0, maxChars) : compressed;
}

function shouldCompressAttachment(attachment) {
  if (!attachment || !attachment.text) return false;
  if (attachment.type === "image" || attachment.type === "audio" || attachment.type === "video") return false;
  if (attachment.mime === "application/pdf") return false;
  if (attachment.mime && /^(image|audio|video)\//.test(attachment.mime)) return false;
  return shouldCompressText(attachment.text);
}

window.CavemanModule = {
  CAVEMAN_SYSTEM_PROMPT,
  shouldCompressText,
  compressCavemanText,
  compressContextText,
  shouldCompressAttachment,
};
