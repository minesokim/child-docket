# Twilio Conference Merge-Call — Capability Verification

**Date:** 2026-05-14
**Author:** Architecture research
**Audience:** Docket engineering (call recording subsystem)
**Status:** Verified — ship-ready architecture identified

---

## TL;DR

Docket's claimed UX ("Antonio taps a button mid-call and Docket joins as a third party")
**does work**, but the load-bearing mechanism is **not** Twilio injecting itself into a
cell-to-cell call. Twilio has no such capability — it cannot reach into a PSTN call that
neither leg originated on its network. The actual mechanism is the **handset's native
3-way merge** (iPhone "Add Call" + "Merge Calls"; Android equivalent). Antonio's carrier
does the bridging at the network switch. Twilio shows up at the merge point as a normal
inbound PSTN call to a Docket-provisioned Twilio number, plays the consent disclosure,
and records from join-point forward via `<Dial><Conference record="record-from-start">`.

This still demands a clean implementation: a TwiML app that answers, plays the announcement,
joins a uniquely-named Conference, records dual-channel, and ships the recording to
Conversational Intelligence for transcription. It is a 1-2 sprint build, not a multi-month
research project. Architectural recommendation: **ship the merge-call pattern (Option A1)
first** because it preserves the native call UX preparers already know, and follow with
Option A2 (both legs through Twilio from the start) as the higher-quality power-user mode.

---

## 1. The core question: can Twilio join an in-progress cell-to-cell call?

**Strictly speaking, no.** Twilio has no capability to inject a third leg into a phone call
whose A and B legs both live entirely on carrier infrastructure outside Twilio's network.
There is no API surface — REST, TwiML, SIP, or otherwise — that lets a Twilio process
seize an existing PSTN call session.

Verified across:
- [Voice Conference docs](https://www.twilio.com/docs/voice/conference): conferences are
  created when "the first participant connects to the Conference" — i.e. dials into a
  Twilio number or is dialed by Twilio.
- [Warm-Transfer tutorial](https://www.twilio.com/docs/voice/tutorials/warm-transfer): the
  prerequisite is that the original call hit "your Twilio number." There is no flow where
  Twilio jumps into a call that didn't start on its network.
- [Multi-Party Calls with VoIP and GSM](https://www.twilio.com/en-us/blog/multi-party-calls-voip-gsm-programmable-voice):
  "Twilio cannot inject itself into existing calls." Cell users are added either by Twilio
  dialing them or by them dialing a Twilio number.
- [Connect Call To widget](https://www.twilio.com/docs/studio/widget-library/connect-call):
  bridges work on calls already in the Twilio fabric, not arbitrary external sessions.

**But the UX still works.** The handset's native 3-way calling is the bridge. From neither
Android nor iOS does any third-party app get access to in-progress call signaling — the
3-way merge happens at the carrier's network switch, not on the device
(see [Bubblyphone 3-way detection guide](https://bubblyphone.com/hub/detect-3-way-call)).
So Docket cannot programmatically initiate the merge from a mobile app either. The
preparer has to physically tap "Add Call" → dial Docket → tap "Merge Calls." From Twilio's
perspective it then sees a normal inbound PSTN call to its number; from the carrier's
perspective the three legs are bridged at the switch.

This is the same mechanism legacy TapeACall and similar apps use, and it's what compliant
clinical/legal call-recording services have run on for a decade. It works on Verizon,
AT&T, T-Mobile VoLTE — though some prepaid carriers (SimpleTalk, H2O Wireless) disable
3-way calling and that breaks the entire flow.

---

## 2. The Conference API flow (verbatim from docs)

### TwiML to enter a conference (what Docket's webhook returns when the merge hits)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Joining for note-taking. Recording starts now.
  </Say>
  <Dial>
    <Conference
      record="record-from-start"
      recordingChannels="dual"
      recordingStatusCallback="https://api.docket.dev/twilio/recording-status"
      recordingStatusCallbackEvent="completed"
      statusCallback="https://api.docket.dev/twilio/conf-status"
      statusCallbackEvent="start end join leave"
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="false"
      trim="trim-silence"
      participantLabel="docket-recorder">
      ${UNIQUE_CONFERENCE_NAME}
    </Conference>
  </Dial>
</Response>
```

Source: [TwiML Voice: &lt;Conference&gt;](https://www.twilio.com/docs/voice/twiml/conference) —
all attributes (`record`, `recordingChannels`, `recordingStatusCallback`,
`statusCallbackEvent`, `participantLabel`, `beep`, `trim`) are documented there.

### REST: add a participant to an in-progress conference (for Option A2, outbound-dial pattern)

```
POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants.json

From: +15555550100              (Docket's Twilio number)
To: +14155551234                (Client's cell)
EarlyMedia: true
Beep: false
StartConferenceOnEnter: true
EndConferenceOnExit: false
Record: true
ConferenceRecord: record-from-start
RecordingChannels: dual
RecordingTrack: both
Label: client
StatusCallback: https://api.docket.dev/twilio/participant-status
StatusCallbackEvent: initiated ringing answered completed
```

Source: [Conference Participants subresource](https://www.twilio.com/docs/voice/api/conference-participant-resource).

### Mid-call announcement (the disclosure beep)

```
POST /Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants/{CallSid}.json
AnnounceUrl: https://api.docket.dev/twilio/twiml/disclosure
AnnounceMethod: GET
```

Where the announce URL returns:

```xml
<Response>
  <Say voice="Polly.Joanna">
    For accuracy, this call is being recorded for note-taking.
  </Say>
</Response>
```

Source: [Twilio Conference Announcements](https://www.twilio.com/en-us/blog/twilio-conference-now-supports-announcements-html).

### Webhook payload for recording completion

When `RecordingStatus=completed` fires, Twilio POSTs:

```
RecordingSid=REabc...
RecordingUrl=https://api.twilio.com/.../Recordings/REabc...
RecordingStatus=completed
RecordingDuration=423
RecordingChannels=2
ConferenceSid=CFxyz...
AccountSid=ACdef...
```

Source: [Recordings resource](https://www.twilio.com/docs/voice/api/recording).

---

## 3. The working patterns for Docket's use case

### Option A1 — Native merge-call (preparer-initiated, handset 3-way)

**Flow:**
1. Antonio is mid-call with a client (carrier-to-carrier, no Twilio involvement yet).
2. Antonio taps **Add Call** on his handset, dials his Docket-provisioned Twilio number
   (or a short shortcode like `*82DOCKET` if his carrier supports star-codes).
3. Docket's TwiML webhook answers, plays "Joining for note-taking — recording starts now,"
   and `<Dial><Conference>`s into a uniquely-named conference (e.g. `docket-{userId}-{ts}`).
4. Antonio taps **Merge Calls**. Carrier switch bridges all three legs.
5. Twilio records from this point forward (audio of Antonio + Docket's silent leg in one
   channel; client audio bleeds through Antonio's handset mic on the same channel —
   see "recording mechanism" caveat below).
6. When the call ends (any participant hangs up), `endConferenceOnExit="true"` tears down
   the Twilio side; carrier ends the call legs as normal.

**Pros:**
- Preparer keeps the native dialer UX they already use.
- Zero impact if the client doesn't pick up or call is short — no new flow.
- Works for inbound calls from clients (preparer doesn't have to remember to use Docket
  before answering).
- Cheapest per-call (one inbound PSTN leg + conference + recording).

**Cons:**
- **Single audio channel for both parties.** Twilio only sees Antonio's leg; the client's
  voice arrives as a mix on Antonio's microphone. Speaker diarization quality suffers.
  `dual` channel here separates "Antonio's handset (which contains the client too)" from
  "the empty Docket leg" — not very useful.
- Depends on the carrier supporting 3-way calling. Most US postpaid does; many prepaid
  doesn't.
- The "tap to record" gesture is two taps + a dial, not one button.
- Discloses recording only to whoever is still on the line at merge time (usually fine,
  but if Antonio re-merges later the disclosure won't replay automatically).

### Option A2 — Both legs through Twilio from the start

**Flow:**
1. Antonio opens Docket, taps **Start Recorded Call**, picks a client.
2. Docket places a `POST /Calls` to Twilio dialing **Antonio's** cell from Docket's Twilio
   number. TwiML on answer: `<Dial><Conference>`.
3. As soon as Antonio's leg is connected, Docket places `POST /Conferences/{sid}/Participants`
   to dial the **client**, also placing them in the same conference with disclosure
   announcement.
4. When the client answers, disclosure plays only to them ("This call is being recorded
   by your tax preparer for note-taking"). Both parties hear the conference.
5. Recording is `recordingChannels="dual"` — Antonio on channel 1, client on channel 2.
   Speaker diarization is essentially solved.

**Pros:**
- **True dual-channel recording** — vastly better transcription accuracy and speaker
  attribution. Twilio's own Conversational Intelligence
  ([docs](https://www.twilio.com/docs/voice/intelligence/api/transcript-resource))
  doesn't do speaker diarization on mono, only on dual.
- One-tap start from the Docket app.
- Disclosure plays to each party at their join point (more legally defensible in
  2-party-consent states).
- Recording always starts at minute zero — no "I forgot to merge" gap.

**Cons:**
- Antonio's outbound caller-ID is Docket's Twilio number, not his personal cell.
  Mitigation: provision per-user "personal Twilio numbers" or use `CallerId` parameter to
  spoof Antonio's number on the outbound leg (FCC STIR/SHAKEN allows this for
  legitimate-business CNAM with proper attestation, but it requires Twilio's "Verified
  Caller ID" or trusted-comms setup).
- Two PSTN legs at all times: outbound to Antonio + outbound to client. ~2x the per-minute
  voice cost vs. Option A1.
- Antonio must initiate from the app — won't work for inbound calls from clients without
  also routing those to Docket first.

### Tradeoff summary

|                                   | A1 (handset merge)         | A2 (both legs through Twilio) |
|-----------------------------------|----------------------------|-------------------------------|
| Antonio UX                        | Native dialer + 2 taps     | One tap in Docket app         |
| Outbound caller ID                | Antonio's real number      | Docket's number (configurable)|
| Inbound calls from client         | Works (Antonio merges)     | Doesn't work without IVR      |
| Recording audio quality           | Mono mix on one leg        | True dual-channel             |
| Speaker diarization               | Poor                       | Native (per-channel)          |
| Disclosure heard by client        | Only at merge moment       | At each party's join point    |
| Cost per minute                   | ~$0.020                    | ~$0.038                       |
| Carrier dependency                | Yes (3-way must work)      | No                            |

---

## 4. Recording mechanism

Twilio supports two recording surfaces:

- **Call recording** (per-leg): `POST /Calls/{CallSid}/Recordings.json` or TwiML
  `<Start><Recording>` — captures only the audio of that specific call leg.
- **Conference recording** (mixed): set `record="record-from-start"` on the
  `<Conference>` TwiML or `ConferenceRecord=record-from-start` when adding a participant
  via REST. Twilio mixes all participants and records the conference as a whole.

**Critical detail — dual-channel semantics in a Conference:**
From Twilio's [Recordings docs](https://www.twilio.com/docs/voice/api/recording):
"For a Conference, the Recording's dual-channel media file contains the audio of the first
participant that joined the Conference in the first channel and all other audio from the
Call mixed in the second channel."

That is: dual-channel for conference recording is **first-joiner vs. everyone-else mixed**.
This is fine for A2 (Antonio joins first → he's alone on ch1; client lands on ch2 alone
because there's no one else to mix with him yet). It is **not** fine for A1 because the
"first participant" is Antonio's leg which already contains both Antonio and the client
mixed by the carrier.

**Storage and retrieval:** Twilio stores recordings for the lifetime of the account by
default. Docket should pull them via the `RecordingUrl` webhook on completion, transfer
to its own S3/R2 with KMS encryption, and delete from Twilio (calls `DELETE`
on the Recording resource) for HIPAA defense-in-depth. Recording storage at Twilio is
$0.0005/min/month — cheap enough to keep as backup, but Docket's record of truth should
be its own bucket.

**Transcription:** two options:
- Built-in **Conversational Intelligence** (formerly Voice Intelligence) — Twilio's
  managed transcription with language operators for sentiment, summary, PII redaction
  ([docs](https://www.twilio.com/docs/voice/intelligence/api/transcript-resource)).
  Easier to wire but expensive at scale.
- BYO transcription — pipe `RecordingUrl` to Deepgram/Whisper/AssemblyAI. Cheaper and
  gives Docket control over diarization and prompting. Recommend this once volume > 10k
  min/mo.

---

## 5. 2-party consent handling

The disclosure mechanism is straightforward. The legal posture is the load-bearing part.

### Disclosure timing

- **Option A1:** Disclosure plays at the moment Docket answers Antonio's dial-in,
  *before* Antonio taps Merge. So when Antonio actually merges, the client hears no
  announcement from Docket — but Antonio has heard "Recording starts now" and is the
  party physically inviting Docket into the call. Defensible if Antonio also says aloud
  to the client "I'm going to start recording for our notes" before merging.
  Recommendation: ship a coach prompt in the Docket app reminding Antonio to verbally
  disclose.
- **Option A2:** Disclosure plays to each party as they join (use the `announceUrl` on
  the Participant resource — fires only to the new participant, not the existing
  conference). Cleaner because each party explicitly hears the disclosure.

### State-by-state law (current as of 2026)

Twelve **all-party** ("two-party") consent states as of 2026
([Recording Law 2026 guide](https://www.recordinglaw.com/party-two-party-consent-states/)):

- California
- Connecticut
- Delaware
- Florida
- Illinois
- Maryland
- Massachusetts
- Michigan
- Montana
- New Hampshire
- Oregon
- Pennsylvania
- Washington

The brief asked about CA, FL, IL, MA, MD, MT, NV, NH, PA, WA. **Nevada is technically a
"one-party" state but the Nevada Supreme Court has interpreted its wiretap statute to
require all-party consent for in-state calls**, so treat it as 2-party for safety.

Cross-state calls (preparer in TX talking to client in CA) default to the **stricter**
state's law. Docket should treat its compliance bar as: **assume all-party consent always
required.** This is what every compliant CRM/recording vendor does (Gong, Chorus, etc.).

### Implementation requirements for defensibility

1. **Audible announcement** before recording starts. Done by TwiML `<Say>` at conference
   entry (above).
2. **Logged consent timestamp** stored against the recording row. The
   `RecordingStartTime` from Twilio's webhook is sufficient.
3. **Per-state opt-in** in Docket settings: a preparer in a 1-party state may want to
   skip the audible announcement (faster UX). Default off; require explicit acknowledgment
   to disable.
4. **Client opt-out** path: if the client says "please don't record," Antonio taps a
   button that POSTs to `Recordings/{Sid}` with `Status=stopped` and deletes any audio
   captured to that point. Recording can be stopped, paused, resumed via the Recording
   Controls API ([Twilio Support](https://support.twilio.com/hc/en-us/articles/360010199074-Getting-Started-with-Call-Recording-Controls)).

---

## 6. Pricing at Docket scale

Verified rates from [Twilio Voice Pricing US](https://www.twilio.com/en-us/voice/pricing/us)
and [Conference Pricing](https://www.twilio.com/en-us/voice/conference/pricing):

| Component                              | Rate                          |
|----------------------------------------|-------------------------------|
| Inbound PSTN to local Twilio number    | $0.0085 / min                 |
| Outbound PSTN to US cell/landline      | $0.0140 / min                 |
| Conference participant                 | $0.0018 / min (first 100k)    |
| Conference (volume tier, 100M+ min/mo) | $0.0010 / min                 |
| Recording                              | $0.0025 / min                 |
| Recording storage                      | $0.0005 / min / month         |
| Voice transcription (batch)            | $0.024 / min                  |
| Voice transcription (real-time stream) | $0.027 / min                  |
| Phone number rental (local US)         | $1.15 / month                 |

### Per-call cost — Option A1 (handset merge)

A 20-minute recorded call:

- 1 inbound PSTN leg (Antonio's dial-in to Twilio): 20 × $0.0085 = $0.170
- 1 conference participant (Antonio's leg only — Docket's bot is the conference itself):
  20 × $0.0018 = $0.036
- Recording: 20 × $0.0025 = $0.050
- Transcription (BYO Deepgram nova-3 at $0.0043/min): 20 × $0.0043 = $0.086
- **Per-call: ~$0.34**

### Per-call cost — Option A2 (both legs)

Same 20-minute call:

- 1 outbound to Antonio: 20 × $0.0140 = $0.280
- 1 outbound to client: 20 × $0.0140 = $0.280
- 2 conference participants: 40 × $0.0018 = $0.072
- Recording: 20 × $0.0025 = $0.050
- Transcription (BYO): 20 × $0.0043 = $0.086
- **Per-call: ~$0.77**

### At scale (1,000 preparers, 10 recorded calls/day each, 20 min avg, 22 work days/mo)

- Calls/month: 220,000
- Minutes/month: 4.4M

| Pattern | Monthly cost | Per-preparer/mo |
|---------|--------------|------------------|
| A1      | ~$75k        | ~$75             |
| A2      | ~$170k       | ~$170            |

Cost of phone numbers if Docket issues per-preparer Twilio numbers (required for A2 with
clean caller-ID): 1,000 × $1.15 = $1,150/mo. Negligible.

**Pricing takeaway:** Even A2 is well inside reasonable margins for a SaaS at Docket's
positioning. The recording + transcription are by far the smaller line items vs. raw PSTN
minutes.

---

## 7. Latency benchmarks

From [Twilio's latency post](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)
and [PDD support article](https://support.twilio.com/hc/en-us/articles/360025824413-Troubleshooting-Post-Dial-Delay-PDD-and-Delayed-Ringing-on-Twilio-Calls):

- **Twilio voice agent median latency:** < 0.5s, p95 < 0.725s (Nov 2025 figures).
- **PSTN post-dial delay (PDD)** in the US: typically 1-3s; > 6s is considered carrier-
  escalation territory.
- **TwiML webhook execution:** sub-100ms if Docket's webhook is hosted in the same region
  as Twilio's edge (us-east-1 / us1 for Twilio).

### End-to-end "Antonio taps Merge" → "Docket is bridged and recording" for Option A1

| Phase                                                | Time   |
|------------------------------------------------------|--------|
| Antonio dials Docket number from handset              | 0.0s   |
| Carrier setup + Twilio answers                        | 1.5-3s |
| TwiML returned, `<Say>` disclosure plays (4 words)    | 1.5s   |
| `<Dial><Conference>` joins, recording begins          | 0.2s   |
| Antonio taps Merge Calls (manual)                     | 1-3s   |
| Carrier bridges three legs                            | 0.5s   |
| **Total Antonio-perceived "tap to recording active":**| **~5-8s** |

For Option A2 the total is ~3-5s from "tap in app" to "both legs ringing." Faster because
no handset 3-way ballet.

---

## 8. Architectural recommendation for Docket

**Ship Option A1 (handset merge) first. Plan A2 as the v2 power-user mode within 1-2
quarters.**

Reasoning:
1. **A1 has fewer dependencies on the preparer changing behavior.** Preparers already
   know how to merge calls. Asking them to dial through the Docket app at the start of
   every call is a behavior change Docket has to earn.
2. **A1 captures inbound calls.** If a client calls Antonio, Antonio can still merge
   Docket in mid-call. A2 requires the preparer to call out from the app, which loses
   inbound coverage.
3. **A1's audio quality is sufficient for v1.** Mono mix is "good enough" for tax-prep
   note-taking with Whisper/Deepgram; speakers can be inferred by content even without
   per-channel separation. The diarization quality gap will become visible at scale —
   that's when A2 earns its keep.
4. **A1's failure modes are visible to the preparer.** If carrier doesn't support 3-way,
   the merge fails on the handset, Antonio knows immediately. A2 failures (e.g. caller-ID
   rejected) happen invisibly to the preparer.
5. **A2's outbound caller-ID is a brand and compliance headache.** STIR/SHAKEN attestation
   for tax-preparer-on-behalf-of-firm is solvable but it's a real workstream that adds
   2-4 weeks. Ship A1, learn what preparers actually do, then commit to A2.

**A2 becomes the recommended path when:**
- Preparers tell us "I forget to merge half the time" (signal that the in-app one-tap is
  worth the friction).
- Transcript quality complaints crystallize around "who said what" rather than what was
  said (signal that dual-channel matters).
- We've earned the right to be the preparer's primary dialer.

---

## 9. Implementation outline

### Components

1. **Conference name allocator** — generates unique conference names per call.
   Pattern: `docket-{preparerId}-{shortHash}`. Twilio docs explicitly warn not to use
   PII in conference names ([TwiML Conference](https://www.twilio.com/docs/voice/twiml/conference)),
   so no client name / phone number.
2. **TwiML webhook** at `POST /twilio/voice/incoming` — returns the disclosure +
   `<Dial><Conference>` TwiML when Antonio dials in. Identifies Antonio by his
   `From` number, mapped to his Docket user via a `preparer_phone` table.
3. **Status callback handler** at `POST /twilio/conf-status` — receives
   `participant-join`, `conference-end`, `recording-completed` events. Writes to
   `call_session` table.
4. **Recording fetcher** — on `recording-completed` webhook, downloads from `RecordingUrl`
   to Docket's R2 bucket with KMS encryption, then DELETEs from Twilio.
5. **Transcription pipeline** — pushes audio to Deepgram (or BYO ASR), stores diarized
   transcript on the call record.
6. **Filing engine** — extracts entities, ties transcript to client tax file
   (this is Docket's normal post-call pipeline).

### Webhook handlers (TypeScript / Hono)

```typescript
// POST /twilio/voice/incoming — Antonio dials Docket from his cell
app.post('/twilio/voice/incoming', async (c) => {
  const { From, CallSid } = await c.req.parseBody()
  const preparer = await db.preparer.findByPhone(From)
  if (!preparer) {
    return c.body(reject(), 200, { 'content-type': 'text/xml' })
  }

  const confName = `docket-${preparer.id}-${nanoid(8)}`
  await db.callSession.create({
    preparerId: preparer.id,
    twilioCallSid: CallSid,
    conferenceName: confName,
    status: 'initiated',
  })

  return c.body(
    twiml`<Response>
      <Say voice="Polly.Joanna">For accuracy, this call is being recorded for note-taking.</Say>
      <Dial>
        <Conference
          record="record-from-start"
          recordingChannels="mono"
          recordingStatusCallback="https://api.docket.dev/twilio/recording-status"
          recordingStatusCallbackEvent="completed"
          statusCallback="https://api.docket.dev/twilio/conf-status"
          statusCallbackEvent="start end join leave"
          startConferenceOnEnter="true"
          endConferenceOnExit="true"
          beep="false"
          trim="trim-silence"
          participantLabel="preparer">
          ${confName}
        </Conference>
      </Dial>
    </Response>`,
    200,
    { 'content-type': 'text/xml' },
  )
})

// POST /twilio/recording-status — recording is done, fetch it
app.post('/twilio/recording-status', async (c) => {
  const { RecordingSid, RecordingUrl, RecordingDuration, ConferenceSid } =
    await c.req.parseBody()

  const audio = await fetch(`${RecordingUrl}.wav`, {
    headers: basicAuth(TWILIO_SID, TWILIO_TOKEN),
  })

  const key = `recordings/${ConferenceSid}/${RecordingSid}.wav`
  await r2.put(key, await audio.arrayBuffer(), {
    customMetadata: { ConferenceSid, durationSec: RecordingDuration },
  })

  await inngest.send({
    name: 'recording/captured',
    data: { recordingSid: RecordingSid, key, conferenceSid: ConferenceSid },
  })

  // delete from Twilio (HIPAA defense in depth)
  await twilio.recordings(RecordingSid).remove()

  return c.json({ ok: true })
})
```

### TwiML signature verification

All Twilio webhooks must validate `X-Twilio-Signature`. The
[twilio Node SDK](https://www.twilio.com/docs/usage/webhooks/webhooks-security) exposes
`twilio.validateRequest()`. Wire it as middleware before any of the above.

### Conference status events to handle

- `participant-join` (preparer leg arrived) → status = `connected`
- `participant-leave` → if it was the preparer, status = `ended_by_preparer`
- `conference-end` → status = `ended`, kick off recording-wait timeout
- `recording-completed` → trigger transcription pipeline
- `recording-absent` → alert — call ended too short or failed

---

## 10. Open questions / failure modes

### Open questions

1. **Carrier 3-way calling coverage.** What % of Docket's TAM (tax preparers, often on
   pre-paid or budget plans) actually has working merge calls? Worth a survey before
   committing.
2. **STIR/SHAKEN attestation for A2.** If we ever want outbound calls to show as Antonio's
   number, we need a path with Twilio. Cost and timeline unknown — needs a sales call.
3. **HIPAA scope.** Are tax-prep calls PHI? Almost certainly not, but if Docket is also
   storing medical-related expense conversations the answer changes. Need legal review
   before signing Twilio's BAA.
4. **Conversational Intelligence vs. BYO ASR.** Twilio's bundled is more expensive but
   ships faster. Recommend BYO from v1 — Deepgram nova-3 is 5x cheaper and better at
   accents.
5. **International calls.** Twilio rates differ wildly outside US. If Docket serves
   preparers with international clients, build a per-destination cost preview.

### Failure modes

1. **Carrier drops the 3-way bridge mid-call.** Twilio's leg stays alive but receives
   silence. Detection: `participant-leave` doesn't fire but audio energy drops to zero.
   Mitigation: VAD watchdog on the recording.
2. **Antonio forgets to merge.** Call happens, no recording. Mitigation: post-call SMS
   reminder "Was this call worth recording? Use Docket for next one."
3. **Recording webhook fails delivery.** Twilio retries 3x with exponential backoff.
   After that, recording is orphaned. Mitigation: nightly reconciliation job that lists
   conferences from Twilio API and cross-checks against Docket's DB.
4. **Client refuses recording.** Antonio needs a one-tap "stop recording" in the Docket
   companion app. POSTs `Status=stopped` to the Recording. The recorded portion still
   exists — Docket should immediately delete it for compliance posture.
5. **Recording exceeds 4 hours.** Twilio's max recording length is 4 hours; long calls
   silently truncate. Mitigation: alert at 3h45m to start a new recording.
6. **Twilio outage.** Conference unreachable, calls fail. Mitigation: graceful failure
   in the TwiML webhook (return `<Reject/>` and SMS Antonio). Don't block the call from
   continuing carrier-to-carrier without Docket.
7. **Conference name collision.** Two preparers happen to generate the same conference
   name in the same minute. Mitigation: include `preparerId` in the name (already do)
   and use enough random entropy (8-char nanoid).
8. **Recording cost spike from runaway long calls.** Set per-account `TimeLimit` on the
   Participant resource (e.g. 2 hours) to hard-cap.

---

## 11. Citations

### Twilio docs (primary)

- [Voice Conference overview](https://www.twilio.com/docs/voice/conference)
- [TwiML &lt;Conference&gt;](https://www.twilio.com/docs/voice/twiml/conference)
- [Conference REST resource](https://www.twilio.com/docs/voice/api/conference-resource)
- [Conference Participants subresource](https://www.twilio.com/docs/voice/api/conference-participant-resource)
- [Recordings resource](https://www.twilio.com/docs/voice/api/recording)
- [TwiML &lt;Start&gt;&lt;Recording&gt;](https://www.twilio.com/docs/voice/twiml/recording)
- [Voice Intelligence / Conversational Intelligence transcripts](https://www.twilio.com/docs/voice/intelligence/api/transcript-resource)
- [Webhooks security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Call resource](https://www.twilio.com/docs/voice/api/call-resource)
- [Make outbound phone calls](https://www.twilio.com/docs/voice/make-calls)

### Twilio guides & blog posts

- [Warm Transfer with Node.js + Express](https://www.twilio.com/docs/voice/tutorials/warm-transfer)
- [Multi-Party Calls with VoIP and GSM](https://www.twilio.com/en-us/blog/multi-party-calls-voip-gsm-programmable-voice)
- [Twilio Conference Announcements](https://www.twilio.com/en-us/blog/twilio-conference-now-supports-announcements-html)
- [Conference Announce Events changelog](https://www.twilio.com/en-us/changelog/conference-announce-events)
- [General availability of &lt;Start&gt;&lt;Recording&gt;](https://www.twilio.com/en-us/blog/products/launches/general-availability-start-recording)
- [Connect Call To widget (Studio)](https://www.twilio.com/docs/studio/widget-library/connect-call)
- [Connect AI agent to conference via TwiML app](https://www.twilio.com/en-us/blog/developers/tutorials/product/connect-twiml-app-twilio-conference)
- [Core latency in AI voice agents](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)

### Twilio support / pricing

- [Recording a phone call with Twilio](https://support.twilio.com/hc/en-us/articles/223132867-Recording-a-Phone-Call-with-Twilio)
- [Recording Controls API guide](https://support.twilio.com/hc/en-us/articles/360010199074-Getting-Started-with-Call-Recording-Controls)
- [Troubleshooting Post-Dial Delay](https://support.twilio.com/hc/en-us/articles/360025824413-Troubleshooting-Post-Dial-Delay-PDD-and-Delayed-Ringing-on-Twilio-Calls)
- [Voice pricing — US](https://www.twilio.com/en-us/voice/pricing/us)
- [Conference pricing](https://www.twilio.com/en-us/voice/conference/pricing)
- [Programmable Call Recording](https://www.twilio.com/en-us/call-recording)

### Consent-law references

- [Recording Law: Two-party consent states (2026)](https://www.recordinglaw.com/party-two-party-consent-states/)
- [Recording Law: California recording laws](https://www.recordinglaw.com/party-two-party-consent-states/california-recording-laws/)
- [Wikipedia: Telephone call recording laws](https://en.wikipedia.org/wiki/Telephone_call_recording_laws)
- [Call recording laws by state 2026 — NextPhone](https://www.getnextphone.com/blog/call-recording-laws-by-state)

### 3-way calling on handsets

- [How to make a 3-way call: iPhone/Android guide 2026](https://www.iwantek.com/blogs/guide/how-to-make-a-3-way-call-iphone-android-guide-2026)
- [How to know if someone merged your call (carrier-switch mechanism)](https://bubblyphone.com/hub/detect-3-way-call)
- [3-way iPhone conference calls and recording](https://call-recorder.net/blog/3-way-iphone-conference-calls-and-records/)
