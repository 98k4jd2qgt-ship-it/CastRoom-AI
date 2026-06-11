# CastRoom AI 架构

本文说明 CastRoom AI 的运行结构。

## 1. 主运行链路

```mermaid
flowchart LR
  user["用户 / 开发者"] --> room["房间界面"]
  room --> flow["自动推演"]
  flow --> roles["AI 角色"]
  roles --> timeline["公开时间线"]
  flow -.-> director["Director"]
  director -.-> timeline
  room -.-> privacy["防泄漏边界"]
  roles -.-> privacy
  director -.-> privacy
  room -.-> memory["记忆图谱"]
  roles -.-> memory
  memory -.-> flow
  privacy -.-> flow
```

普通聊天走短路径：房间界面进入自动推演，再由 AI 角色自然接话。Director 只在需要旁白、裁定、阶段切换、防卡住或可见性判断时介入。

## 2. 房间自动推演

```mermaid
flowchart TD
  trigger["用户消息 / 自动计时器 / Director 频道"] --> commit["写入消息并标记频道与可见性"]
  commit --> driver["RoomAutoFlowDriver"]
  driver --> hard{"是否硬阻塞？"}
  hard -->|是| stop["硬停止"]
  hard -->|否| structured{"是否结构化流程？"}
  structured -->|是| step["解析当前步骤"]
  structured -->|否| directorNeed{"是否需要 Director？"}
  directorNeed -->|是| directorStep["Director 步骤"]
  directorNeed -->|否| speaker["选择发言者"]
  step --> dispatch["派发角色或 Director"]
  directorStep --> gate["公开输出检查"]
  speaker --> prompt["构建紧凑 / 平衡 / 完整 prompt"]
  gate --> timeline["提交安全旁白或后台记录"]
  prompt --> provider["AI provider"]
  provider --> clean["清洗输出"]
  clean --> timeline
  timeline --> next["安排下一轮"]
```

`continuous` 除真实硬阻塞外应持续推进。硬阻塞包括 provider 失败、没有可运行角色、隐私硬拦截或用户手动暂停。`fill_gap` 只补一拍，然后观察。`wait_for_instruction` 才等待用户。

## 3. Director 边界

```mermaid
flowchart LR
  publicInput["公开输入"] --> classify["可见性分类"]
  privateInput["私聊 / 阵营 / Director 频道"] --> classify
  classify --> director["Director 处理"]
  director --> publicGate["公开输出检查"]
  director --> backstage["Director 频道记录"]
  director --> directive["私密调度指令"]
  publicGate -->|允许| publicTimeline["公开时间线"]
  publicGate -->|拦截| backstage
  directive --> roleTurn["角色调度层"]
```

Director 可以知道比普通角色更多的信息，但任何公开输出都必须先通过检查。后台记录、私密调度、私聊和阵营信息不能注入普通公开 prompt。

## 4. 记忆图谱

```mermaid
flowchart TD
  messages["房间消息：说话者 / 时间 / 频道 / 可见性"] --> context["近期上下文"]
  context --> observations["语义观察"]
  observations --> claims["说法 / 信念 / 怀疑"]
  observations --> candidates["事实候选"]
  candidates --> facts["确认事实"]
  claims --> perspectives["视角视图"]
  facts --> perspectives
  perspectives --> publicPrompt["公开 prompt 记忆"]
  perspectives --> rolePrompt["角色 prompt 记忆"]
  perspectives --> directorPrompt["Director 聚焦记忆"]
  perspectives --> conflicts["冲突治理"]
```

记忆不是扁平聊天记录。CastRoom AI 会区分上下文、语义观察、说法、信念、冲突和确认事实。冲突治理需要显示“哪一句”和“哪一句”发生了冲突。
