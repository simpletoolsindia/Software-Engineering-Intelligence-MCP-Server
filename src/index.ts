// Main entry point for the Software Engineering Intelligence MCP Server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import all capability tools
import { analysisTools } from './capabilities/analysis/analysis.js';
import { planningTools } from './capabilities/planning/planning.js';
import { executionTools } from './capabilities/execution/execution.js';
import { documentationTools } from './capabilities/documentation/documentation.js';
import { memoryTools } from './capabilities/memory/memory.js';

// Import resources
import { RESOURCE_LIST, readResource } from './resources/index.js';

// Import types and utilities
import { Verbosity } from './core/types.js';
import { logger } from './utils/index.js';

// ============================================================================
// Tool Registry
// ============================================================================

const allTools = {
  ...analysisTools,
  ...planningTools,
  ...executionTools,
  ...documentationTools,
  ...memoryTools
};

const toolNames = Object.keys(allTools) as (keyof typeof allTools)[];

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: '@software-engineering/mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = toolNames.map(name => {
    const tool = allTools[name];
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    };
  });

  logger.info(`Listing ${tools.length} tools`);
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = allTools[name as keyof typeof allTools];

  if (!tool) {
    logger.error(`Unknown tool requested: ${name}`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true
    };
  }

  try {
    logger.info(`Executing tool: ${name}`);
    const verbosity = (args as any)?.verbosity || 'minimal';
    const result = await tool.handler(args as any, verbosity as Verbosity);
    logger.info(`Tool ${name} completed successfully`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Tool ${name} failed: ${errorMessage}`);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMessage }) }],
      isError: true
    };
  }
});

// ============================================================================
// Resource Handlers
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  logger.info(`Listing ${RESOURCE_LIST.length} resources`);
  return { resources: RESOURCE_LIST };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  logger.info(`Reading resource: ${uri}`);

  const result = readResource(uri);

  if (!result) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Unknown resource: ${uri}` })
        }
      ]
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: result.mimeType,
        text: result.content
      }
    ]
  };
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Software Engineering Intelligence MCP Server started');
  logger.info(`Tools: ${toolNames.length} | Resources: ${RESOURCE_LIST.length}`);
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
