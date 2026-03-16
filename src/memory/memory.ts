// Memory System - Store and restore task checkpoints
import * as fs from 'fs';
import {
  MemoryCheckpoint,
  MemoryScope,
  MemoryDecision,
  MemoryRestoreResult,
  TaskType
} from '../core/types.js';

export class MemoryStore {
  private checkpoints: Map<string, MemoryCheckpoint> = new Map();
  // taskId → sorted list of checkpoint IDs (latest last) — O(1) latest lookup
  private taskIndex:   Map<string, string[]>          = new Map();
  private storagePath: string | null = null;

  initialize(options?: { storagePath?: string }) {
    if (options?.storagePath) {
      this.storagePath = options.storagePath;
      this.load();
    }
  }

  saveCheckpoint(checkpoint: Omit<MemoryCheckpoint, 'id' | 'timestamp'>): MemoryCheckpoint {
    const full: MemoryCheckpoint = { ...checkpoint, id: this.generateId(), timestamp: Date.now() };
    this.checkpoints.set(full.id, full);
    // Update taskId index
    const ids = this.taskIndex.get(full.taskId) ?? [];
    ids.push(full.id);
    this.taskIndex.set(full.taskId, ids);
    this.persist();
    return full;
  }

  getCheckpoint(id: string): MemoryCheckpoint | null {
    return this.checkpoints.get(id) ?? null;
  }

  getAllCheckpoints(): MemoryCheckpoint[] {
    return [...this.checkpoints.values()];
  }

  /** O(1) — reads last entry from taskIndex instead of scanning all checkpoints */
  getLatestForTask(taskId: string): MemoryCheckpoint | null {
    const ids = this.taskIndex.get(taskId);
    if (!ids || ids.length === 0) return null;
    return this.checkpoints.get(ids[ids.length - 1]) ?? null;
  }

  deleteCheckpoint(id: string): boolean {
    const cp = this.checkpoints.get(id);
    if (!cp) return false;
    this.checkpoints.delete(id);
    // Remove from taskIndex
    const ids = this.taskIndex.get(cp.taskId);
    if (ids) {
      const idx = ids.indexOf(id);
      if (idx !== -1) ids.splice(idx, 1);
      if (ids.length === 0) this.taskIndex.delete(cp.taskId);
    }
    this.persist();
    return true;
  }

  restore(id: string): MemoryRestoreResult | null {
    const checkpoint = this.getCheckpoint(id);
    if (!checkpoint) return null;
    return {
      checkpoint,
      currentScope:    checkpoint.scope,
      progressSummary: this.buildProgressSummary(checkpoint),
      unresolvedItems: [...checkpoint.pendingValidations, ...checkpoint.pendingDocs]
    };
  }

  updateCheckpoint(id: string, updates: Partial<MemoryCheckpoint>): boolean {
    const existing = this.checkpoints.get(id);
    if (!existing) return false;
    this.checkpoints.set(id, { ...existing, ...updates });
    this.persist();
    return true;
  }

  clear(): void {
    this.checkpoints.clear();
    this.taskIndex.clear();
    this.persist();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private generateId(): string {
    return `cp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private buildProgressSummary(cp: MemoryCheckpoint): string {
    const parts = [
      `Task: ${cp.taskType}`,
      `Files in scope: ${cp.scope.files.length}`,
      `Decisions made: ${cp.decisions.length}`,
      `Risks identified: ${cp.risks.length}`
    ];
    if (cp.pendingValidations.length > 0) parts.push(`Pending validations: ${cp.pendingValidations.length}`);
    if (cp.pendingDocs.length > 0)        parts.push(`Pending docs: ${cp.pendingDocs.length}`);
    return parts.join(' | ');
  }

  private persist(): void {
    if (!this.storagePath) return;
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify([...this.checkpoints.entries()], null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist memory:', err);
    }
  }

  private load(): void {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
    try {
      const entries = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8')) as [string, MemoryCheckpoint][];
      this.checkpoints = new Map(entries);
      // Rebuild taskIndex from loaded data
      this.taskIndex.clear();
      for (const [id, cp] of this.checkpoints) {
        const ids = this.taskIndex.get(cp.taskId) ?? [];
        ids.push(id);
        this.taskIndex.set(cp.taskId, ids);
      }
    } catch (err) {
      console.error('Failed to load memory:', err);
    }
  }
}

export function createCheckpoint(options: {
  taskId: string;
  taskType: TaskType;
  scope: MemoryScope;
  decisions?: MemoryDecision[];
  risks?: string[];
  pendingValidations?: string[];
  pendingDocs?: string[];
  notes?: string;
}): Omit<MemoryCheckpoint, 'id' | 'timestamp'> {
  return {
    taskId:             options.taskId,
    taskType:           options.taskType,
    scope:              options.scope,
    decisions:          options.decisions          ?? [],
    risks:              options.risks              ?? [],
    pendingValidations: options.pendingValidations ?? [],
    pendingDocs:        options.pendingDocs        ?? [],
    notes:              options.notes              ?? ''
  };
}

let memoryStoreInstance: MemoryStore | null = null;

export function getMemoryStore(): MemoryStore {
  if (!memoryStoreInstance) memoryStoreInstance = new MemoryStore();
  return memoryStoreInstance;
}
