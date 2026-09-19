# Agent Plugins Marketplace

用于集中维护可安装的 Oh My Pi 插件。每个插件都是一个独立目录，`.omp-plugin/marketplace.json` 是 OMP 可识别的市场清单。

## 目录结构

```text
.
├── .omp-plugin/
│   └── marketplace.json
├── scripts/marketplace.ts
└── plugins/
    └── omp-<plugin-name>/
        ├── package.json
        ├── README.md
        └── index.ts
```

## 添加插件

插件市场由 `plugins/` 目录和 `.omp-plugin/marketplace.json` 组成。推荐使用脚手架命令创建插件：

### 1. 创建插件目录

```bash
bun run new -- omp-example
```

命令会创建 `plugins/omp-example/`，生成插件 `package.json` 和 README，并自动把插件登记到 `.omp-plugin/marketplace.json`。

### 2. 实现插件入口

编辑：

```text
plugins/omp-example/index.ts
```

入口文件必须和 `plugins/omp-example/package.json` 中的 `omp.extensions` 保持一致：

```json
{
  "omp": {
    "extensions": ["./index.ts"]
  }
}
```

### 3. 补充市场信息

在 `plugins/omp-example/package.json` 中维护插件名称、版本和描述，并在 `.omp-plugin/marketplace.json` 中补充 `category` 或其他市场信息。名称和描述需要与插件 `package.json` 一致。

### 4. 校验插件

```bash
bun run check
bun run plugins
bun test
```

`bun run check` 会检查插件路径、重复名称、清单字段和入口文件，避免把不完整的插件加入市场。

## 让 OMP 使用这个插件市场

该市场仓库位于 GitHub：

```text
https://github.com/lingmacker/agent-plugins
```

在 OMP 中注册市场：

```bash
omp plugin marketplace add lingmacker/agent-plugins
```

查看市场中的插件：

```bash
omp plugin discover
```

安装插件：

```bash
omp plugin install omp-codex-token-remaining@agent-plugins
```

查看已注册的市场和已安装插件：

```bash
omp plugin marketplace
omp plugin list
```


## 本地开发和临时加载

开发插件时，可以直接链接工作区目录：

```bash
omp plugin link ./plugins/omp-example
```

重启 OMP 后生效。只想临时加载时，可以不建立链接：

```bash
omp --extension ./plugins/omp-example
```

卸载已安装或链接的插件：

```bash
omp plugin uninstall omp-example
```

现有插件：

- [`omp-codex-token-remaining`](./plugins/omp-codex-token-remaining) — 在 OMP 提示栏显示 Codex 套餐余量。
