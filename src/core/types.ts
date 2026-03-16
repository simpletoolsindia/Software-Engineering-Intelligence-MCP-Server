// Core type definitions for the Software Engineering Intelligence MCP Server

// ============================================================================
// Task Types
// ============================================================================

export type TaskType = 'analysis' | 'feature' | 'bug' | 'poc' | 'documentation' | 'mixed';

export interface TaskClassification {
  types: TaskType[];
  confidence: number;
  suggestedMode: 'analysis' | 'planning' | 'execution' | 'documentation';
  nextTools: string[];
}

// ============================================================================
// Verbosity Levels
// ============================================================================

export type Verbosity = 'minimal' | 'standard' | 'detailed';

// ============================================================================
// File and Symbol Index Types
// ============================================================================

export interface FileIndexEntry {
  path: string;
  name: string;
  extension: string;
  type: 'source' | 'test' | 'config' | 'doc' | 'other';
  language: string;
  size: number;
  lastModified: number;
  exports: string[];
  imports: string[];
}

export interface SymbolIndexEntry {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'variable' | 'method';
  file: string;
  line: number;
  exported: boolean;
  parameters?: string[];
  returnType?: string;
}

export interface ImportEdge {
  from: string;
  to: string;
  types: ('import' | 'require' | 'dynamic' | 'type')[];
}

export interface TestIndexEntry {
  path: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'other';
  targetFile?: string;
  targetSymbols: string[];
}

export interface DocIndexEntry {
  path: string;
  name: string;
  type: 'readme' | 'api' | 'guide' | 'changelog' | 'other';
  sections: string[];
  targets?: string[];
}

// ============================================================================
// Repository Index
// ============================================================================

export interface RepositoryIndex {
  files: Map<string, FileIndexEntry>;
  symbols: Map<string, SymbolIndexEntry[]>;
  imports: ImportEdge[];
  tests: TestIndexEntry[];
  docs: DocIndexEntry[];
  rootPath: string;
  lastIndexed: number;
}

// ============================================================================
// Retrieval Types
// ============================================================================

export interface ScopeQuery {
  task: string;
  taskType: TaskType;
  keywords?: string[];
  limit?: number;
}

export interface ScopedResult {
  files: FileIndexEntry[];
  modules: string[];
  symbols: SymbolIndexEntry[];
  tests: TestIndexEntry[];
  docs: DocIndexEntry[];
  confidence: number;
}

export interface RankedFile {
  file: FileIndexEntry;
  score: number;
  reason: string;
}

// ============================================================================
// Summarization Types
// ============================================================================

export interface FlowSummary {
  summary: string;
  steps: FlowStep[];
  keyFiles: string[];
  keySymbols: string[];
  entryPoint?: string;
  handle?: string;
}

export interface FlowStep {
  order: number;
  description: string;
  file: string;
  symbol?: string;
}

export interface BugTraceResult {
  likelyCauses: BugCause[];
  suspectFiles: string[];
  suspectSymbols: string[];
  confidence: number;
  handle?: string;
}

export interface BugCause {
  description: string;
  likelihood: number;
  type: 'missing_guard' | 'unsafe_state' | 'race_condition' | 'null_undefined' | 'type_mismatch' | 'logic_error' | 'other';
  file?: string;
  symbol?: string;
}

// ============================================================================
// Planning Types
// ============================================================================

export interface ImplementationPlan {
  steps: PlanStep[];
  editTargets: EditTarget[];
  requiredTests: string[];
  requiredDocs: string[];
  riskNotes: string[];
  handle?: string;
}

export interface PlanStep {
  order: number;
  description: string;
  file: string;
  action: 'create' | 'modify' | 'delete' | 'configure';
  dependencies?: string[];
}

export interface EditTarget {
  file: string;
  region?: string;
  description: string;
}

export interface POCPlan {
  goal: string;
  minimalArchitecture: string;
  filesToCreate: string[];
  shortcutsAllowed: string[];
  excludedScope: string[];
  mockStrategy: string;
  handle?: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ImpactAnalysis {
  affectedFiles: string[];
  affectedModules: string[];
  affectedSymbols: string[];
  regressionNotes: string[];
  riskyPoints: string[];
  relatedTests: string[];
  docsImpact: string[];
}

export interface TestSelection {
  requiredTests: TestInfo[];
  optionalTests: TestInfo[];
  reason: string;
}

export interface TestInfo {
  path: string;
  type: 'unit' | 'integration' | 'e2e';
  targetCoverage: string[];
}

// ============================================================================
// Documentation Types
// ============================================================================

export interface DocContext {
  featureSummary: string;
  currentBehavior: string;
  changedBehavior?: string;
  codeReferences: CodeReference[];
  examples: Example[];
  audienceNotes: Record<string, string>;
  handle?: string;
}

export interface CodeReference {
  file: string;
  symbol?: string;
  description: string;
}

export interface Example {
  title: string;
  code: string;
  language: string;
}

export interface DocUpdatePlan {
  docsToUpdate: DocUpdate[];
  docsToCreate: DocCreate[];
  sectionsToUpdate: string[];
  examplesNeeded: string[];
}

export interface DocUpdate {
  path: string;
  reason: string;
}

export interface DocCreate {
  path: string;
  purpose: string;
  template?: string;
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryCheckpoint {
  id: string;
  taskId: string;
  taskType: TaskType;
  timestamp: number;
  scope: MemoryScope;
  decisions: MemoryDecision[];
  risks: string[];
  pendingValidations: string[];
  pendingDocs: string[];
  notes: string;
}

export interface MemoryScope {
  files: string[];
  symbols: string[];
  modules: string[];
}

export interface MemoryDecision {
  description: string;
  rationale: string;
  timestamp: number;
}

export interface MemoryRestoreResult {
  checkpoint: MemoryCheckpoint;
  currentScope: MemoryScope;
  progressSummary: string;
  unresolvedItems: string[];
}

// ============================================================================
// Tool Response Wrappers
// ============================================================================

export interface ToolResponse<T> {
  data: T;
  verbosity: Verbosity;
  fields?: string[];
  handle?: string;
}

export interface CompactHandle {
  handle: string;
  fields?: string[];
}