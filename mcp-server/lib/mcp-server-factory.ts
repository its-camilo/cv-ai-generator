import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { start } from 'workflow/api';
import { getSupabaseAdmin } from './supabase-admin.js';
import { GenerationBusyError, hasActiveGenerationLock } from './generation-lock.js';
import { listRecentGenerations } from './cv-storage.js';
import { loadEducaciones, loadExperiencias, loadOrCreateProfile } from './profile-server.js';
import { generateCvWorkflow } from '../workflows/generate-cv.js';

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
        'Inicia en segundo plano la generación de un CV (hoja de vida) personalizado para el texto COMPLETO de una convocatoria laboral: renderiza PDF y lo sube a Storage (mismo flujo que Generar enlace en la app). Devuelve de inmediato { runId, status }; el CV terminado (con downloadUrl) aparece en list_recent_cvs.',
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
        const oferta = ofertaTexto.trim();
        if (!oferta) throw new Error('ofertaTexto es obligatorio (texto completo de la convocatoria).');
        // Respuesta rápida si ya hay una generación en curso; el lock real se toma en el primer step.
        if (await hasActiveGenerationLock(userId)) throw new GenerationBusyError();

        const requestedAt = new Date().toISOString();
        const run = await start(generateCvWorkflow, [
          {
            userId,
            oferta,
            language: language ?? 'es',
            empresaSlugOverride,
          },
        ]);
        const result = {
          runId: run.runId,
          status: await run.status,
          requestedAt,
          message:
            'Generación iniciada en segundo plano. Consulta list_recent_cvs: cuando aparezca un CV con createdAt posterior a requestedAt, la generación terminó y trae su downloadUrl.',
        };

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