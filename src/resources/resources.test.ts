// Tests for resources module
import { describe, it, expect } from 'vitest';
import {
  RESOURCE_LIST,
  RESOURCE_URIS,
  readResource,
  buildArchitectureMap,
  buildGlossary,
  buildPatterns
} from '../resources/resources.js';

describe('RESOURCE_LIST', () => {
  it('exposes 7 resources', () => {
    expect(RESOURCE_LIST.length).toBe(7);
  });

  it('all resources have uri, name, description, mimeType', () => {
    for (const r of RESOURCE_LIST) {
      expect(r.uri).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(r.mimeType).toBe('application/json');
    }
  });

  it('all RESOURCE_URIS are present in RESOURCE_LIST', () => {
    const listUris = new Set(RESOURCE_LIST.map(r => r.uri));
    for (const uri of Object.values(RESOURCE_URIS)) {
      expect(listUris.has(uri)).toBe(true);
    }
  });
});

describe('readResource', () => {
  it('returns null for unknown URI', () => {
    expect(readResource('repo://does-not-exist')).toBeNull();
  });

  it('returns valid JSON content for each known resource', () => {
    for (const uri of Object.values(RESOURCE_URIS)) {
      const result = readResource(uri);
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe('application/json');
      // Should be valid JSON
      expect(() => JSON.parse(result!.content)).not.toThrow();
    }
  });

  it('returns error message when no index exists', () => {
    const result = readResource(RESOURCE_URIS.ARCHITECTURE_MAP);
    const parsed = JSON.parse(result!.content);
    expect(parsed.error).toBeTruthy();
  });
});

describe('resource builders - no index', () => {
  it('buildArchitectureMap returns error object when no index', () => {
    const result = buildArchitectureMap() as any;
    expect(result.error).toBeTruthy();
  });

  it('buildGlossary returns error object when no index', () => {
    const result = buildGlossary() as any;
    expect(result.error).toBeTruthy();
  });

  it('buildPatterns returns error object when no index', () => {
    const result = buildPatterns() as any;
    expect(result.error).toBeTruthy();
  });
});
