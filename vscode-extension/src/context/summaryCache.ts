import { createHash } from 'crypto';
import { promises as fs } from 'fs';

export interface SectionSummary {
  summary: string;
  sourceHash: string;
  fileMtimeMs: number;
  updatedAt: number;
}

export interface FileSummaryRecord {
  filePath: string;
  fileHash: string;
  fileMtimeMs: number;
  sections: Map<string, SectionSummary>;
}

export class SummaryCache {
  private readonly files = new Map<string, FileSummaryRecord>();

  getSectionSummary(
    filePath: string,
    sectionId: string,
    fileMtimeMs?: number,
    fileHash?: string
  ): SectionSummary | undefined {
    const record = this.files.get(filePath);
    if (!record) {
      return undefined;
    }
    if (!this.isRecordFresh(record, fileMtimeMs, fileHash)) {
      return undefined;
    }
    return record.sections.get(sectionId);
  }

  upsertSectionSummary(filePath: string, sectionId: string, summary: SectionSummary): void {
    const record = this.ensureFileRecord(filePath);
    record.sections.set(sectionId, summary);
    record.fileMtimeMs = summary.fileMtimeMs;
    record.fileHash = summary.sourceHash;
  }

  invalidateFile(filePath: string): void {
    this.files.delete(filePath);
  }

  async refreshFileSummaries(
    filePath: string,
    summaries: Map<string, string>
  ): Promise<FileSummaryRecord> {
    const [fileHash, fileMtimeMs] = await Promise.all([
      this.hashFile(filePath),
      this.getFileMtimeMs(filePath)
    ]);

    const record: FileSummaryRecord = {
      filePath,
      fileHash,
      fileMtimeMs,
      sections: new Map()
    };

    const now = Date.now();
    summaries.forEach((summary, sectionId) => {
      record.sections.set(sectionId, {
        summary,
        sourceHash: fileHash,
        fileMtimeMs,
        updatedAt: now
      });
    });

    this.files.set(filePath, record);
    return record;
  }

  async isFileStale(filePath: string, content?: string): Promise<boolean> {
    const record = this.files.get(filePath);
    if (!record) {
      return true;
    }
    if (content) {
      return this.hashContent(content) !== record.fileHash;
    }
    const mtimeMs = await this.getFileMtimeMs(filePath);
    return mtimeMs > record.fileMtimeMs;
  }

  async hashFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf8');
    return this.hashContent(content);
  }

  hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async getFileMtimeMs(filePath: string): Promise<number> {
    const stat = await fs.stat(filePath);
    return stat.mtimeMs;
  }

  private ensureFileRecord(filePath: string): FileSummaryRecord {
    const existing = this.files.get(filePath);
    if (existing) {
      return existing;
    }
    const record: FileSummaryRecord = {
      filePath,
      fileHash: '',
      fileMtimeMs: 0,
      sections: new Map()
    };
    this.files.set(filePath, record);
    return record;
  }

  private isRecordFresh(
    record: FileSummaryRecord,
    fileMtimeMs?: number,
    fileHash?: string
  ): boolean {
    if (fileHash !== undefined) {
      return record.fileHash === fileHash;
    }
    if (fileMtimeMs !== undefined) {
      return record.fileMtimeMs >= fileMtimeMs;
    }
    return true;
  }
}
