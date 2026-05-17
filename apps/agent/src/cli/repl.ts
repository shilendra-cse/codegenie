import readline from "readline";
import type { ModelMessage } from "ai";
import { runAgent } from "../agent/run.js";

export function startRepl() {
  const chatContext: ModelMessage[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: ",
  });

  console.log("Welcome to CodeGenie AI Agent! Type 'exit' to quit.");
  rl.prompt();

  rl.on("line", async (line) => {
    const userPrompt = line.trim();

    if (userPrompt.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    if (!userPrompt) {
      rl.prompt();
      return;
    }

    chatContext.push({ role: "user", content: userPrompt });

    try {
      await runAgent(chatContext);
    } catch (error) {
      console.error("Agent error:", error);
    }

    rl.prompt();
  });
}
