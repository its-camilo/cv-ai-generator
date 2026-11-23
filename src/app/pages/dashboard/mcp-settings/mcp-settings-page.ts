import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CreatedMcpApiKey,
  McpApiKeyRow,
  McpApiKeyService,
} from '../../../core/services/mcp-api-key.service';

@Component({
  selector: 'app-mcp-settings-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './mcp-settings-page.html',
  styleUrl: './mcp-settings-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class McpSettingsPage {
  private readonly mcpKeys = inject(McpApiKeyService);

  readonly loading = signal(true);
  readonly keys = signal<McpApiKeyRow[]>([]);
  readonly label = signal('');
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly newKey = signal<CreatedMcpApiKey | null>(null);
  readonly copied = signal(false);

  readonly mcpEndpoint = 'https://cv-ai-generator-rho.vercel.app/api/mcp';

  readonly clientConfigExample = `{
  "mcpServers": {
    "cv-ai-generator": {
      "url": "https://cv-ai-generator-rho.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer TU_CLAVE_AQUI"
      }
    }
  }
}`;

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.mcpKeys.listActiveKeys();
      this.keys.set(rows);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudieron cargar las claves MCP');
    } finally {
      this.loading.set(false);
    }
  }

  updateLabel(value: string): void {
    this.label.set(value);
  }

  async createKey(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    this.error.set(null);
    this.newKey.set(null);
    try {
      const created = await this.mcpKeys.createKey(this.label());
      this.newKey.set(created);
      this.label.set('');
      await this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo crear la clave');
    } finally {
      this.creating.set(false);
    }
  }

  async revokeKey(id: string): Promise<void> {
    this.error.set(null);
    try {
      await this.mcpKeys.revokeKey(id);
      await this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo revocar la clave');
    }
  }

  async copyNewKey(): Promise<void> {
    const key = this.newKey()?.apiKey;
    if (!key || !navigator.clipboard) return;
    await navigator.clipboard.writeText(key);
    this.copied.set(true);
  }
}