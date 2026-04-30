# Post-5/15 agenda

Items deferred past the 5/15 demo ship. Not a roadmap — a parking lot. Reorder when reality changes.

---

## Channel roadmap (preparer + client comms)

The orchestrator is channel-agnostic. Each new channel = MCP server with `receive_message` / `send_message` + Inbox Drafter tag for register. CLAUDE.md §6 locked **No WhatsApp in v1** for the 5/15 demo; this is where it comes back.

**Order (subject to Antonio's actual client message mix):**

1. **Slack bot** (~2-3 days, week 13-14)
   - Bolt SDK (TS). Slash commands + DMs + Block Kit for approval UI.
   - Antonio approves drafts from Slack mobile. Inline buttons: "Send as Antonio" / "Edit".
   - Free under 10k messages. Distribution-friendly for mentor's preparer network.

2. **WhatsApp Business API** (~5-10 days + 1-3 week Meta lead time, week 15-17)
   - Critical for Latino storefront EA segment (Antonio's lane).
   - Twilio wrapper. Pre-approved template messages for outbound. 24-hour session window for free-form.
   - Cost: ~$0.005-$0.08 per message. Meta business verification required.
   - Confirm Antonio's actual client WhatsApp volume before scheduling.

3. **Telegram** (~1-2 days, on-demand)
   - grammY (TS-native). DM-first + inline keyboards.
   - Only build when a partner asks. Less common in US tax world.

**Decision input needed from Antonio:** which channels do his clients ACTUALLY message him on today? Order matches real volume, not generic logic.

---
