# CastRoom AI Architecture

This page describes the runtime shape of CastRoom AI.

## 1. Main Runtime Path

```mermaid
flowchart LR
  user["User / Developer"] --> room["Room UI"]
  room --> flow["Auto Flow"]
  flow --> roles["AI Roles"]
  roles --> timeline["Public Timeline"]
  flow -.-> director["Director"]
  director -.-> timeline
  room -.-> privacy["Privacy Boundary"]
  roles -.-> privacy
  director -.-> privacy
  room -.-> memory["Memory Graph"]
  roles -.-> memory
  memory -.-> flow
  privacy -.-> flow
```

Normal chat follows the short path from Room UI to Auto Flow to AI Roles. Director intervention is reserved for narration, rulings, stage changes, recovery, and visibility-sensitive decisions.

## 2. Room Flow

```mermaid
flowchart TD
  trigger["User message / auto timer / Director channel"] --> commit["Commit message with channel and visibility"]
  commit --> driver["RoomAutoFlowDriver"]
  driver --> hard{"Hard blocker?"}
  hard -->|yes| stop["Hard stop"]
  hard -->|no| structured{"Structured flow?"}
  structured -->|yes| step["Resolve exact step"]
  structured -->|no| directorNeed{"Need Director?"}
  directorNeed -->|yes| directorStep["Director step"]
  directorNeed -->|no| speaker["Select speaker"]
  step --> dispatch["Dispatch role or Director"]
  directorStep --> gate["Public output gate"]
  speaker --> prompt["Build compact / balanced / full prompt"]
  gate --> timeline["Commit safe public narration or backstage note"]
  prompt --> provider["AI provider"]
  provider --> clean["Clean output"]
  clean --> timeline
  timeline --> next["Schedule next turn"]
```

`continuous` should keep moving unless there is a real hard blocker such as a provider failure, no runnable role, a privacy block, or a manual pause. `fill_gap` fills one missing beat and then observes. `wait_for_instruction` waits for the user.

## 3. Director Boundary

```mermaid
flowchart LR
  publicInput["Public input"] --> classify["Visibility classifier"]
  privateInput["Private / faction / Director channel"] --> classify
  classify --> director["Director processing"]
  director --> publicGate["Public output gate"]
  director --> backstage["Director channel note"]
  director --> directive["Private directive"]
  publicGate -->|allowed| publicTimeline["Public timeline"]
  publicGate -->|blocked| backstage
  directive --> roleTurn["Role scheduling layer"]
```

Director can know more than ordinary roles, but public output is checked before it reaches the main timeline. Backstage notes, private directives, private chats, and faction information must not be injected into ordinary public prompts.

## 4. Memory Graph

```mermaid
flowchart TD
  messages["Room messages with speaker, time, channel, visibility"] --> context["Recent context"]
  context --> observations["Semantic observations"]
  observations --> claims["Claims / beliefs / doubts"]
  observations --> candidates["Fact candidates"]
  candidates --> facts["Confirmed facts"]
  claims --> perspectives["Perspective views"]
  facts --> perspectives
  perspectives --> publicPrompt["Public prompt memory"]
  perspectives --> rolePrompt["Role prompt memory"]
  perspectives --> directorPrompt["Director focused memory"]
  perspectives --> conflicts["Conflict governance"]
```

Memory is not a flat transcript. CastRoom AI separates context, semantic observations, claims, beliefs, conflicts, and confirmed facts. Conflict governance should show which source sentence conflicts with which other source sentence.
