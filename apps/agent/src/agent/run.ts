import { generateText, stepCountIs, type ModelMessage } from "ai";
import { model } from "./model.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { agentTools } from "../tools/index.js";

export async function runAgent(chatContext: ModelMessage[]) {
  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages: chatContext,
    tools: agentTools,
    onStepFinish({ text, toolCalls, toolResults, finishReason }) {
      console.log("--------------------------------------------------");
      console.log("toolCalls:", toolCalls);
      console.log("toolResults:", toolResults);
      console.log("finishReason:", finishReason);
      console.log("AI:", text);
      console.log("--------------------------------------------------\n");

      toolCalls.forEach((call, index) => {
        chatContext.push({
          role: "user",
          content: `Tool Call: ${call.toolName} with input ${JSON.stringify(call.input)}`,
        });
        chatContext.push({
          role: "assistant",
          content: `Tool Result: ${JSON.stringify(toolResults[index])}`,
        });
      });
    },
    stopWhen: stepCountIs(10),
  });

  console.log("AI:", result.text);
  chatContext.push({ role: "assistant", content: result.text });

  return result;
}
