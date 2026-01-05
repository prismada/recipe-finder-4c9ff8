import { query, type Options, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export const MCP_CONFIG: McpServerConfig = {
  type: "stdio",
  command: "npx",
  args: ["-y", "@anthropic-ai/mcp-server-puppeteer"],
};

export const ALLOWED_TOOLS = [
  "mcp__mcp__puppeteer_navigate",
  "mcp__mcp__puppeteer_screenshot",
  "mcp__mcp__puppeteer_click",
  "mcp__mcp__puppeteer_fill",
  "mcp__mcp__puppeteer_evaluate"
];

export const SYSTEM_PROMPT = `You are a recipe finder assistant. Use the puppeteer browser automation tools to search AllRecipes.com for recipes based on user requests. Navigate to allrecipes.com, search for the requested recipe, and extract relevant information including ingredients, instructions, ratings, and cooking times. Present the recipe information in a clear, organized format.`;

export function getOptions(standalone = false): Options {
  return {
    env: { ...process.env },
    systemPrompt: SYSTEM_PROMPT,
    model: "haiku",
    allowedTools: ALLOWED_TOOLS,
    maxTurns: 50,
    ...(standalone && { mcpServers: { mcp: MCP_CONFIG } }),
  };
}

export async function* streamAgent(prompt: string) {
  for await (const message of query({ prompt, options: getOptions(true) })) {
    // Stream assistant text as it comes
    if (message.type === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "text" && block.text) {
          yield { type: "text", text: block.text };
        }
      }
    }

    // Stream tool use info (what the agent is doing)
    if (message.type === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "tool_use") {
          yield { type: "tool", name: block.name };
        }
      }
    }

    // Usage stats
    if ((message as any).message?.usage) {
      const u = (message as any).message.usage;
      yield { type: "usage", input: u.input_tokens || 0, output: u.output_tokens || 0 };
    }

    // Final result
    if ("result" in message && message.result) {
      yield { type: "result", text: message.result };
    }
  }

  yield { type: "done" };
}
