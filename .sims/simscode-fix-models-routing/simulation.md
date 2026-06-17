# Simulation: fix-models-routing
Created: 2026-06-17T08:44:23.293Z

## Plan
Fix the /models TUI routing and add visible command entry:

1. Add readLine() function for proper text input (handles backspace, ctrl+c, enter)
2. Fix showModelRoutingTUI() to use readLine() instead of readKey() for model name and keyword text entry
3. Clean up duplicate setRawMode calls (rr() in renderMenu + readKey/readLine both set it)
4. Update SYSTEM_PROMPT to include /models, /active, /off commands so users know about them

Root causes:
- readKey() reads only 1 char, making "Add Route" text entry unusable
- No visible help text for /models command or Ctrl+P shortcut

## Files Affected
/home/hexzo/opencode-hexz/src/hexz.ts

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