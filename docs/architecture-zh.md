# CastRoom AI 开发者架构

本文是面向开发者的 CastRoom AI 架构说明，重点解释房间自动推进、Director 行为、防泄漏边界、记忆图谱和 token 成本相关的运行链路。

## 1. 运行总览

```mermaid
flowchart LR
  subgraph ui["界面层"]
    roomUi["房间界面<br/>时间线 / 频道 / 控制区"]
    memoryUi["记忆控制台<br/>列表 / 图谱 / 治理"]
    promptUi["Prompt Center<br/>房间规则 / Director 规则 / 角色备注"]
  end

  subgraph engine["房间引擎"]
    commit["消息提交器<br/>频道 / 目标 / 可见性"]
    flow["RoomAutoFlowDriver<br/>回合命令 / timer / 恢复"]
    scheduler["发言调度器<br/>强制回应 / 分配策略 / 严格流程"]
    prompt["Prompt 构建器<br/>紧凑 / 平衡 / 完整"]
  end

  subgraph ai["AI 边界"]
    provider["AI Provider<br/>云端或本地 endpoint"]
    cleaner["输出清洗<br/>格式 / 点名 / 公开检查"]
  end

  subgraph governance["治理层"]
    director["Director<br/>旁白 / 裁定 / 阶段切换"]
    privacy["防泄漏边界<br/>公开 / 私聊 / 阵营 / Director-only"]
    memory["记忆图谱<br/>说法 / 信念 / 冲突 / 事实"]
  end

  roomUi --> commit --> flow --> scheduler --> prompt --> provider --> cleaner --> commit
  flow -. "必要时介入" .-> director
  director -. "公开旁白屏障" .-> cleaner
  commit --> memory
  memory --> prompt
  privacy --> prompt
  cleaner --> privacy
  memoryUi --> memory
  promptUi --> prompt
```

普通聊天的主路径应该很短：消息进入房间，自动推演决定下一轮，调度角色，构建 prompt，调用 provider，清洗输出，再写回时间线。Director、记忆图谱和防泄漏检查是旁路能力，只在需要结构、安全或长期上下文时介入。

## 2. 自动推演状态机

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Queued: 开启自动推演
  Queued --> DispatchingRole: timer 到点 + 角色步骤
  Queued --> WaitingDirector: timer 到点 + Director 步骤
  DispatchingRole --> CoolingDown: 角色消息已提交
  WaitingDirector --> CoolingDown: 旁白或后台结果已提交
  CoolingDown --> Queued: 安排下一轮
  DispatchingRole --> HardStopped: provider 失败 / 无可用角色 / 隐私硬拦截
  WaitingDirector --> HardStopped: Director provider 失败 / 隐私硬拦截
  Queued --> HardStopped: 手动暂停 / 房间关闭
  HardStopped --> Queued: 用户恢复自动推演
```

推进策略固定为：

- `wait_for_instruction` 可以等待用户。
- `fill_gap` 只补一拍，然后观察。
- `continuous` 不能等待用户；软阻塞要转成换角色、换话题、Director 步骤或 retry。
- `continuous` 可以等 Director 完成内部步骤，但不能进入 `waiting_user`。

## 3. 回合派发链路

```mermaid
flowchart TD
  start["触发来源<br/>用户消息 / timer / Director 频道"] --> hard{"是否硬阻塞？"}
  hard -->|是| stop["硬停止<br/>手动暂停 / 房间关闭 / 无模型 / provider 失败"]
  hard -->|否| strict{"是否严格流程？"}
  strict -->|是| strictStep["解析精确流程步骤<br/>辩手或 Director 主持"]
  strict -->|否| forced{"是否有强制回应？"}
  forced -->|是| forcedRole["派发被点名角色"]
  forced -->|否| intervention{"是否需要 Director？"}
  intervention -->|是| directorStep["派发 Director"]
  intervention -->|否| natural["选择自然发言者"]
  natural --> empty{"找到发言者？"}
  empty -->|是| roleTurn["派发角色"]
  empty -->|否| fallback["换题 / 自主兜底 / retry"]
  strictStep --> result["提交结果并安排下一轮"]
  forcedRole --> result
  directorStep --> result
  roleTurn --> result
  fallback --> result
```

派发优先级固定为：硬阻塞、严格结构化流程、用户公开点名的强制回应、Director 必要介入、自然角色发言、换题或 retry。发言分配策略不能覆盖严格辩论流程，也不能覆盖一次性公开点名。

## 4. Director 与公开旁白边界

```mermaid
flowchart LR
  input["Director 输入或必要介入"] --> classify["请求分类<br/>后台 / 旁白 / 裁定 / 严格步骤"]
  classify --> backstage["后台记录<br/>只进 Director 频道"]
  classify --> directive["私密调度指令<br/>进入角色调度层"]
  classify --> narration["公开旁白候选"]
  narration --> sourceGate{"来源是否可公开？"}
  sourceGate -->|否| blocked["拦截或安全泛化<br/>不暴露私密细节"]
  sourceGate -->|是| styleGate{"是否像房间事件？"}
  styleGate -->|否| blocked
  styleGate -->|是| publicTimeline["提交 Director 消息<br/>进入公开时间线"]
  publicTimeline --> next["安排下一位角色"]
  blocked --> next
  backstage --> next
  directive --> next
```

Director 的公开文本是房间事件，必须先落地到公开时间线，角色才能回应。后台记录不会阻塞角色，也不能进入公开时间线、公开记忆或普通角色 prompt。

## 5. 可见性边界

```mermaid
flowchart TD
  msg["消息或记忆项"] --> vis{"可见性"}
  vis -->|公开| publicScope["公开房间作用域"]
  vis -->|私聊| privateScope["私聊作用域"]
  vis -->|阵营| factionScope["阵营作用域"]
  vis -->|Director-only| directorScope["Director 作用域"]

  publicScope --> publicPrompt["允许进入公开 prompt"]
  privateScope --> privatePrompt["只进入授权角色 prompt"]
  factionScope --> factionPrompt["只进入阵营角色 prompt"]
  directorScope --> directorPrompt["只进入 Director prompt"]

  privateScope -. "禁止直接进入" .-> publicPrompt
  factionScope -. "禁止直接进入" .-> publicPrompt
  directorScope -. "禁止直接进入" .-> publicPrompt
```

公开点名只是公开调度提示，不是私聊。Director 点名会进入 Director 频道。AI 角色输出不能创造新的调度点名。

## 6. 记忆与多视角图谱

```mermaid
flowchart TD
  timeline["已提交消息<br/>说话者 / 时间 / 频道 / 可见性"] --> context["近期上下文<br/>短期使用"]
  context --> extractor["语义提取<br/>批量或规则驱动"]
  extractor --> observations["语义观察<br/>倾向 / 目标 / 关系 / 说法"]
  observations --> graph["多视角图谱<br/>按 viewer 查询关系"]
  observations --> candidates["事实候选"]
  candidates --> governance["记忆治理<br/>确认 / 保留为说法 / 反驳"]
  governance --> facts["确认事实"]
  graph --> conflicts["冲突视图<br/>源句对源句"]
  facts --> promptMemory["Prompt 记忆摘要"]
  graph --> promptMemory
  promptMemory --> rolePrompt["按视角过滤的角色 prompt"]
  promptMemory --> directorPrompt["Director 聚焦记忆"]
```

图谱不把原始聊天直接当事实。它区分 `claimed`、`believed`、`doubted`、`confirmed`、`disputed` 和 `refuted`。冲突治理应显示两边源句、说话者、时间、可见性、置信度和冲突原因。

## 7. Prompt 与 token 预算

```mermaid
flowchart LR
  turn["回合请求"] --> budget{"上下文预算"}
  budget -->|compact| compact["紧凑 prompt<br/>当前角色 + 最近消息 + 少量记忆摘要"]
  budget -->|balanced| balanced["平衡 prompt<br/>发言角色身份 + 聚焦记忆"]
  budget -->|full| full["完整 prompt<br/>复杂模式 / 裁定 / 冲突审计"]
  compact --> provider["AI provider"]
  balanced --> provider
  full --> provider
  provider --> audit["用量审计<br/>tokens / 字符数 / purpose / prompt path"]
```

默认日常房间应优先使用本地调度和紧凑角色 prompt。完整 Director 或 planner prompt 只用于裁定、隐私风险、严格阶段切换、冲突治理或复杂剧情推进。
