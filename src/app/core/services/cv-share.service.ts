import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

const CV_BUCKET = 'cvs';
/** Vigencia del enlace firmado: 7 días. */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

@Injectable({
  providedIn: 'root',
})
export class CvShareService {
  private readonly supabase = inject(SupabaseService);

  /** Sube el PDF a la carpeta del usuario en Storage y devuelve un enlace firmado. */
  async uploadAndGetLink(pdf: Blob, safeFileName: string): Promise<string> {
    const user = await this.supabase.waitForAuth();
    if (!user) throw new Error('Inicia sesión para generar el enlace.');

    const client = this.supabase.getClient();
    const path = `${user.id}/${safeFileName}-${Date.now()}.pdf`;

    const { error: uploadError } = await client.storage
      .from(CV_BUCKET)
      .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await client.storage
      .from(CV_BUCKET)
      .createSignedUrl(path, LINK_TTL_SECONDS, { download: `${safeFileName}.pdf` });
    if (error || !data) throw error ?? new Error('No se pudo crear el enlace.');

    return data.signedUrl;
  }
}
