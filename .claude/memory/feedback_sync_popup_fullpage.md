---
name: Sync popup and full page views
description: Always update both client detail dialog (popup) and client full page whenever making changes to either
type: feedback
---

When updating any feature on the client detail full page (clients/[id]/overview), ALWAYS also update the client detail dialog (popup) at components/client-detail-dialog.tsx, and vice versa. The two views must stay synced in development.

**Why:** User explicitly requested this after noticing the popup was missing features that the full page had (stage action cards, document status, feed actions). The popup is used from the Clients kanban board and the dashboard, while the full page is accessed via direct navigation.

**How to apply:** Before committing any client view changes, check both files and ensure feature parity. The popup is a condensed version but should have the same stage-specific cards, action feed, document status, and key functionality.
