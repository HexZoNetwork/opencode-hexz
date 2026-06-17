# Simulation: v1.5.0-features
Created: 2026-06-17T07:29:19.466Z

## Plan
Implement all 9 feature groups for HEXZ v1.5.0:

1. Fix insight system: Remove insight injection from chat.message (lines 811-816) and tool.execute.after (lines 917-919). Move insight to system prompt transform so model sees it as guidance only.

2. Add hexz_webss tool: New tool using capture-website npm package for website screenshots via Puppeteer. Add tool definition, args, and execute handler.

3. Implement hexz_image: Replace the stub (lines 1159-1174) with actual image analysis using tesseract.js for OCR.

4. Add capture-website + tesseract.js deps to package.json

5. Update install.sh for Puppeteer/Chromium

6. Expand persistent memory: Add project-level context storage, session summaries, error tracking

7. MCP server support: New hexz_mcp tool for MCP protocol

8. Git workflow automation: hexz_pr tool for PR creation, hook for git push

9. Auto test generation: Hook into file.edited

10. Multi-model routing via config

11. Design template file writer for hexz_design

## Files Affected
src/hexz.ts, package.json, install.sh, install.bat

## Status: PENDING REVIEW
Review the plan and files above. Check for:
- Edge cases and error states
- Breaking changes to other files
- Missing imports or dependencies
- Type mismatches
- Security implications

## Result
- [ ] Simulation reviewed
- [ ] Edge cases handled
- [ ] No breaking changes
- [ ] Ready to execute