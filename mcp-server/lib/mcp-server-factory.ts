import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabaseAdmin } from './supabase-admin.js';
import { generateCvDraftForUser } from './cv-generation-server.js';
import { withUserGenerationLock, GenerationBusyError } from './generation-lock.js';
import { renderCvHtml } from './cv-html.js';
import { htmlToPdfBuffer } from './cv-pdf.js';
import { listRecentGenerations, uploadCvPdf } from './cv-storage.js';
import { loadEducaciones, loadExperiencias, loadOrCreateProfile } from './profile-server.js';

export function createMcpServerForUser(userId: string): McpServer {
  const server = new McpServer({
    name: 'cv-ai-generator',
    version: '1.0.0',
  });

  const admin = getSupabaseAdmin();

  server.registerTool(
    'generate_cv',
    {
      description:
        'Genera un CV (hoja de vida) personalizado para el texto COMPLETO de una convocatoria laboral, renderiza PDF, lo sube a Storage y devuelve enlace de descarga (mismo flujo que Generar enlace en la app).',
      inputSchema: {
        ofertaTexto: z
          .string()
          .min(20)
          .describe('Texto completo de la oferta/convocatoria (nunca un resumen).'),
        language: z
          .enum(['es', 'en'])
          .optional()
          .describe('Idioma del CV: es (español) o en (inglés). Por defecto es.'),
        empresaSlugOverride: z
          .string()
          .optional()
          .describe('Slug opcional para el nombre del archivo PDF (empresa).'),
      },
    },
    async ({ ofertaTexto, language, empresaSlugOverride }) => {
      try {
        const result = await withUserGenerationLock(userId, async () => {
          const draft = await generateCvDraftForUser(admin, userId, {
            ofertaTexto,
            language,
            empresaSlugOverride,
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
            habilidadesLineas: draft.habilidadesLineas,
          };
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        const message =
          error instanceof GenerationBusyError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Error al generar el CV';
        return {
          isError: true,
          content: [{ type: 'text', text: message }],
        };
      }
    },
  );

  server.registerTool(
    'list_recent_cvs',
    {
      description: 'Lista los CVs generados recientemente para esta cuenta con enlaces de descarga firmados (7 días).',
      inputSchema: {
        limit: z.number().int().min(1).max(25).optional().describe('Cantidad máxima (default 10).'),
      },
    },
    async ({ limit }) => {
      const items = await listRecentGenerations(admin, userId, limit ?? 10);
      return {
        content: [{ type: 'text', text: JSON.stringify({ items }, null, 2) }],
        structuredContent: { items },
      };
    },
  );

  server.registerTool(
    'get_base_profile',
    {
      description:
        'Devuelve el perfil maestro del usuario (datos base usados para generar CVs): nombre, carrera, inventarios de sobre mí y habilidades, experiencia y educación.',
    },
    async () => {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const perfil = await loadOrCreateProfile(
        admin,
        userId,
        authUser.user?.email,
        authUser.user?.user_metadata?.['full_name'] as string | undefined,
      );
      const [experiencias, educaciones] = await Promise.all([
        loadExperiencias(admin, perfil.id),
        loadEducaciones(admin, perfil.id),
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
          habilidadesLargo: perfil.habilidades_largo,
        },
        experiencias,
        educaciones,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  return server;
}