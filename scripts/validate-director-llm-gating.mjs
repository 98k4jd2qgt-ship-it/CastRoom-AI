import fs from "node:fs";

function fail(message) {
  console.error(`Director LLM gating validation failed:\n- ${message}`);
  process.exit(1);
}

function mustInclude(text, marker, message) {
  if (!text.includes(marker)) fail(`${message}: ${marker}`);
}

const main = fs.readFileSync("src/main.ts", "utf8");

mustInclude(main, "shouldUseLiveDirectorTurnPlan(request, localResult.plan)", "Director LLM is gated before live plan creation");
mustInclude(main, "function shouldUseLiveDirectorTurnPlan", "Director LLM gating helper exists");
mustInclude(main, 'fallback.intent === "group_opinion" && mode === "casual"', "casual group opinion should skip the cloud planner");
mustInclude(main, 'roomContextBudget(request.room) === "full"', "full budget always allows live Director");
mustInclude(main, "/Developer Director Channel(?: Public Narration Request)?:/i.test", "developer Director Channel and explicit public narration requests can force live Director");
mustInclude(main, 'localPlan.move === "judge"', "action ruling can force live Director");
mustInclude(main, "shouldCommitDirectorPublicText(localPlan)", "public narration/ruling can force live Director");
mustInclude(main, 'mode === "story" || mode === "mystery" || mode === "debate"', "complex modes can force live Director");
mustInclude(main, "You are the CastRoom AI Room Director lightweight observation pass.", "lightweight Director prompt exists");
mustInclude(main, "compactDirectorLocalPlanForPrompt(localPlan)", "lightweight Director prompt uses compact local plan");

console.log("Director LLM gating validation passed.");
