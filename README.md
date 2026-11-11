<div align="center">
  <img src="icon.svg" width="76" height="76" alt="Temporary Project icon">
  <h1>DSH Temporary Project · 临时项目</h1>
  <p>在 DeepSeek Harness 的新建会话里一键开启临时项目，无需选择项目目录。</p>
  <p>
    <a href="https://github.com/ZoeHao2026/dsh-temporary-project/actions/workflows/verify.yml"><img src="https://github.com/ZoeHao2026/dsh-temporary-project/actions/workflows/verify.yml/badge.svg" alt="Verify plugin"></a>
    <a href="https://github.com/ZoeHao2026/dsh-temporary-project/releases"><img src="https://img.shields.io/github/v/release/ZoeHao2026/dsh-temporary-project?label=release" alt="Latest release"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  </p>
  <p><a href="#中文">中文</a> · <a href="#english">English</a></p>
</div>

## 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web GUI 的「新建会话」增加 **「临时对话」** 选项。点击后自动创建独立临时项目目录、注册 Workspace，并直接进入空白 Agent 会话，可立即开始对话或代码开发任务。

DSH 默认的新建会话流程要求用户先选择项目目录；试写代码、一次性脚本、隔离实验等临时任务往往不想污染已有项目，也不值得手工建目录。「临时对话」把这一步变成一次点击。

### 功能

- 在 New Session hero 行（工作区选择器与 Agent preset 之后）增加「临时对话」按钮。
- 一键完成：创建临时目录 → 注册 Workspace → 创建并打开空白会话。
- 每次点击生成独立目录，多个临时任务互不影响，可并行。
- 中英双语、跟随宿主主题、键盘可达、创建中禁用按钮防止重复提交。
- 失败时在页面底部显示本地化错误提示。
- 不注册任何工具、提示词或会话事件，对模型请求零额外 token。

### 环境

- 在 DSH Desktop 0.2.2-rc.1 的 Web GUI 上验证（需要 DSH 自带的 Connection、Workspace、Session 与 `ui-workspace` 服务）。
- 运行时无 npm 依赖；仓库中的测试与校验脚本只需要 Node.js 22+。

### 安装

```bash
git clone https://github.com/ZoeHao2026/dsh-temporary-project.git
```

然后把仓库目录作为本地 bundle 安装到 DSH profile：

- 让 DSH Agent 执行 `plugin_manager` 的 `install_bundle`，`target` 指向本仓库目录；或
- 通过你的 DSH 插件管理流程从本地目录安装。

纯 JavaScript，无需构建步骤。安装后如果按钮没有立即出现，刷新页面一次即可。

### 使用

1. 点击侧栏的「新建会话」。
2. 在 New Session 行右侧点击「临时对话」。
3. DSH 会创建 `临时项目 · <本地时间>` Workspace，并打开其中的空白会话；发送第一条消息即可开始任务。

### 目录与清理

临时项目保存在用户 harness home 下，而不是系统临时目录，避免系统清理导致长会话丢失工作目录：

```text
$DSH_HOME/temporary-projects/project-XXXXXX      # DSH_HOME 未设置时默认为 ~/.dsh
```

在侧栏删除该 Workspace 只会移除注册（DSH workspace registry 的既有语义：删除项目不会删除文件）。目录需要在文件管理器中手动清理。插件不会自动删除历史临时项目。

### 工作原理

- **Host**（[`route.js`](route.js)）：在 Connection 共享的 `/api` handler 上注册精确 Fetch 路由 `/api/temporary-project`，使用 Connection RPC 信封通信。路由经 Host/Origin 校验与浏览器 Cookie 认证，且仅 owner Peer 可调用；随后 `mkdir` + `mkdtemp` 创建目录，并通过 `ctx.workspaceRegistry.create()` 注册 Workspace。取消时回滚已创建的目录与注册。
- **Browser**（[`client.js`](client.js)）：向 `conversation.hero.options` 槽位注册按钮，向 `shell.overlay` 注册错误提示；通过 `ctx.connection.rpc.call('/api', 'temporary-project', { title })` 调用 Host，等待 Workspace 投影出现后调用 `ctx.uiWorkspace.openWorkspace()` 创建并打开会话。
- **Bundle**（[`cordis.patch.yml`](cordis.patch.yml)）：插入 Host 行；客户端半由 `package.json` 的 `dsh.client` 声明并通过 client module table 加载。

### 权限与安全

- 请求必须通过 DSH Connection 的 Host/Origin 校验和浏览器认证，非 owner Peer 在共享 handler 处即被拒绝。
- 调用方不能指定目录路径；根目录固定，项目名由 `mkdtemp` 随机生成。
- Workspace 标题会去掉控制字符、折叠空白，并限制为 80 个 Unicode 码点。
- 不读取浏览器 DOM、不写全局样式、不加载其他 Harness Client 包作为模块。

### 开发与测试

无需 `npm install`：

```bash
npm run check       # 语法检查 + 清单校验 + Host 路由单元测试
npm run validate    # 只校验 bundle 清单/图标/语言资源
npm test            # 只跑 Host 路由单元测试
```

CI 见 [`.github/workflows/verify.yml`](.github/workflows/verify.yml)，同时检查 `npm pack` 是否包含全部运行时文件。

测试覆盖 Connection RPC 信封往返、失败分支仍返回 HTTP 200、错误详情可序列化、标题规范化与上限、目录/Workspace 创建失败清理、取消时回滚等。

### 已验证范围

- 在 DSH 0.2.2-rc.1 上安装成功（`application: applied`，无 warning），Host 行处于 active。
- `conversation.hero.options` 与 `shell.overlay` 中的客户端注册均为 active。
- 上述静态检查与单元测试全部通过。

完整点击流程与最终视觉效果需在目标 DSH 桌面上人工确认（本仓库不做浏览器自动化）。

### 已知限制

- 选项只出现在空白 New Session hero 行；按 DSH 现有实现，该行仅在存在已选中的空白 Session 时渲染。没有 Session 的欢迎状态不显示此按钮。
- 新会话使用 DSH 配置的默认 Agent preset 与模型，暂不支持在本入口选择 preset。
- 每次点击创建新目录；不做自动清理。
- 若 Host 创建成功但客户端 5 秒内未收到 Workspace 投影，会提示稍后从项目列表打开。

### 许可

[MIT](LICENSE) © 2026 ZoeHao2026

## English

Adds a **Temporary conversation** option to the New Session row of the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) Web GUI. One click creates a dedicated temporary project directory, registers it as a Workspace, and opens a blank Agent session, so a task can start without choosing a project folder.

DSH's default New Session flow asks for a project directory first. For throwaway scripts, isolated experiments, or quick code trials, that is friction and can pollute an existing project. Temporary conversation turns it into a single click.

### Features

- A compact **Temporary conversation** chip in the New Session hero row, after the workspace and Agent preset controls.
- One click creates the directory, registers the Workspace, and opens a blank session.
- Each click gets its own directory, so temporary tasks stay isolated and can run in parallel.
- Localized (zh/en), host-themed, keyboard accessible, and guarded against double submission.
- Failures surface as a localized notice at the bottom of the page.
- Registers no tools, prompt sections, or Session events, so it adds zero model-visible tokens.

### Requirements

- Verified on DSH Desktop 0.2.2-rc.1 (Web GUI) with the shipped Connection, Workspace, Session, and `ui-workspace` services.
- No runtime npm dependencies; the repository's tests and validation scripts need Node.js 22+.

### Install

```bash
git clone https://github.com/ZoeHao2026/dsh-temporary-project.git
```

Install the repository directory as a local bundle in your DSH profile:

- Ask a DSH agent to run `plugin_manager` with `install_bundle` and this repository as `target`; or
- Use your DSH plugin-management flow to install a local bundle directory.

The plugin is plain JavaScript and needs no build step. Reload the page once if the chip does not appear immediately.

### Usage

1. Click **New Session** in the sidebar.
2. Click **Temporary conversation** at the right end of the New Session row.
3. DSH creates a `Temporary project · <local time>` Workspace and opens a blank session in it. Send the first message to start.

### Where files live and how to clean up

Temporary projects live under the user's harness home, not the OS temp directory, so a long-running session does not lose its working directory to system cleanup:

```text
$DSH_HOME/temporary-projects/project-XXXXXX      # defaults to ~/.dsh when DSH_HOME is unset
```

Deleting the Workspace from the sidebar removes the registration only, matching the DSH workspace registry's rule that deleting a project never deletes files. Remove the directory with your file manager when its contents are no longer needed. The plugin does not automatically delete old temporary projects.

### How it works

- **Host** ([`route.js`](route.js)): registers the exact Fetch route `/api/temporary-project` on Connection's shared `/api` handler and speaks the Connection RPC envelope. The handler enforces the Host/Origin fence and browser authentication, dispatches only owner Peers, creates a directory with `mkdir` + `mkdtemp`, and registers it through `ctx.workspaceRegistry.create()`. Cancellation rolls back the directory and registration.
- **Browser** ([`client.js`](client.js)): registers the chip in `conversation.hero.options` and the error notice in `shell.overlay`; calls the Host through `ctx.connection.rpc.call('/api', 'temporary-project', { title })`, waits for the Workspace projection, then calls `ctx.uiWorkspace.openWorkspace()`.
- **Bundle** ([`cordis.patch.yml`](cordis.patch.yml)): inserts the Host row; `package.json`'s `dsh.client` section declares the browser half, served through the client module table.

### Security

- Requests pass DSH Connection's Host/Origin fence and browser authentication; non-owner Peers are rejected by the shared handler before reaching the route.
- Callers cannot choose a directory path; the root is fixed and `mkdtemp` generates the project name.
- Workspace titles strip control characters, collapse whitespace, and are capped at 80 Unicode code points.
- The plugin does not read host DOM outside its components, write global styles, or load Harness Client packages as modules.

### Development and tests

No `npm install` required:

```bash
npm run check       # syntax + manifest + Host route unit tests
npm run validate    # bundle manifest/icon/locale only
npm test            # Host route unit tests only
```

CI is in [`.github/workflows/verify.yml`](.github/workflows/verify.yml); it also checks that `npm pack` contains every runtime file.

### Verification scope

- Installed on DSH 0.2.2-rc.1 with `application: applied` and no warnings; the Host row is active.
- Client registrations in `conversation.hero.options` and `shell.overlay` are active.
- All static checks and unit tests above pass.

The full click-through and final visual appearance still need a manual check in the target DSH desktop; this repository does not automate browser clicks.

### Limitations

- The chip is part of the blank New Session hero row. In current DSH, that row renders only when a blank Session is selected, so the no-session welcome state does not show it.
- The session uses DSH's configured default Agent preset and model; this entry does not offer a preset choice.
- Each click creates a new directory; there is no automatic cleanup.
- If the Host succeeds but the client Workspace projection is not ready within five seconds, the option asks the user to open the project from the project list.

### License

[MIT](LICENSE) © 2026 ZoeHao2026
