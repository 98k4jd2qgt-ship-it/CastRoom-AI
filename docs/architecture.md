# CastRoom AI Architecture

This page contains the high-level architecture diagrams for CastRoom AI. The diagrams are written in Mermaid so GitHub can render them directly.

这份文档记录 CastRoom AI 的核心架构。图用 Mermaid 编写，GitHub 可以直接渲染。

## 1. System Overview

CastRoom AI is a Tauri desktop app. The web UI renders the room, memory console, prompt center, and configuration panels. The core engine decides room turns, protects visibility boundaries, builds prompts, calls AI providers, and persists room-scoped state.

```mermaid
flowchart LR
  subgraph app["Tauri Desktop App"]
    webview["WebView UI<br/>Room / Memory / Prompt Center"]
    tauri["Tauri Commands<br/>filesystem / window / bundled assets"]
  end

  subgraph ui["UI Layer"]
    roomSurface["Room Surface<br/>timeline / channels / control rail"]
    memoryConsole["Memory Console<br/>list / graph / governance"]
    promptCenter["Prompt Center<br/>room rules / director rules / role notes"]
    settings["AI and Room Settings"]
  end

  subgraph core["Core Room Engine"]
    committer["Message Committer<br/>visibility / target / timeline"]
    scheduler["Room Scheduler<br/>speaker policy / debate flow / continuous flow"]
    director["Director Layer<br/>narration / ruling / private directives"]
    guards["Rule Guards<br/>privacy / action fact gate / output cleaning"]
    prompts["Prompt Assembly<br/>compact / balanced / full"]
  end

  subgraph memory["Memory System"]
    raw["Raw Context<br/>recent messages"]
    semantic["Semantic Observations<br/>traits / claims / beliefs"]
    perspectiveGraph["Perspective Graph<br/>public / role / faction / director"]
    governance["Governance<br/>conflict / confidence / review"]
  end

  subgraph ai["AI Runtime"]
    gateway["AI Gateway"]
    cloud["OpenAI-compatible providers"]
    local["Bundled local runtime"]
    audit["Token Audit<br/>usage / purpose / prompt path"]
  end

  subgraph data["Persistence"]
    storage["App Data<br/>rooms / memory / settings"]
  end

  webview --> roomSurface
  webview --> memoryConsole
  webview --> promptCenter
  webview --> settings
  roomSurface --> committer
  roomSurface --> scheduler
  scheduler --> director
  scheduler --> guards
  scheduler --> prompts
  prompts --> gateway
  gateway --> cloud
  gateway --> local
  gateway --> audit
  committer --> raw
  raw --> semantic
  semantic --> perspectiveGraph
  perspectiveGraph --> governance
  perspectiveGraph --> prompts
  guards --> committer
  tauri --> storage
  core --> storage
  memory --> storage
```

## 2. Room Turn Pipeline

A room turn is not a direct “send message to all models” loop. The scheduler first decides whether the room needs a role reply, Director intervention, a retry, or a hard stop. In normal casual chat, the path should be short: local scheduling plus a compact speaker prompt.

```mermaid
flowchart TD
  trigger["Trigger<br/>user message / auto timer / Director Channel"] --> commit["Commit Message<br/>speaker / channel / visibility"]
  commit --> flow["RoomAutoFlowDriver<br/>single source of auto-flow truth"]

  flow --> hard{"Hard blocker?"}
  hard -->|yes| stop["Hard stop<br/>provider failure / no role / privacy block / manual pause"]
  hard -->|no| strict{"Structured flow?<br/>strict debate / required stage"}

  strict -->|yes| step["Resolve current step<br/>Director host or exact role"]
  strict -->|no| pending{"Pending forced reply<br/>or private directive?"}

  pending -->|yes| forced["Dispatch required role"]
  pending -->|no| needDirector{"Need Director?"}

  needDirector -->|yes| directorStep["Director step<br/>narration / ruling / visibility guard"]
  needDirector -->|no| speaker["Select speaker<br/>speaker policy + participation score"]

  speaker --> found{"Runnable role?"}
  found -->|yes| prompt["Build role prompt<br/>compact / balanced / full"]
  found -->|no| fallback["Soft fallback<br/>topic shift / role rotation / retry"]

  directorStep --> publicNarration{"Public narration?"}
  publicNarration -->|yes| gate["Public output gate<br/>privacy + no backstage text"]
  gate -->|allowed| narration["Commit Director narration<br/>public timeline first"]
  gate -->|blocked| directorNote["Director Channel note<br/>not visible to roles"]
  publicNarration -->|no| directorNote

  narration --> scheduleNext["Schedule next role turn<br/>respect auto pace"]
  directorNote --> scheduleNext
  forced --> prompt
  fallback --> scheduleNext
  prompt --> provider["AI Provider Call"]
  provider --> clean["Output cleaner<br/>no role mentions as control / no Director leaks"]
  clean --> timeline["Commit visible result"]
  timeline --> memoryDirty["Mark memory scopes dirty"]
  timeline --> scheduleNext
  scheduleNext --> timer["Real nextTurnAt + timer<br/>watchdog repairs missing or overdue timers"]
```

## 3. Director Boundaries

The Director can observe more than ordinary roles, but public output is tightly gated. Backstage scheduling and private information must not leak into the main channel, public status panel, public graph, or ordinary role prompts.

```mermaid
flowchart LR
  subgraph sources["Sources"]
    publicMsg["Public room message"]
    privateMsg["Private / faction message"]
    directorMsg["Director Channel message"]
    script["Director Script<br/>room + mode scoped"]
  end

  classify["Source visibility classifier<br/>public / private / faction / director-only"]

  subgraph director["Director Processing"]
    observe["Backstage observation"]
    decide["Intervention decision<br/>silent / narration / ruling / directive"]
    privateDirective["Private directives<br/>role scheduling layer"]
    scriptPatch["Script patch<br/>hidden facts / public-safe beats"]
  end

  subgraph gates["Public Gates"]
    outputGate["validateDirectorPublicOutput"]
    inspectorGate["sanitizeInspectorPatchForViewer"]
    scriptGate["activePublicDirectorScriptTexts"]
  end

  subgraph destinations["Destinations"]
    publicTimeline["Public timeline<br/>only public-safe narration"]
    directorChannel["Director Channel<br/>backstage notes and diagnostics"]
    publicStatus["Public status panel<br/>stable public state only"]
    rolePrompt["Ordinary role prompt<br/>viewer-safe context only"]
    hiddenState["Director-only memory and script"]
  end

  publicMsg --> classify
  privateMsg --> classify
  directorMsg --> classify
  script --> classify
  classify --> observe
  observe --> decide
  decide --> privateDirective
  decide --> scriptPatch
  decide --> outputGate
  scriptPatch --> scriptGate
  decide --> inspectorGate

  outputGate -->|allowed| publicTimeline
  outputGate -->|blocked| directorChannel
  inspectorGate --> publicStatus
  scriptGate --> rolePrompt
  privateDirective --> rolePrompt
  classify --> hiddenState
  hiddenState --> directorChannel
```

## 4. Memory and Perspective Graph

The memory system separates recent context, semantic observations, claims, beliefs, and confirmed facts. The graph is a perspective graph: it shows what the public room, a role, a faction, or the Director can see and believe.

```mermaid
flowchart TD
  message["Room messages<br/>speaker / time / channel / visibility"] --> context["Raw Context<br/>short recent window"]
  context --> extractor["Semantic Extractor<br/>batch / idle / memory panel"]
  extractor --> observations["Semantic Observations<br/>trait / goal / claim / belief / doubt"]

  observations --> candidates["Fact Candidates<br/>needs review / evidence-linked"]
  observations --> relations["Perspective Relations<br/>who said / who believes / who doubts"]
  candidates --> facts["Confirmed Facts<br/>Director / developer / strong evidence"]

  subgraph viewers["Viewer Filters"]
    publicView["Public Room View"]
    roleView["Role View<br/>public + own private + faction"]
    factionView["Faction View"]
    directorView["Director View<br/>highest permission"]
  end

  relations --> publicView
  relations --> roleView
  relations --> factionView
  relations --> directorView
  facts --> publicView
  facts --> roleView
  facts --> factionView
  facts --> directorView

  publicView --> publicPrompt["Public prompt memory<br/>public confirmed facts only"]
  roleView --> rolePrompt["Role prompt memory<br/>viewer-safe beliefs and claims"]
  directorView --> directorPrompt["Director focused memory<br/>light / focused / full audit"]

  directorView --> conflict["Conflict Governance<br/>source sentence vs source sentence"]
  conflict --> actions["Resolve<br/>confirm / keep as claim / refute / role-only belief"]
```
