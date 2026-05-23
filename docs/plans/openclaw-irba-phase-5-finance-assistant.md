# OpenClaw ↔ IRBA Phase 5 — Finance Assistant

Status: In progress locally — Avi approved scope; implementation/tests added locally; deploy pending  
Scope: finance summary, player balances, explicit payment history, and admin payment recording through typed assistant API operations.  
This phase includes one audited mutation: recording a payment. No edits/deletes.

## Decisions from Avi

Approved direction:

1. Self balance in group is allowed when the player explicitly asks.
2. Admin may ask in group for other players’ compact balances.
3. Non-admin users may not see another player’s balance.
4. Payment history should be supported when an admin explicitly asks.
5. Admin payment recording should be supported, including who paid and how.
6. Screenshot/photo receipts from Bit/PayBox should be supported for admin payment recording where technically available from OpenClaw message attachments.

## Goal

Let Mikey answer and record common IRBA finance workflows from WhatsApp while keeping IRBA as the deterministic source of truth.

Example questions/actions:

- “מה מצב הקופה?”
- “מה היתרה שלי?”
- “מה היתרה של אדיר ויקיר?”
- “מי חייב כסף?”
- “היסטוריית תשלומים של אדיר”
- “אדיר שילם 80 בביט”
- “יקיר שילם 100 בפייבוקס”
- Screenshot/photo from Bit or PayBox + text like “תעד לאדיר”.

## Existing IRBA baseline

IRBA already owns finance logic and data:

- Balances are computed, not stored, from:
  - `Payment`
  - `SessionCharge`
  - `SharedExpenseCharge`
- Helpers already exist:
  - `computePlayerBalance(playerId)`
  - `computePlayerBalances(playerIds[])`
- Admin finance page already shows:
  - total paid;
  - total charged;
  - total balance;
  - debtors;
  - credits;
  - all player balances.
- Manual debtors WhatsApp broadcast already exists through IRBA notification config.

Phase 5 must reuse existing IRBA logic. OpenClaw must not recompute balances itself or write directly to the DB.

## Non-goals

- No payment edit/delete.
- No retroactive charge recalculation.
- No direct DB reads/writes from OpenClaw.
- No public/group exposure of non-admin members’ detailed financial history.
- No proactive finance broadcast changes.
- No OCR trust without confirmation for payment mutations.

## Proposed assistant operations

### 1. `finance_summary_get`

Access: admin only.

Purpose: answer “מה מצב הקופה?” / “כמה חייבים?” at a high level.

Suggested response data:

```ts
{
  total_paid: number;
  total_charged: number;
  total_balance: number;
  debtors_count: number;
  total_debt: number;     // positive abs sum of negative balances
  credits_count: number;
  total_credit: number;
}
```

Mikey reply example:

```text
מצב הקופה:
• שולם: ₪X
• חויב: ₪Y
• יתרה כוללת: ₪Z
• חייבים: N שחקנים, סה״כ ₪D
• בזכות: M שחקנים, סה״כ ₪C
```

### 2. `player_balance_get`

Access:

- self: member/admin can ask for their own balance.
- admin: can ask for one or more other players by phone/player id after OpenClaw resolves names through `player_lookup`.
- non-admin for others: forbidden.

Purpose:

- “מה היתרה שלי?”
- “מה היתרה של אדיר?”
- “מה היתרה של אדיר ויקיר?”

Suggested params:

```ts
{
  player_phone?: string;       // omitted means actor/self
  include_breakdown?: boolean; // default false; admin may request true
}
```

Suggested response data:

```ts
{
  player: { id: string; display_name: string; phone: string };
  total_paid: number;
  total_charged: number;
  balance: number; // positive credit, negative debt
  session_charges_total?: number;
  shared_expense_charges_total?: number;
}
```

Mikey reply examples:

```text
היתרה שלך: חוב ₪40.
```

```text
אדיר: חוב ₪40
יקיר: זכות ₪20
```

### 3. `player_payments_list`

Access:

- self: own payment history only, compact recent list.
- admin: any player after safe lookup.
- non-admin for others: forbidden.

Purpose:

- “היסטוריית תשלומים שלי”
- “תשלומים אחרונים של אדיר”
- “מה אדיר שילם לאחרונה?”

Suggested params:

```ts
{
  player_phone?: string; // omitted means actor/self
  limit?: number;        // default 5, max 10
}
```

Suggested response data:

```ts
{
  player: { id: string; display_name: string; phone: string };
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    method: "CASH" | "PAYBOX" | "BIT" | "BANK_TRANSFER" | "OTHER";
    description: string | null;
  }>;
}
```

Privacy rule:

- If non-admin asks for their own history in group, reply compactly.
- If admin asks for another player’s history in group, allowed only when explicit (“היסטוריה”, “תשלומים אחרונים”, etc.).
- Do not include national IDs, emails, raw internal IDs, or unrelated finance details in Mikey’s group reply.

### 4. `payment_add`

Access: admin only.

Purpose:

- “אדיר שילם 80 בביט”
- “יקיר שילם 100 בפייבוקס”
- “קיבלתי מתומר 60 מזומן”

Suggested params:

```ts
{
  player_phone: string;
  amount: number;
  method: "CASH" | "PAYBOX" | "BIT" | "BANK_TRANSFER" | "OTHER";
  date?: string;             // default server now / today in Israel time
  description?: string;
  receipt_ref?: string;      // optional opaque reference/path/id from OpenClaw attachment handling
  confirmation_token?: string;
}
```

Important confirmation design:

- First request should parse/resolve and return `requires_confirmation: true` with a short confirmation summary and a token.
- Only a second explicit admin confirmation should create the payment.
- This protects against OCR mistakes, ambiguous text, or accidental WhatsApp messages.

Suggested first-step response:

```text
מצאתי: אדיר שילם ₪80 בביט.
לאשר רישום תשלום?
ענה: אשר תשלום
```

Suggested confirmed response:

```text
נרשם תשלום: אדיר ₪80 בביט ✅
יתרה חדשה: חוב ₪20.
```

### 5. Receipt / screenshot support

Goal: allow Avi/admin to send a Bit/PayBox screenshot and ask Mikey to record it.

Proposed flow:

1. Admin sends screenshot/photo with text or follow-up instruction, e.g. “תעד לאדיר”.
2. OpenClaw extracts/OCRs likely amount/method/date/reference from the image where possible.
3. Mikey resolves the player name through `player_lookup`.
4. Mikey calls `payment_add` first step with parsed fields and optional `receipt_ref` / description.
5. IRBA returns confirmation-required summary.
6. Admin confirms explicitly.
7. Only then IRBA creates the `Payment` row.

Storage decision for receipts:

- Minimal Phase 5: store only a text reference/description, not the binary image, unless IRBA already has a safe attachment storage path.
- If receipt file storage is desired, create a separate mini-plan for attachment persistence, access control, retention, and backups.

OCR safety rule:

- OCR output is never trusted as final. Admin confirmation is mandatory before `payment_add` mutates data.

## OpenClaw / Mikey behavior

Mikey should:

- Route “היתרה שלי” directly to `player_balance_get` with no target.
- For admin “היתרה של X”, resolve X through existing `player_lookup` first.
- For admin multi-target balance/history questions, resolve all targets first; if any target is ambiguous/unknown, do not partially answer.
- Detect payment-add intents with amount + method + player target.
- For screenshots, use OCR/image analysis only to draft a proposed payment; require explicit confirmation.
- Keep replies short and Hebrew-first.
- Never expose raw JSON or stack traces.
- Never invent finance data if IRBA returns an error.

## Access policy

- Self balance in group: allowed.
- Self payment history in group: allowed when explicitly requested, compact recent list only.
- Admin balance lookup for others in group: allowed.
- Admin payment history for others in group: allowed when explicitly requested.
- Non-admin asking about someone else: forbidden.
- Payment add: admin only, confirmation required.

## Implementation tasks

### IRBA server

Local status: implemented, targeted tests passing; deploy pending.

- [x] Add finance operation schemas to assistant API operation registry.
- [x] Implement `finance_summary_get` using existing balance helpers and player list logic from the finance page.
- [x] Implement `player_balance_get` using `computePlayerBalance` / `computePlayerBalances`.
- [x] Implement `player_payments_list` using existing `Payment` model.
- [x] Implement `payment_add` as admin-only, confirmation-gated mutation.
- [x] Add audit log action for assistant-created payments, e.g. `ASSISTANT_PAYMENT_ADD`.
- [x] Ensure `AssistantRequestLog` stores sanitized results only through the existing assistant response logging path.
- [x] Enforce actor access rules server-side:
  - self allowed for own balance/history;
  - admin allowed for target player;
  - non-admin denied for others;
  - payment mutation admin-only.
- [x] Add unit tests for:
  - self balance success;
  - admin target balance success;
  - non-admin target forbidden;
  - summary admin-only;
  - self payment history;
  - admin target payment history;
  - payment add requires confirmation;
  - payment add confirmation creates row and audit log;
  - invalid amount/method rejected;
  - ambiguous/missing player handled before mutation.

### OpenClaw skill

Local status: implemented locally in `/root/.openclaw/skills/irba-assistant/`; parse/dry-run QA passing; live API QA pending deploy.

- [x] Extend command router to detect finance questions/actions:
  - “מה מצב הקופה?”
  - “מה היתרה שלי?”
  - “מה היתרה של X?”
  - “מי חייב?” / “כמה חייבים?”
  - “היסטוריית תשלומים של X”
  - “X שילם Y ב־BIT/PAYBOX/מזומן/העברה”
- [x] Reuse existing safe name resolution for admin target questions.
- [x] Add concise Hebrew reply templates.
- [x] Add a confirmation state/flow for `payment_add`.
- [ ] Add image/OCR extraction flow for receipt screenshots, gated by confirmation.
- [ ] Add/keep finance capabilities in help only after deployed and smoke-tested.

### Docs

- Update phase index.
- Update master plan finance section.
- Update `docs/FEATURES.md`, `docs/OPERATIONS.md`, and `PROJECT_STATE.md` after implementation.

## Acceptance criteria

- Admin can ask “מה מצב הקופה?” and receive a compact summary.
- A known player can ask “מה היתרה שלי?” and receive only their own compact balance.
- Admin can ask for one or more specific players’ balances after safe resolution.
- Admin can explicitly request recent payment history for a player.
- Non-admin cannot get another player’s balance/history.
- Admin can record a payment only after explicit confirmation.
- Screenshot/OCR flow can draft a payment but cannot create one without confirmation.
- Payment creation writes normal `Payment` data and an audit log.
- OpenClaw replies are concise Hebrew and never raw JSON.
- Existing finance calculations remain owned by IRBA.

## Rollback

- Disable/remove new finance operations from assistant operation registry.
- Revert OpenClaw finance command routing.
- Since the phase includes `payment_add`, rollback for bad data is manual payment deletion/edit through existing admin tooling or DB rollback according to runbook.
- Keep confirmation-gated mutation as the primary prevention mechanism.

## Recommended implementation order

1. Implement and test read-only operations first: summary, balance, payment history.
2. Implement `payment_add` confirmation mechanism server-side.
3. Implement OpenClaw text routing/replies for read-only and payment-add confirmation.
4. Add screenshot/OCR drafting flow, confirmation-gated.
5. Deploy and smoke-test API with Avi actor.
6. Run safe live QA in IRBA Coding.
7. Document results and push docs/code.
