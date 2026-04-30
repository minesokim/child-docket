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

## Document scanning — capture polish (post-5/15)

The 4-phase docs-upload UX (empty → AI scanning → retake → parsed) ships in v0 with **vanilla `<input type="file" accept="image/*" capture="environment">`** + Sonnet 4.6 vision for extraction. The AI feedback loop (retake on low confidence, field-by-field missing-data prompts) is the actual moat. Camera UX polish is layer 2.

**If Antonio reports upload quality issues from clients, layer in:**

- **jscanify** ([colonelparrot/jscanify](https://github.com/ColonelParrot/jscanify)) — MIT, OpenCV.js WASM (~8MB), drops into Next.js. Auto edge detection + corner highlights + perspective correction in the browser. Tradeoff: WASM cold start, fragile detection on cluttered backgrounds.
- Or **roll our own** with OpenCV.js using jscanify's source as reference. Lets us tune the auto-capture stability heuristic (N stable frames before snap).

**Only if we ever ship a native shell (v2+, not on roadmap):**

- `@dariyd/react-native-document-scanner` (MIT, updated, new RN architecture) — wraps Apple VisionKit `VNDocumentCameraViewController` (iOS) + Google ML Kit Document Scanner (Android). Both platform APIs are free and ship the full auto-capture UX you see in banking apps.

**Explicit NOs:**

- Scanbot SDK / Genius Scan SDK — commercial, expensive. Don't pay for capture polish when scanning isn't our wedge.
- Building our own native scanner from scratch — wrong layer of the stack to compete on.

**Reference apps for design study:** MakeACopy (Apache 2.0, ONNX corner detection), OSS Document Scanner (F-Droid).

---
