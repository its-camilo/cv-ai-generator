var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// mcp-server/lib/env.ts
function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
function geminiDefaults() {
  return {
    temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.2),
    maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 16384)
  };
}
var init_env = __esm({
  "mcp-server/lib/env.ts"() {
    "use strict";
  }
});

// mcp-server/lib/supabase-admin.ts
var supabase_admin_exports = {};
__export(supabase_admin_exports, {
  getSupabaseAdmin: () => getSupabaseAdmin
});
import { createClient } from "@supabase/supabase-js";
function getSupabaseAdmin() {
  if (!adminClient) {
    const url = requireEnv("SUPABASE_URL");
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() || process.env["SUPABASE_SERVICE_KEY"]?.trim();
    if (!key) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return adminClient;
}
var adminClient;
var init_supabase_admin = __esm({
  "mcp-server/lib/supabase-admin.ts"() {
    "use strict";
    init_env();
    adminClient = null;
  }
});

// mcp-server/vercel-entry.ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

// mcp-server/lib/auth.ts
init_supabase_admin();
import { createHash } from "node:crypto";
function hashApiKey(rawKey) {
  return createHash("sha256").update(rawKey.trim()).digest("hex");
}
function parseBearerToken(authorization) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
async function authenticateMcpRequest(authorization) {
  const token = parseBearerToken(authorization);
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data: viaRpc, error: rpcError } = await admin.rpc("resolve_mcp_api_key", {
    p_raw_key: token
  });
  if (!rpcError && viaRpc) {
    return { userId: viaRpc };
  }
  const keyHash = hashApiKey(token);
  const { data: row, error } = await admin.from("mcp_api_keys").select("id, user_id").eq("key_hash", keyHash).is("revoked_at", null).maybeSingle();
  if (error || !row) return null;
  await admin.from("mcp_api_keys").update({ last_used_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", row.id);
  return { userId: row.user_id, keyId: row.id };
}

// mcp-server/lib/mcp-server-factory.ts
init_supabase_admin();
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// src/app/core/constants/cv-layout.constants.ts
var CV_LAYOUT = {
  page: {
    widthIn: 8.5,
    heightIn: 11,
    paddingTopIn: 0.65,
    paddingSideIn: 0.65,
    paddingBottomIn: 0.65
  },
  typography: {
    fontFamily: "Arial, Helvetica, sans-serif",
    namePt: 16,
    subtitlePt: 11,
    contactPt: 10,
    sectionTitlePt: 11,
    bodyPt: 10,
    lineHeight: 1.25
  },
  theme: {
    accent: "#0018cc",
    text: "#1a1a1a",
    textMuted: "#666666",
    topBarHeightPx: 5
  },
  sobreMi: {
    minChars: 170,
    maxChars: 310,
    maxWords: 52,
    minWords: 28,
    maxLines: 3,
    /** Ancho útil ≈ 7.2in @ Arial 10pt (calibrado al PDF). */
    charsPerLine: 104
  },
  habilidades: {
    exactLines: 3,
    minLines: 2,
    maxCharsPerLine: 72,
    maxTotalChars: 210,
    minTotalChars: 40
  },
  validationMaxAttempts: 8
};
var CV_SECTION_LABELS = {
  es: {
    sobreMi: "SOBRE MI",
    experiencia: "EXPERIENCIA",
    educacion: "EDUCACI\xD3N",
    habilidades: "HABILIDADES",
    portafolio: "Portafolio",
    github: "GitHub",
    telefono: "Telefono",
    correo: "Correo",
    lenguajesProgramacion: "Lenguajes de programaci\xF3n",
    idiomas: "Idiomas"
  },
  en: {
    sobreMi: "ABOUT ME",
    experiencia: "EXPERIENCE",
    educacion: "EDUCATION",
    habilidades: "SKILLS",
    portafolio: "Portfolio",
    github: "GitHub",
    telefono: "Phone",
    correo: "Email",
    lenguajesProgramacion: "Programming languages",
    idiomas: "Languages"
  }
};

// src/app/core/prompts/cv-prompts.ts
var BASE_SYSTEM = `Eres un experto en redacci\xF3n de CVs optimizados para ATS (Applicant Tracking Systems).
Usa vocabulario claro, sin adornos, sin emojis, sin markdown.
Responde \xDANICAMENTE con JSON v\xE1lido, sin texto adicional ni bloques de c\xF3digo.`;
function empresaPrompt(oferta, language) {
  return {
    system: BASE_SYSTEM,
    user: `Analiza esta oferta laboral y extrae el nombre corto de la empresa o instituci\xF3n contratante.
Idioma de salida para el slug: ingl\xE9s (solo ASCII, sin espacios).
Responde JSON: {"empresa":"NombreCorto"}

Oferta:
${oferta}`
  };
}
function sobreMiPrompt(language, sobreMiLargo, carrera, oferta, options) {
  const langLabel = language === "es" ? "espa\xF1ol" : "ingl\xE9s";
  const strictLevel = options?.strictLevel ?? 0;
  const validationErrors = options?.validationErrors ?? [];
  const strictNote = strictLevel > 0 ? `

NIVEL DE EXIGENCIA ${strictLevel}/${CV_LAYOUT.validationMaxAttempts}: FALLASTE el l\xEDmite. S\xE9 M\xC1S BREVE. Prioriza 2 frases cortas si hace falta.` : "";
  const retry = validationErrors.length ? `

CORRECCI\xD3N OBLIGATORIA \u2014 cumple EXACTAMENTE:
${validationErrors.map((e) => `- ${e}`).join("\n")}` : "";
  const previous = options?.previousAttempt ? `

Tu intento anterior (RECHAZADO por exceder l\xEDmites):
"${options.previousAttempt}"
Longitud: ${options.previousAttempt.length} caracteres. DEBE ser \u2264 ${CV_LAYOUT.sobreMi.maxChars}.` : "";
  return {
    system: `${BASE_SYSTEM}
El p\xE1rrafo debe caber en M\xC1XIMO 2 l\xEDneas impresas (Arial 10pt, ancho carta US Letter).
L\xEDmite ABSOLUTO: ${CV_LAYOUT.sobreMi.minChars}-${CV_LAYOUT.sobreMi.maxChars} caracteres (incluye espacios), ${CV_LAYOUT.sobreMi.minWords}-${CV_LAYOUT.sobreMi.maxWords} palabras.
NO superes ${CV_LAYOUT.sobreMi.maxChars} caracteres bajo ninguna circunstancia.
Tono profesional, primera persona, orientado a la oferta pero fiel al perfil.${strictNote}`,
    user: `Genera el p\xE1rrafo "Sobre m\xED" para un CV en ${langLabel}, adaptado a la oferta.
Responde JSON: {"sobreMi":"..."}

Perfil base (inventario):
${sobreMiLargo || "(vac\xEDo)"}

Carrera: ${carrera || "N/A"}

Oferta laboral:
${oferta}${previous}${retry}`
  };
}
function habilidadesPrompt(language, habilidadesLargo, oferta, options) {
  const langLabel = language === "es" ? "espa\xF1ol" : "ingl\xE9s";
  const strictLevel = options?.strictLevel ?? 0;
  const validationErrors = options?.validationErrors ?? [];
  const strictNote = strictLevel > 0 ? `

NIVEL DE EXIGENCIA ${strictLevel}/${CV_LAYOUT.validationMaxAttempts}: acorta l\xEDneas. Elimina lo menos relevante.` : "";
  const retry = validationErrors.length ? `

CORRECCI\xD3N OBLIGATORIA:
${validationErrors.map((e) => `- ${e}`).join("\n")}` : "";
  const previous = options?.previousAttempt?.length ? `

Intento anterior (RECHAZADO):
${options.previousAttempt.map((l, i) => `${i + 1}. ${l} (${l.length} chars)`).join("\n")}` : "";
  return {
    system: `${BASE_SYSTEM}
Selecciona las habilidades M\xC1S relevantes para la oferta desde el inventario del candidato.
Formato EXACTO: array de EXACTAMENTE 3 strings (l\xEDneas), estilo CV ATS:
- L\xEDnea 1: habilidades/herramientas/metodolog\xEDas relevantes separadas por " - " (sin prefijo)
- L\xEDnea 2: prefijo "${language === "es" ? "Lenguajes de programaci\xF3n:" : "Programming languages:"}" seguido de lenguajes separados por " - "
- L\xEDnea 3: prefijo "${language === "es" ? "Idiomas:" : "Languages:"}" seguido de idiomas y niveles separados por " - "
Cada l\xEDnea M\xC1XIMO ${CV_LAYOUT.habilidades.maxCharsPerLine} caracteres. Total M\xC1XIMO ${CV_LAYOUT.habilidades.maxTotalChars} caracteres.${strictNote}`,
    user: `Genera la secci\xF3n Habilidades en ${langLabel} para esta oferta.
Responde JSON: {"habilidades":["linea1","linea2","linea3"]}

Inventario completo de habilidades:
${habilidadesLargo || "(vac\xEDo)"}

Oferta laboral:
${oferta}${previous}${retry}`
  };
}
function localizeCvContentPrompt(language, content, issues) {
  const langLabel = language === "es" ? "espa\xF1ol" : "ingl\xE9s";
  const labels = CV_SECTION_LABELS[language];
  const issueBlock = issues?.length ? `

PROBLEMAS DETECTADOS \u2014 corr\xEDgelos:
${issues.map((i) => `- ${i}`).join("\n")}` : "";
  return {
    system: `${BASE_SYSTEM}
Plantilla de referencia: CV de 1 p\xE1gina, Arial 10pt, secciones ${labels.sobreMi}, ${labels.experiencia}, ${labels.educacion}, ${labels.habilidades}.
TODO el texto visible del CV debe estar en ${langLabel}.
NO traduzcas: nombres propios de personas, URLs, correos, tel\xE9fonos, fechas (MM/YYYY), nombres oficiales de instituciones/empresas.
S\xCD traduce: carrera/t\xEDtulo profesional, cargos, descripciones, t\xEDtulos acad\xE9micos/programas, notas (ej. GPA), prefijos de habilidades, "Actualidad"/"Present", niveles de idioma.
Si no hay nota o GPA, deja "nota" como string vac\xEDo. NO uses "No aplica", "N/A" ni equivalentes.
Habilidades: exactamente 3 l\xEDneas.
- L\xEDnea 1: herramientas/metodolog\xEDas sin prefijo.
- L\xEDnea 2: prefijo "${language === "es" ? "Lenguajes de programaci\xF3n:" : "Programming languages:"}".
- L\xEDnea 3: prefijo "${language === "es" ? "Idiomas:" : "Languages:"}".
Mant\xE9n la estructura JSON y el significado profesional.`,
    user: `Verifica y localiza este borrador de CV al ${langLabel}. Si algo ya est\xE1 en el idioma correcto, d\xE9jalo igual.
Responde JSON:
{
  "carrera":"...",
  "sobreMi":"...",
  "habilidades":["linea1","linea2","linea3"],
  "experiencias":[{"lugar":"...","cargo":"...","fechaInicio":"...","fechaFin":"...","descripcion":"..."}],
  "educaciones":[{"lugar":"...","titulo":"...","fechaInicio":"...","fechaFin":"...","nota":"..."}]
}

Contenido actual:
${JSON.stringify(content, null, 2)}${issueBlock}`
  };
}
function parseLocalizedCvContent(raw) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);
  return {
    carrera: String(parsed["carrera"] ?? ""),
    sobreMi: String(parsed["sobreMi"] ?? ""),
    habilidades: Array.isArray(parsed["habilidades"]) ? parsed["habilidades"].map(String) : [],
    experiencias: Array.isArray(parsed["experiencias"]) ? parsed["experiencias"] : [],
    educaciones: Array.isArray(parsed["educaciones"]) ? parsed["educaciones"] : []
  };
}
function parseJsonField(raw, field) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);
  if (!(field in parsed)) {
    throw new Error(`Respuesta IA sin campo "${field}"`);
  }
  return parsed[field];
}
function slugifyEmpresa(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Empresa";
}
function buildDefaultPdfFileName(empresaSlug) {
  return `Camilo_Lagos_CV_${empresaSlug}`;
}
function splitNombreCompleto(nombreCompleto) {
  const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { linea1: parts[0] ?? "", linea2: "" };
  }
  const mid = Math.ceil(parts.length / 2);
  return {
    linea1: parts.slice(0, mid).join(" "),
    linea2: parts.slice(mid).join(" ")
  };
}
function extractGithubUrl(portafolioUrl, explicit) {
  if (explicit?.trim()) return explicit.trim();
  if (portafolioUrl?.includes("github.com")) return portafolioUrl;
  return "https://github.com/its-camilo";
}

// src/app/core/utils/cv-language.ts
var SPANISH_MARKERS = /\b(ingeniería|actualidad|lenguajes de programación|educación|soy un|becario|misión|español|inglés|habilidades|experiencia|universidad|apoyo en|estudiante)\b/i;
var ENGLISH_MARKERS = /\b(engineering|present|programming languages|education|i am a|scholar|intern|english|skills|experience|university|supporting|student|about me)\b/i;
function draftLanguageMismatch(draft) {
  const target = draft.language;
  const issues = [];
  const texts = collectDraftTexts(draft);
  for (const text of texts) {
    if (!text.trim()) continue;
    const looksSpanish = SPANISH_MARKERS.test(text);
    const looksEnglish = ENGLISH_MARKERS.test(text);
    if (target === "en" && looksSpanish && !looksEnglish) {
      issues.push(`Contenido en espa\xF1ol detectado: "${truncate(text)}"`);
    }
    if (target === "es" && looksEnglish && !looksSpanish) {
      issues.push(`Contenido en ingl\xE9s detectado: "${truncate(text)}"`);
    }
  }
  if (target === "en" && draft.habilidadesLineas.some((l) => /lenguajes de programación/i.test(l))) {
    issues.push('Habilidades: usar prefijo "Programming languages:"');
  }
  if (target === "es" && draft.habilidadesLineas.some((l) => /programming languages/i.test(l))) {
    issues.push('Habilidades: usar prefijo "Lenguajes de programaci\xF3n:"');
  }
  if (target === "en" && draft.habilidadesLineas[2] && !/^languages:/i.test(draft.habilidadesLineas[2])) {
    issues.push('Habilidades l\xEDnea 3: usar prefijo "Languages:"');
  }
  if (target === "es" && draft.habilidadesLineas[2] && !/^idiomas:/i.test(draft.habilidadesLineas[2])) {
    issues.push('Habilidades l\xEDnea 3: usar prefijo "Idiomas:"');
  }
  return issues;
}
function collectDraftTexts(draft) {
  return [
    draft.carrera,
    draft.sobreMi,
    ...draft.habilidadesLineas,
    ...draft.experiencias.flatMap((e) => [e.cargo, e.descripcion]),
    ...draft.educaciones.flatMap((e) => [e.titulo, e.nota]),
    ...draft.experiencias.map((e) => e.fechaFin)
  ];
}
function truncate(text, max = 60) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}\u2026`;
}
function presentLabel(language) {
  return language === "es" ? "Actualidad" : "Present";
}

// src/app/core/utils/cv-validation.ts
var EMPTY_EDUCATION_NOTA = /^(no\s+aplica|n\/a|na|not\s+applicable|none|sin\s+nota|—|-)$/i;
function sanitizeEducationNota(nota) {
  const trimmed = (nota ?? "").trim();
  if (!trimmed || EMPTY_EDUCATION_NOTA.test(trimmed)) {
    return "";
  }
  return trimmed;
}
function validateSobreMi(text) {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const errors = [];
  if (trimmed.length < CV_LAYOUT.sobreMi.minChars) {
    errors.push(`Sobre m\xED muy corto (${trimmed.length}/${CV_LAYOUT.sobreMi.minChars} caracteres m\xEDn.)`);
  }
  if (trimmed.length > CV_LAYOUT.sobreMi.maxChars) {
    errors.push(`Sobre m\xED muy largo (${trimmed.length}/${CV_LAYOUT.sobreMi.maxChars} caracteres m\xE1x.)`);
  }
  if (words.length < CV_LAYOUT.sobreMi.minWords) {
    errors.push(`Sobre m\xED: pocas palabras (${words.length}/${CV_LAYOUT.sobreMi.minWords} m\xEDn.)`);
  }
  if (words.length > CV_LAYOUT.sobreMi.maxWords) {
    errors.push(`Sobre m\xED: demasiadas palabras (${words.length}/${CV_LAYOUT.sobreMi.maxWords} m\xE1x.)`);
  }
  const approxLines = Math.ceil(trimmed.length / CV_LAYOUT.sobreMi.charsPerLine);
  if (approxLines > CV_LAYOUT.sobreMi.maxLines) {
    errors.push(`Sobre m\xED ocupar\xEDa m\xE1s de ${CV_LAYOUT.sobreMi.maxLines} l\xEDneas en el CV`);
  }
  return { valid: errors.length === 0, errors };
}
function normalizeCvDraftSections(sobreMi, habilidadesLineas) {
  let normalizedSobreMi = sobreMi.trim();
  let normalizedHabilidades = habilidadesLineas.map((l) => l.trim()).filter(Boolean);
  if (!validateSobreMi(normalizedSobreMi).valid) {
    normalizedSobreMi = fitSobreMiToLayout(normalizedSobreMi);
  }
  if (!validateHabilidadesLineas(normalizedHabilidades).valid) {
    normalizedHabilidades = fitHabilidadesToLayout(normalizedHabilidades);
  }
  return { sobreMi: normalizedSobreMi, habilidadesLineas: normalizedHabilidades };
}
function validateHabilidadesLineas(lineas) {
  const cleaned = lineas.map((l) => l.trim()).filter(Boolean);
  const errors = [];
  if (cleaned.length < CV_LAYOUT.habilidades.minLines) {
    errors.push(`Habilidades: se requieren al menos ${CV_LAYOUT.habilidades.minLines} l\xEDneas`);
  }
  if (cleaned.length > CV_LAYOUT.habilidades.exactLines) {
    errors.push(`Habilidades: m\xE1ximo ${CV_LAYOUT.habilidades.exactLines} l\xEDneas`);
  }
  for (const [index, linea] of cleaned.entries()) {
    if (linea.length > CV_LAYOUT.habilidades.maxCharsPerLine) {
      errors.push(`Habilidades l\xEDnea ${index + 1}: excede ${CV_LAYOUT.habilidades.maxCharsPerLine} caracteres`);
    }
  }
  const total = cleaned.join(" ").length;
  if (total < CV_LAYOUT.habilidades.minTotalChars) {
    errors.push("Habilidades: contenido total insuficiente");
  }
  if (total > CV_LAYOUT.habilidades.maxTotalChars) {
    errors.push(`Habilidades: contenido total excede ${CV_LAYOUT.habilidades.maxTotalChars} caracteres`);
  }
  return { valid: errors.length === 0, errors };
}
function fitSobreMiToLayout(text) {
  let trimmed = text.trim();
  if (trimmed.length <= CV_LAYOUT.sobreMi.maxChars) return trimmed;
  const limit = CV_LAYOUT.sobreMi.maxChars;
  trimmed = trimmed.slice(0, limit);
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > CV_LAYOUT.sobreMi.minChars) {
    trimmed = trimmed.slice(0, lastSpace);
  }
  return trimmed.trim();
}
function fitHabilidadesToLayout(lineas) {
  return lineas.map((l) => l.trim()).filter(Boolean).slice(0, CV_LAYOUT.habilidades.exactLines).map(
    (linea) => linea.length > CV_LAYOUT.habilidades.maxCharsPerLine ? linea.slice(0, CV_LAYOUT.habilidades.maxCharsPerLine).replace(/\s+\S*$/, "").trim() : linea
  );
}

// src/app/core/utils/cv-page-tune.ts
var DEFAULT_CV_PAGE_TUNE = {
  gapScale: 1,
  lineHeightScale: 1,
  fontScale: 1,
  fillPage: true
};
var PT_PER_IN = 72;
var PX_PER_IN = 96;
var TUNE_LIMITS = {
  gapScale: { min: 0.55, max: 2.4 },
  lineHeightScale: { min: 1, max: 1.28 },
  fontScale: { min: 0.9, max: 1.08 },
  fillRatioMin: 0.88
};
function getUsablePageHeightIn() {
  const { heightIn, paddingTopIn, paddingBottomIn } = CV_LAYOUT.page;
  const topBarIn = CV_LAYOUT.theme.topBarHeightPx / PX_PER_IN;
  return heightIn - paddingTopIn - paddingBottomIn - topBarIn;
}
function ptIn(pt) {
  return pt / PT_PER_IN;
}
function countTextLines(text, charsPerLine) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / charsPerLine);
}
function scaledPt(basePt, fontScale) {
  return basePt * fontScale;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function clampTune(tune) {
  return {
    gapScale: clamp(tune.gapScale, TUNE_LIMITS.gapScale.min, TUNE_LIMITS.gapScale.max),
    lineHeightScale: clamp(
      tune.lineHeightScale,
      TUNE_LIMITS.lineHeightScale.min,
      TUNE_LIMITS.lineHeightScale.max
    ),
    fontScale: clamp(tune.fontScale, TUNE_LIMITS.fontScale.min, TUNE_LIMITS.fontScale.max),
    fillPage: tune.fillPage
  };
}
function shrinkTune(tune) {
  const next = { ...tune };
  if (next.gapScale > TUNE_LIMITS.gapScale.min) {
    next.gapScale -= 0.05;
  } else if (next.lineHeightScale > TUNE_LIMITS.lineHeightScale.min) {
    next.lineHeightScale -= 0.012;
  } else if (next.fontScale > TUNE_LIMITS.fontScale.min) {
    next.fontScale -= 6e-3;
  }
  return clampTune(next);
}
function expandTune(tune) {
  const next = { ...tune };
  if (next.gapScale < TUNE_LIMITS.gapScale.max) {
    next.gapScale += 0.04;
  } else if (next.lineHeightScale < TUNE_LIMITS.lineHeightScale.max) {
    next.lineHeightScale += 0.01;
  } else if (next.fontScale < TUNE_LIMITS.fontScale.max) {
    next.fontScale += 4e-3;
  }
  return clampTune(next);
}
function tuneChanged(before, after) {
  return before.gapScale !== after.gapScale || before.lineHeightScale !== after.lineHeightScale || before.fontScale !== after.fontScale;
}
function estimateDraftHeightIn(draft, tune) {
  const bodyPt = scaledPt(CV_LAYOUT.typography.bodyPt, tune.fontScale);
  const bodyLineIn = ptIn(bodyPt * CV_LAYOUT.typography.lineHeight * tune.lineHeightScale);
  const sectionGapIn = ptIn(bodyPt * 0.55 * tune.gapScale);
  const blockGapIn = ptIn(bodyPt * 0.28 * tune.gapScale);
  const headerGapIn = ptIn(bodyPt * 0.4 * tune.gapScale);
  const titleLineIn = (pt) => ptIn(scaledPt(pt, tune.fontScale) * 1.2);
  let heightIn = CV_LAYOUT.theme.topBarHeightPx / PX_PER_IN + ptIn(bodyPt * 0.35 * tune.gapScale);
  heightIn += 2 * titleLineIn(CV_LAYOUT.typography.namePt);
  if (draft.carrera) {
    heightIn += titleLineIn(CV_LAYOUT.typography.subtitlePt);
  }
  const contactLines = [
    draft.ubicacion,
    draft.telefono,
    draft.correo,
    draft.portafolioUrl,
    draft.githubUrl
  ].filter((line) => line.trim());
  heightIn += contactLines.length * ptIn(scaledPt(CV_LAYOUT.typography.contactPt, tune.fontScale) * 1.3);
  heightIn += headerGapIn;
  heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
  heightIn += countTextLines(draft.sobreMi, CV_LAYOUT.sobreMi.charsPerLine) * bodyLineIn;
  if (draft.experiencias.length > 0) {
    heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
    for (const exp of draft.experiencias) {
      heightIn += titleLineIn(CV_LAYOUT.typography.bodyPt);
      heightIn += ptIn(scaledPt(9, tune.fontScale));
      heightIn += countTextLines(exp.descripcion, CV_LAYOUT.sobreMi.charsPerLine) * bodyLineIn;
      heightIn += blockGapIn;
    }
  }
  if (draft.educaciones.length > 0) {
    heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
    for (const edu of draft.educaciones) {
      heightIn += titleLineIn(CV_LAYOUT.typography.bodyPt);
      if (edu.fechaInicio || edu.fechaFin) {
        heightIn += ptIn(scaledPt(9, tune.fontScale));
      }
      if (sanitizeEducationNota(edu.nota)) {
        heightIn += bodyLineIn;
      }
      heightIn += blockGapIn;
    }
  }
  if (draft.habilidadesLineas.length > 0) {
    heightIn += sectionGapIn + titleLineIn(CV_LAYOUT.typography.sectionTitlePt);
    heightIn += draft.habilidadesLineas.filter(Boolean).length * bodyLineIn;
  }
  return heightIn;
}
function computePageTune(draft) {
  const targetIn = getUsablePageHeightIn();
  let tune = clampTune({ ...DEFAULT_CV_PAGE_TUNE });
  for (let i = 0; i < 80; i++) {
    if (estimateDraftHeightIn(draft, tune) <= targetIn) break;
    const next = shrinkTune(tune);
    if (!tuneChanged(tune, next)) break;
    tune = next;
  }
  for (let i = 0; i < 80; i++) {
    const heightIn = estimateDraftHeightIn(draft, tune);
    if (heightIn >= targetIn * TUNE_LIMITS.fillRatioMin) break;
    const next = expandTune(tune);
    if (!tuneChanged(tune, next)) break;
    if (estimateDraftHeightIn(draft, next) > targetIn) break;
    tune = next;
  }
  return tune;
}
function pageTuneStyleVars(tune) {
  const t = tune ?? DEFAULT_CV_PAGE_TUNE;
  return {
    "--cv-tune-gap": String(t.gapScale),
    "--cv-tune-leading": String(t.lineHeightScale),
    "--cv-tune-font": String(t.fontScale)
  };
}

// mcp-server/lib/gemini-server.ts
init_env();
var GEMINI_FUNCTION = "gemini-generate";
function isRetryable(message, status) {
  if (status === 429 || status === 503 || status === 502) return true;
  const lower = message.toLowerCase();
  return lower.includes("rate") || lower.includes("quota") || lower.includes("overloaded") || lower.includes("resource exhausted") || lower.includes("timed out") || lower.includes("timeout");
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function generateContentWithRetry(supabase, userPrompt, options) {
  const trimmed = userPrompt.trim();
  if (!trimmed) throw new Error("userPrompt vac\xEDo");
  const defaults = geminiDefaults();
  const maxAttempts = 5;
  let lastError = "Error desconocido de IA";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase.functions.invoke(
      GEMINI_FUNCTION,
      {
        body: {
          userPrompt: trimmed,
          systemPrompt: options?.systemPrompt?.trim() || void 0,
          temperature: options?.temperature ?? defaults.temperature,
          maxOutputTokens: options?.maxOutputTokens ?? defaults.maxOutputTokens
        }
      }
    );
    if (!error && data?.text) {
      return data.text;
    }
    let message = error?.message ?? data?.error ?? "Error al invocar gemini-generate";
    const status = error?.context?.status;
    if (error?.context) {
      try {
        const payload = await error.context.json();
        if (payload.error) message = payload.error;
      } catch {
      }
    }
    lastError = message;
    if (attempt < maxAttempts - 1 && isRetryable(message, status)) {
      const backoffMs = Math.min(32e3, 2e3 * 2 ** attempt);
      await sleep(backoffMs);
      continue;
    }
    throw new Error(message);
  }
  throw new Error(lastError);
}

// mcp-server/lib/profile-server.ts
async function loadOrCreateProfile(supabase, userId, email, fullName) {
  const { data: rows, error: fetchError } = await supabase.from("perfiles_maestros").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
  if (fetchError) throw fetchError;
  const existing = rows?.[0];
  if (existing) return existing;
  const { data: created, error: createError } = await supabase.from("perfiles_maestros").insert({
    user_id: userId,
    nombre_completo: fullName ?? email?.split("@")[0] ?? "",
    correo: email ?? null
  }).select("*").single();
  if (createError) throw createError;
  return created;
}
async function loadExperiencias(supabase, perfilId) {
  const { data, error } = await supabase.from("experiencias_maestras").select("*").eq("perfil_id", perfilId).order("orden", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function loadEducaciones(supabase, perfilId) {
  const { data, error } = await supabase.from("educaciones_maestras").select("*").eq("perfil_id", perfilId).order("orden", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// mcp-server/lib/cv-generation-server.ts
async function generateCvDraftForUser(supabase, userId, input, userMeta) {
  const language = input.language ?? "es";
  const oferta = input.ofertaTexto.trim();
  if (!oferta) throw new Error("ofertaTexto es obligatorio (texto completo de la convocatoria).");
  const perfil = await loadOrCreateProfile(supabase, userId, userMeta?.email, userMeta?.fullName);
  const [experiencias, educaciones] = await Promise.all([
    loadExperiencias(supabase, perfil.id),
    loadEducaciones(supabase, perfil.id)
  ]);
  const empresaSlug = input.empresaSlugOverride?.trim() || await inferEmpresaSlug(supabase, oferta);
  const sobreMi = await generateSobreMiWithRetry(
    supabase,
    language,
    perfil.sobre_mi_largo ?? "",
    perfil.carrera ?? "",
    oferta
  );
  const habilidadesLineas = await generateHabilidadesWithRetry(
    supabase,
    language,
    perfil.habilidades_largo ?? "",
    oferta
  );
  const initialSobreMi = validateSobreMi(sobreMi).valid ? sobreMi : fitSobreMiToLayout(sobreMi);
  const initialHabilidades = validateHabilidadesLineas(habilidadesLineas).valid ? habilidadesLineas : fitHabilidadesToLayout(habilidadesLineas);
  const { linea1, linea2 } = splitNombreCompleto(perfil.nombre_completo);
  let draft = {
    language,
    ofertaTexto: oferta,
    empresaSlug,
    pdfFileName: buildDefaultPdfFileName(empresaSlug),
    nombreLinea1: linea1,
    nombreLinea2: linea2,
    carrera: perfil.carrera ?? "",
    ubicacion: perfil.ubicacion ?? "",
    telefono: perfil.telefono ?? "",
    correo: perfil.correo ?? "",
    portafolioUrl: perfil.portafolio_url ?? "",
    githubUrl: extractGithubUrl(perfil.portafolio_url),
    sobreMi: initialSobreMi,
    experiencias: mapExperiencias(experiencias, language),
    educaciones: mapEducaciones(educaciones),
    habilidadesLineas: initialHabilidades,
    sectionLabels: { ...CV_SECTION_LABELS[language] },
    pageTune: { ...DEFAULT_CV_PAGE_TUNE }
  };
  draft = await ensureDraftLanguage(supabase, draft);
  const normalized = normalizeCvDraftSections(draft.sobreMi, draft.habilidadesLineas);
  draft = { ...draft, ...normalized, pageTune: computePageTune({ ...draft, ...normalized }) };
  return draft;
}
async function inferEmpresaSlug(supabase, oferta) {
  const { system, user } = empresaPrompt(oferta, "es");
  const raw = await generateContentWithRetry(supabase, user, { systemPrompt: system, temperature: 0.1 });
  const empresa = parseJsonField(raw, "empresa");
  return slugifyEmpresa(empresa);
}
async function generateSobreMiWithRetry(supabase, language, inventario, carrera, oferta) {
  let lastErrors = [];
  let previousAttempt = "";
  for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
    const sobreMi = await generateSobreMi(supabase, language, inventario, carrera, oferta, {
      validationErrors: attempt > 0 ? lastErrors : void 0,
      strictLevel: attempt,
      previousAttempt: attempt > 0 ? previousAttempt : void 0
    }, attempt);
    const validation = validateSobreMi(sobreMi);
    if (validation.valid) return sobreMi;
    lastErrors = validation.errors;
    previousAttempt = sobreMi;
  }
  const fitted = fitSobreMiToLayout(previousAttempt);
  if (validateSobreMi(fitted).valid) return fitted;
  const final = await generateSobreMi(
    supabase,
    language,
    inventario,
    carrera,
    oferta,
    {
      validationErrors: validateSobreMi(fitted).errors,
      strictLevel: CV_LAYOUT.validationMaxAttempts,
      previousAttempt: fitted
    },
    CV_LAYOUT.validationMaxAttempts
  );
  return validateSobreMi(final).valid ? final : fitSobreMiToLayout(final);
}
async function generateHabilidadesWithRetry(supabase, language, inventario, oferta) {
  let lastErrors = [];
  let previousAttempt = [];
  for (let attempt = 0; attempt < CV_LAYOUT.validationMaxAttempts; attempt++) {
    const habilidadesLineas = await generateHabilidades(supabase, language, inventario, oferta, {
      validationErrors: attempt > 0 ? lastErrors : void 0,
      strictLevel: attempt,
      previousAttempt: attempt > 0 ? previousAttempt : void 0
    }, attempt);
    const validation = validateHabilidadesLineas(habilidadesLineas);
    if (validation.valid) return habilidadesLineas;
    lastErrors = validation.errors;
    previousAttempt = habilidadesLineas;
  }
  const fitted = fitHabilidadesToLayout(previousAttempt);
  if (validateHabilidadesLineas(fitted).valid) return fitted;
  const final = await generateHabilidades(
    supabase,
    language,
    inventario,
    oferta,
    {
      validationErrors: validateHabilidadesLineas(fitted).errors,
      strictLevel: CV_LAYOUT.validationMaxAttempts,
      previousAttempt: fitted
    },
    CV_LAYOUT.validationMaxAttempts
  );
  return validateHabilidadesLineas(final).valid ? final : fitHabilidadesToLayout(final);
}
async function ensureDraftLanguage(supabase, draft) {
  const maxAttempts = 3;
  let current = draft;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const issues = draftLanguageMismatch(current);
    const localized = await localizeDraftContent(supabase, current, issues.length ? issues : void 0);
    current = {
      ...current,
      carrera: localized.carrera,
      sobreMi: localized.sobreMi,
      habilidadesLineas: localized.habilidades,
      experiencias: localized.experiencias,
      educaciones: localized.educaciones,
      sectionLabels: { ...CV_SECTION_LABELS[current.language] }
    };
    if (draftLanguageMismatch(current).length === 0) return current;
  }
  return current;
}
async function localizeDraftContent(supabase, draft, issues) {
  const content = {
    carrera: draft.carrera,
    sobreMi: draft.sobreMi,
    habilidades: draft.habilidadesLineas,
    experiencias: draft.experiencias,
    educaciones: draft.educaciones
  };
  const { system, user } = localizeCvContentPrompt(draft.language, content, issues);
  const raw = await generateContentWithRetry(supabase, user, { systemPrompt: system, temperature: 0.1 });
  const localized = parseLocalizedCvContent(raw);
  return {
    carrera: localized.carrera.trim(),
    sobreMi: localized.sobreMi.trim(),
    habilidades: localized.habilidades.map((l) => l.trim()).filter(Boolean).slice(0, CV_LAYOUT.habilidades.exactLines),
    experiencias: localized.experiencias.map((exp) => ({
      lugar: exp.lugar?.trim() ?? "",
      cargo: exp.cargo?.trim() ?? "",
      fechaInicio: exp.fechaInicio?.trim() ?? "",
      fechaFin: exp.fechaFin?.trim() || presentLabel(draft.language),
      descripcion: exp.descripcion?.trim() ?? ""
    })),
    educaciones: localized.educaciones.map((edu) => ({
      lugar: edu.lugar?.trim() ?? "",
      titulo: edu.titulo?.trim() ?? "",
      fechaInicio: edu.fechaInicio?.trim() ?? "",
      fechaFin: edu.fechaFin?.trim() ?? "",
      nota: sanitizeEducationNota(edu.nota)
    }))
  };
}
async function generateSobreMi(supabase, language, inventario, carrera, oferta, options, attempt = 0) {
  const { system, user } = sobreMiPrompt(language, inventario, carrera, oferta, options);
  const raw = await generateContentWithRetry(supabase, user, {
    systemPrompt: system,
    temperature: Math.max(0.05, 0.25 - attempt * 0.03)
  });
  return parseJsonField(raw, "sobreMi").trim();
}
async function generateHabilidades(supabase, language, inventario, oferta, options, attempt = 0) {
  const { system, user } = habilidadesPrompt(language, inventario, oferta, options);
  const raw = await generateContentWithRetry(supabase, user, {
    systemPrompt: system,
    temperature: Math.max(0.05, 0.2 - attempt * 0.025)
  });
  const lines = parseJsonField(raw, "habilidades");
  return lines.map((l) => l.trim()).filter(Boolean).slice(0, CV_LAYOUT.habilidades.exactLines);
}
function mapExperiencias(items, language) {
  const present = presentLabel(language);
  return items.map((item) => ({
    lugar: item.lugar,
    cargo: item.cargo,
    fechaInicio: item.fecha_inicio ?? "",
    fechaFin: item.fecha_fin?.trim() ? item.fecha_fin : present,
    descripcion: item.descripcion ?? ""
  }));
}
function mapEducaciones(items) {
  return items.map((item) => ({
    lugar: item.lugar,
    titulo: item.titulo,
    fechaInicio: item.fecha_inicio ?? "",
    fechaFin: item.fecha_fin ?? "",
    nota: sanitizeEducationNota(item.nota)
  }));
}

// mcp-server/lib/generation-lock.ts
init_supabase_admin();
var LOCK_TTL_MS = 20 * 60 * 1e3;
var GenerationBusyError = class extends Error {
  constructor() {
    super("Ya hay una generaci\xF3n de CV en curso para esta cuenta. Espera a que termine e int\xE9ntalo de nuevo.");
    this.name = "GenerationBusyError";
  }
};
async function withUserGenerationLock(userId, fn) {
  const admin = getSupabaseAdmin();
  const now = /* @__PURE__ */ new Date();
  const expires = new Date(now.getTime() + LOCK_TTL_MS);
  await admin.from("mcp_generation_locks").delete().eq("user_id", userId).lt("expires_at", now.toISOString());
  const { error: insertError } = await admin.from("mcp_generation_locks").insert({
    user_id: userId,
    locked_at: now.toISOString(),
    expires_at: expires.toISOString()
  });
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await admin.from("mcp_generation_locks").select("expires_at").eq("user_id", userId).maybeSingle();
      if (existing && new Date(existing.expires_at) > now) {
        throw new GenerationBusyError();
      }
      await admin.from("mcp_generation_locks").delete().eq("user_id", userId);
      const retry = await admin.from("mcp_generation_locks").insert({
        user_id: userId,
        locked_at: now.toISOString(),
        expires_at: expires.toISOString()
      });
      if (retry.error) throw new GenerationBusyError();
    } else {
      throw insertError;
    }
  }
  try {
    return await fn();
  } finally {
    await admin.from("mcp_generation_locks").delete().eq("user_id", userId);
  }
}

// mcp-server/lib/cv-html.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
var cvCss = readFileSync(
  join(process.cwd(), "src/app/pages/dashboard/cv-preview/cv-document/cv-document.css"),
  "utf8"
).replace(":host { display: block; }", "");
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatFullName(draft) {
  return [draft.nombreLinea1, draft.nombreLinea2].filter(Boolean).join(" ").trim();
}
function formatPhoneLine(draft) {
  const raw = draft.telefono.trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const localDigits = digits.startsWith("57") && digits.length > 10 ? digits.slice(2) : digits;
  if (draft.language === "en") {
    return `${draft.sectionLabels.telefono}: +57 ${localDigits || raw.replace(/\D/g, "")}`;
  }
  const local = localDigits || raw.replace(/^\+57\s?/, "").trim();
  return `${draft.sectionLabels.telefono}: ${local}`;
}
function formatExpDates(inicio, fin) {
  if (!inicio && !fin) return "";
  if (!inicio) return fin;
  if (!fin) return inicio;
  return `${inicio}-${fin}`;
}
function formatEduDates(inicio, fin) {
  if (inicio && fin) return `${inicio}-${fin}`;
  return fin || inicio;
}
function blockHeadline(lugar, titulo) {
  const place = lugar.trim();
  const title = titulo.trim();
  if (title.includes(" - ")) {
    const splitAt = title.indexOf(" - ");
    const primary = title.slice(0, splitAt).trim();
    const secondary = title.slice(splitAt + 3).trim();
    if (!place || primary.toLowerCase().includes(place.toLowerCase()) || place.toLowerCase().includes(primary.toLowerCase())) {
      return { primary, secondary };
    }
  }
  if (place && title) return { primary: place, secondary: title };
  return { primary: title || place, secondary: "" };
}
function expBullets(descripcion) {
  return descripcion.split(/\n+/).map((line) => line.replace(/^[\s•●\-]+/, "").trim()).filter(Boolean);
}
function renderCvHtml(draft) {
  const tuneVars = pageTuneStyleVars(draft.pageTune);
  const styleAttr = Object.entries(tuneVars).map(([k, v]) => `${k}: ${v}`).join("; ");
  const headerParts = [];
  const fullName = formatFullName(draft);
  headerParts.push(`<h1 class="cv-doc__name">${escapeHtml(fullName)}</h1>`);
  if (draft.carrera) {
    headerParts.push(`<p class="cv-doc__carrera">${escapeHtml(draft.carrera)}</p>`);
  }
  if (draft.ubicacion) {
    headerParts.push(`<p class="cv-doc__contact-line">${escapeHtml(draft.ubicacion)}</p>`);
  }
  const phone = formatPhoneLine(draft);
  if (phone) headerParts.push(`<p class="cv-doc__contact-line">${escapeHtml(phone)}</p>`);
  if (draft.correo) {
    headerParts.push(
      `<p class="cv-doc__contact-line">${escapeHtml(draft.sectionLabels.correo)}: <a class="cv-doc__link" href="mailto:${escapeHtml(draft.correo)}">${escapeHtml(draft.correo)}</a></p>`
    );
  }
  if (draft.portafolioUrl) {
    headerParts.push(
      `<p class="cv-doc__contact-line">${escapeHtml(draft.sectionLabels.portafolio)}: <a class="cv-doc__link" href="${escapeHtml(draft.portafolioUrl)}">${escapeHtml(draft.portafolioUrl)}</a></p>`
    );
  }
  if (draft.githubUrl) {
    headerParts.push(
      `<p class="cv-doc__contact-line">${escapeHtml(draft.sectionLabels.github)}: <a class="cv-doc__link" href="${escapeHtml(draft.githubUrl)}">${escapeHtml(draft.githubUrl)}</a></p>`
    );
  }
  let sections = "";
  sections += `<section class="cv-doc__section cv-doc__section--first"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.sobreMi)}</h2><p class="cv-doc__sobre">${escapeHtml(draft.sobreMi)}</p></section>`;
  if (draft.experiencias.length > 0) {
    let blocks = "";
    for (const exp of draft.experiencias) {
      blocks += `<div class="cv-doc__block"><p class="cv-doc__block-head"><strong class="cv-doc__block-primary">${escapeHtml(exp.lugar)}</strong>`;
      if (exp.cargo) {
        blocks += `<span class="cv-doc__block-secondary"> - ${escapeHtml(exp.cargo)}</span>`;
      }
      blocks += "</p>";
      const dates = formatExpDates(exp.fechaInicio, exp.fechaFin);
      if (dates) blocks += `<p class="cv-doc__block-dates">${escapeHtml(dates)}</p>`;
      for (const bullet of expBullets(exp.descripcion)) {
        blocks += `<p class="cv-doc__bullet">\u25CF ${escapeHtml(bullet)}</p>`;
      }
      blocks += "</div>";
    }
    sections += `<section class="cv-doc__section"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.experiencia)}</h2>${blocks}</section>`;
  }
  if (draft.educaciones.length > 0) {
    let blocks = "";
    for (const edu of draft.educaciones) {
      const head = blockHeadline(edu.lugar, edu.titulo);
      blocks += '<div class="cv-doc__block">';
      if (head.primary) {
        blocks += `<p class="cv-doc__block-head"><strong class="cv-doc__block-primary">${escapeHtml(head.primary)}</strong>`;
        if (head.secondary) {
          blocks += `<span class="cv-doc__block-secondary"> - ${escapeHtml(head.secondary)}</span>`;
        }
        blocks += "</p>";
      }
      const dates = formatEduDates(edu.fechaInicio, edu.fechaFin);
      if (dates) blocks += `<p class="cv-doc__block-dates">${escapeHtml(dates)}</p>`;
      const nota = sanitizeEducationNota(edu.nota);
      if (nota) blocks += `<p class="cv-doc__block-note">${escapeHtml(nota)}</p>`;
      blocks += "</div>";
    }
    sections += `<section class="cv-doc__section"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.educacion)}</h2>${blocks}</section>`;
  }
  if (draft.habilidadesLineas.length > 0) {
    const lines = draft.habilidadesLineas.map((linea) => `<p class="cv-doc__skill-line">${escapeHtml(linea)}</p>`).join("");
    sections += `<section class="cv-doc__section cv-doc__section--skills"><h2 class="cv-doc__section-title">${escapeHtml(draft.sectionLabels.habilidades)}</h2>${lines}</section>`;
  }
  const fillClass = draft.pageTune.fillPage ? " cv-doc__sections--fill" : "";
  return `<!DOCTYPE html>
<html lang="${draft.language}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; }
    ${cvCss}
  </style>
</head>
<body>
  <article class="cv-doc" style="${styleAttr}">
    <div class="cv-doc__sheet">
      <div class="cv-doc__top-bar" aria-hidden="true"></div>
      <div class="cv-doc__content">
        <header class="cv-doc__header">${headerParts.join("")}</header>
        <div class="cv-doc__sections${fillClass}">${sections}</div>
      </div>
    </div>
  </article>
</body>
</html>`;
}

// mcp-server/lib/cv-pdf.ts
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
async function htmlToPdfBuffer(html) {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 816, height: 1056 },
    executablePath,
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// mcp-server/lib/cv-storage.ts
var CV_BUCKET = "cvs";
var LINK_TTL_SECONDS = 60 * 60 * 24 * 7;
function safeFileName(fileName) {
  return fileName.replace(/\.pdf$/i, "").replace(/[^\w\-]+/g, "_") || "CV";
}
async function uploadCvPdf(supabase, userId, draft, pdf) {
  const safe = safeFileName(draft.pdfFileName);
  const storagePath = `${userId}/${safe}-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage.from(CV_BUCKET).upload(storagePath, pdf, {
    contentType: "application/pdf",
    upsert: false
  });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.storage.from(CV_BUCKET).createSignedUrl(storagePath, LINK_TTL_SECONDS, { download: `${safe}.pdf` });
  if (error || !data) throw error ?? new Error("No se pudo crear el enlace firmado.");
  await supabase.from("cv_generations").insert({
    user_id: userId,
    storage_path: storagePath,
    pdf_file_name: safe,
    empresa_slug: draft.empresaSlug,
    language: draft.language,
    sobre_mi_preview: draft.sobreMi.slice(0, 400)
  });
  return { signedUrl: data.signedUrl, storagePath, downloadFileName: `${safe}.pdf` };
}
async function listRecentGenerations(supabase, userId, limit = 10) {
  const { data, error } = await supabase.from("cv_generations").select("id, pdf_file_name, empresa_slug, language, created_at, storage_path, sobre_mi_preview").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage.from(CV_BUCKET).createSignedUrl(row.storage_path, LINK_TTL_SECONDS, {
        download: `${row.pdf_file_name}.pdf`
      });
      return {
        id: row.id,
        pdfFileName: row.pdf_file_name,
        empresaSlug: row.empresa_slug,
        language: row.language,
        createdAt: row.created_at,
        downloadUrl: signed?.signedUrl ?? null,
        sobreMiPreview: row.sobre_mi_preview
      };
    })
  );
}

// mcp-server/lib/mcp-server-factory.ts
function createMcpServerForUser(userId) {
  const server = new McpServer({
    name: "cv-ai-generator",
    version: "1.0.0"
  });
  const admin = getSupabaseAdmin();
  server.registerTool(
    "generate_cv",
    {
      description: "Genera un CV (hoja de vida) personalizado para el texto COMPLETO de una convocatoria laboral, renderiza PDF, lo sube a Storage y devuelve enlace de descarga (mismo flujo que Generar enlace en la app).",
      inputSchema: {
        ofertaTexto: z.string().min(20).describe("Texto completo de la oferta/convocatoria (nunca un resumen)."),
        language: z.enum(["es", "en"]).optional().describe("Idioma del CV: es (espa\xF1ol) o en (ingl\xE9s). Por defecto es."),
        empresaSlugOverride: z.string().optional().describe("Slug opcional para el nombre del archivo PDF (empresa).")
      }
    },
    async ({ ofertaTexto, language, empresaSlugOverride }) => {
      try {
        const result = await withUserGenerationLock(userId, async () => {
          const draft = await generateCvDraftForUser(admin, userId, {
            ofertaTexto,
            language,
            empresaSlugOverride
          });
          const html = renderCvHtml(draft);
          const pdf = await htmlToPdfBuffer(html);
          const uploaded = await uploadCvPdf(admin, userId, draft, pdf);
          return {
            downloadUrl: uploaded.signedUrl,
            fileName: uploaded.downloadFileName,
            storagePath: uploaded.storagePath,
            language: draft.language,
            empresaSlug: draft.empresaSlug,
            pdfFileName: draft.pdfFileName,
            sobreMi: draft.sobreMi,
            habilidadesLineas: draft.habilidadesLineas
          };
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        const message = error instanceof GenerationBusyError ? error.message : error instanceof Error ? error.message : "Error al generar el CV";
        return {
          isError: true,
          content: [{ type: "text", text: message }]
        };
      }
    }
  );
  server.registerTool(
    "list_recent_cvs",
    {
      description: "Lista los CVs generados recientemente para esta cuenta con enlaces de descarga firmados (7 d\xEDas).",
      inputSchema: {
        limit: z.number().int().min(1).max(25).optional().describe("Cantidad m\xE1xima (default 10).")
      }
    },
    async ({ limit }) => {
      const items = await listRecentGenerations(admin, userId, limit ?? 10);
      return {
        content: [{ type: "text", text: JSON.stringify({ items }, null, 2) }],
        structuredContent: { items }
      };
    }
  );
  server.registerTool(
    "get_base_profile",
    {
      description: "Devuelve el perfil maestro del usuario (datos base usados para generar CVs): nombre, carrera, inventarios de sobre m\xED y habilidades, experiencia y educaci\xF3n."
    },
    async () => {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const perfil = await loadOrCreateProfile(
        admin,
        userId,
        authUser.user?.email,
        authUser.user?.user_metadata?.["full_name"]
      );
      const [experiencias, educaciones] = await Promise.all([
        loadExperiencias(admin, perfil.id),
        loadEducaciones(admin, perfil.id)
      ]);
      const payload = {
        perfil: {
          id: perfil.id,
          nombreCompleto: perfil.nombre_completo,
          carrera: perfil.carrera,
          ubicacion: perfil.ubicacion,
          telefono: perfil.telefono,
          correo: perfil.correo,
          portafolioUrl: perfil.portafolio_url,
          sobreMiLargo: perfil.sobre_mi_largo,
          habilidadesLargo: perfil.habilidades_largo
        },
        experiencias,
        educaciones
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload
      };
    }
  );
  return server;
}

// mcp-server/vercel-entry.ts
var config = {
  maxDuration: 300
};
function headerRecord(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === void 0) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}
function toWebRequest(req) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host ?? "localhost";
  const path = req.url ?? "/api/mcp";
  const url = `${proto}://${host}${path}`;
  const method = req.method ?? "POST";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(url, {
    method,
    headers: headerRecord(req),
    body: hasBody ? typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}) : void 0
  });
}
async function sendWebResponse(webResponse, res) {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  res.send(buffer);
}
async function handler(req, res) {
  try {
    const { getSupabaseAdmin: getSupabaseAdmin2 } = await Promise.resolve().then(() => (init_supabase_admin(), supabase_admin_exports));
    getSupabaseAdmin2();
  } catch {
    res.status(503).json({
      error: "MCP server is not fully configured (missing SUPABASE_SERVICE_ROLE_KEY on Vercel)."
    });
    return;
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id");
    res.status(204).end();
    return;
  }
  const authHeader = req.headers.authorization;
  const auth = authHeader ?? (typeof req.headers["Authorization"] === "string" ? req.headers["Authorization"] : void 0);
  let user;
  try {
    user = await authenticateMcpRequest(auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth configuration error";
    res.status(500).json({ error: message });
    return;
  }
  if (!user) {
    res.status(401).json({ error: "Unauthorized: Bearer MCP API key required" });
    return;
  }
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: void 0
    });
    const server = createMcpServerForUser(user.userId);
    await server.connect(transport);
    const webRequest = toWebRequest(req);
    const webResponse = await transport.handleRequest(webRequest);
    await sendWebResponse(webResponse, res);
  } catch (error) {
    console.error("[mcp]", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal MCP error"
    });
  }
}
export {
  config,
  handler as default
};
