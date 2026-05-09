// Specification: docs/operations/ingest.md

import { access, readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import pino from 'pino';
import type { IdentifierType } from '../types';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.textile']);

export interface Identifier {
  createId(type: IdentifierType, text: string): string;
  decomposeId(id: string): { type: IdentifierType; slug: string };
}

export interface IngestConfig {
  maxSourceSize: number;
}

export class Ingest {
  private rawContent = '';
  private logger = pino({ name: 'ingest' });

  constructor(
    private identifier: Identifier,
    private config: IngestConfig,
  ) {}

  async process(filePath: string): Promise<void> {
    this.logger.info({ filePath }, 'Ingest process started');

    // 1. Read raw source completely
    await this.readRawSource(filePath);

    // 2. Discuss key takeaways with the human
    await this.discussKeyTakeaways();

    // 3. Write source page
    await this.writeSourcePage();

    // 4. Extract entities, concepts, claims, relationships
    await this.extract();

    // 5. Update all affected wiki pages
    await this.updateWikiPages();

    // 6. Trigger compile step
    await this.triggerCompile();

    // 7. Write log entry
    await this.writeLogEntry();
  }

  private async readRawSource(filePath: string): Promise<void> {
    await access(filePath);
    this.logger.info({ filePath }, 'File exists, reading raw source');

    const ext = extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      throw new Error(
        `Unsupported file type: ${ext}. Must be one of: ${[...TEXT_EXTENSIONS].join(', ')}`,
      );
    }

    const stats = await stat(filePath);
    if (stats.size > this.config.maxSourceSize) {
      throw new Error(
        `Source file exceeds maximum size (${stats.size} > ${this.config.maxSourceSize} bytes)`,
      );
    }

    const buffer = await readFile(filePath);
    if (buffer.includes(0)) {
      throw new Error('Source file appears to be binary');
    }

    this.rawContent = buffer.toString('utf-8');
    this.logger.info({ filePath, size: buffer.length }, 'Raw source read successfully');
  }

  private async discussKeyTakeaways(): Promise<void> {}

  private async writeSourcePage(): Promise<void> {}

  private async extract(): Promise<void> {}

  private async updateWikiPages(): Promise<void> {}

  private async triggerCompile(): Promise<void> {}

  private async writeLogEntry(): Promise<void> {}
}
