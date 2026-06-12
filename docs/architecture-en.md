# CastRoom AI Developer Architecture

This document is the developer-facing architecture overview for CastRoom AI. It focuses on the runtime paths that matter when debugging room flow, Director behavior, privacy boundaries, memory graph behavior, and token cost.

## 1. Runtime Map

```mermaid
flowchart LR
  subgraph ui["UI Layer"]
    roomUi["Room Surface<br/>timeline / channels / controls"]
    memoryUi["Memory Console<br/>list / graph / governance"]
    promptUi["Prompt Center<br/>room rules / director rules / role notes"]
  end

  subgraph engine["Room Engine"]
    commit["Message Committer<br/>channel / target / visibility"]
    flow["RoomAutoFlowDriver<br/>turn command / timer / recovery"]
    scheduler["Speaker Scheduler<br/>forced reply / policy / strict flow"]
    prompt["Prompt Builder<br/>compact / balanced / full"]
  end

  subgraph ai["AI Boundary"]
    provider["AI Provider<br/>cloud or local endpoint"]
    cleaner["Output Cleaner<br/>format / mention / public gate"]
  end

  subgraph governance["Governance"]
    director["Director<br/>narration / rulings / stage changes"]
    privacy["Privacy Boundary<br/>public / private / faction / director-only"]
    memory["Memory Graph<br/>claims / beliefs / conflicts / facts"]
  end

  roomUi --> commit --> flow --> scheduler --> prompt --> provider --> cleaner --> commit
  flow -. "intervention only" .-> director
  director -. "public narration barrier" .-> cleaner
  commit --> memory
  memory --> prompt
  privacy --> prompt
  cleaner --> privacy
  memoryUi --> memory
  promptUi --> prompt
```

The normal path is short: room message, flow driver, speaker selection, prompt, provider, cleaned output, timeline. Director, memory graph, and privacy checks are side paths that should be entered only when they add structure, safety, or durable context.

## 2. Automatic Room Flow

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Queued: auto enabled
  Queued --> DispatchingRole: timer due + role step
  Queued --> WaitingDirector: timer due + Director step
  DispatchingRole --> CoolingDown: role message committed
  WaitingDirector --> CoolingDown: public narration or backstage result committed
  CoolingDown --> Queued: schedule next turn
  DispatchingRole --> HardStopped: provider failure / no runnable role / privacy block
  WaitingDirector --> HardStopped: Director provider failure / hard privacy block
  Queued --> HardStopped: manual pause / room closed
  HardStopped --> Queued: user resumes auto flow
```

Flow policy:

- `wait_for_instruction` may wait for user input.
- `fill_gap` fills one missing beat and then observes.
- `continuous` must not wait for the user. Soft blockers become role fallback, topic shift, Director step, or retry.
- `waiting_director` is allowed in `continuous`; `waiting_user` is not.

## 3. Turn Dispatch Pipeline

```mermaid
flowchart TD
  start["Trigger<br/>user message / timer / Director channel"] --> hard{"Hard blocker?"}
  hard -->|yes| stop["Hard stop<br/>manual pause / closed room / no model / provider failure"]
  hard -->|no| strict{"Strict flow active?"}
  strict -->|yes| strictStep["Resolve exact flow step<br/>debate speaker or Director host"]
  strict -->|no| forced{"Forced reply queued?"}
  forced -->|yes| forcedRole["Dispatch mentioned role"]
  forced -->|no| intervention{"Need Director?"}
  intervention -->|yes| directorStep["Dispatch Director"]
  intervention -->|no| natural["Select natural speaker"]
  natural --> empty{"Speaker found?"}
  empty -->|yes| roleTurn["Dispatch role"]
  empty -->|no| fallback["Topic shift / autonomous fallback / retry"]
  strictStep --> result["Commit result and schedule next turn"]
  forcedRole --> result
  directorStep --> result
  roleTurn --> result
  fallback --> result
```

Priority order is fixed: hard blockers, strict structured flow, forced replies, Director intervention, natural role turn, topic shift, retry. Speaker policy must not override strict debate flow or a one-shot public role mention.

## 4. Director and Public Narration Boundary

```mermaid
flowchart LR
  input["Director input or required intervention"] --> classify["Classify request<br/>backstage / narration / ruling / strict step"]
  classify --> backstage["Backstage note<br/>Director channel only"]
  classify --> directive["Private directive<br/>role scheduling layer"]
  classify --> narration["Public narration candidate"]
  narration --> sourceGate{"Source is public-safe?"}
  sourceGate -->|no| blocked["Block or generalize<br/>no private details"]
  sourceGate -->|yes| styleGate{"Scene-facing text?"}
  styleGate -->|no| blocked
  styleGate -->|yes| publicTimeline["Commit Director message<br/>public timeline"]
  publicTimeline --> next["Schedule next role turn"]
  blocked --> next
  backstage --> next
  directive --> next
```

Public Director text is a room event. It must be committed before roles react to it. Backstage notes do not block role turns and must not enter public timeline, public memory, or ordinary role prompts.

## 5. Visibility Boundary

```mermaid
flowchart TD
  msg["Message or memory item"] --> vis{"Visibility"}
  vis -->|public| publicScope["Public room scope"]
  vis -->|private| privateScope["Private thread scope"]
  vis -->|faction| factionScope["Faction scope"]
  vis -->|director-only| directorScope["Director scope"]

  publicScope --> publicPrompt["Public prompt allowed"]
  privateScope --> privatePrompt["Only authorized role prompt"]
  factionScope --> factionPrompt["Only faction role prompt"]
  directorScope --> directorPrompt["Only Director prompt"]

  privateScope -. "never directly" .-> publicPrompt
  factionScope -. "never directly" .-> publicPrompt
  directorScope -. "never directly" .-> publicPrompt
```

Public role mentions are visible scheduling hints, not private chat. Director mentions route to the Director channel. AI role output must not create new scheduling mentions.

## 6. Memory and Perspective Graph

```mermaid
flowchart TD
  timeline["Committed messages<br/>speaker / time / channel / visibility"] --> context["Recent context<br/>short-lived"]
  context --> extractor["Semantic extraction<br/>batched or rule-based"]
  extractor --> observations["Semantic observations<br/>traits / goals / relationships / claims"]
  observations --> perspectiveGraph["Perspective graph<br/>viewer-aware relations"]
  observations --> candidates["Fact candidates"]
  candidates --> governance["Governance<br/>confirm / keep as claim / refute"]
  governance --> facts["Confirmed facts"]
  perspectiveGraph --> conflicts["Conflict view<br/>source sentence vs source sentence"]
  facts --> promptMemory["Prompt memory digest"]
  perspectiveGraph --> promptMemory
  promptMemory --> rolePrompt["Viewer-filtered role prompt"]
  promptMemory --> directorPrompt["Focused Director memory"]
```

The graph does not treat raw chat as fact. It separates `claimed`, `believed`, `doubted`, `confirmed`, `disputed`, and `refuted`. Conflict governance should show both source sentences, their speakers, timestamps, visibility, confidence, and the conflict reason.

## 7. Prompt and Token Budget

```mermaid
flowchart LR
  turn["Turn request"] --> budget{"Context budget"}
  budget -->|compact| compact["Compact prompt<br/>current role + recent messages + small memory digest"]
  budget -->|balanced| balanced["Balanced prompt<br/>speaker identity + focused memory"]
  budget -->|full| full["Full prompt<br/>complex modes / rulings / conflict audit"]
  compact --> provider["AI provider"]
  balanced --> provider
  full --> provider
  provider --> audit["Usage audit<br/>tokens / chars / purpose / prompt path"]
```

Default casual room turns should prefer compact speaker prompts and local scheduling. Full Director or planner prompts are reserved for rulings, privacy risk, strict stage changes, conflict governance, or complex story flow.
