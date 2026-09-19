# OMP Codex 套餐余量

在 OMP 指令输入栏下方显示当前 Codex 套餐剩余额度。

```text
Codex 套餐余量：5h 24% · 7d 26%
```

仅显示 Codex 套餐余量。Codex 接口只提供额度百分比，不提供原始剩余 token 数。

## 安装

在仓库根目录执行：

```bash
omp plugin link ./plugins/omp-codex-token-remaining
```

重启 OMP 后生效。

也可以临时加载：

```bash
omp --extension ./plugins/omp-codex-token-remaining
```

## 更新时机

插件会在会话启动、每轮对话结束、切换或整理会话后刷新额度。数据来自 OMP 内置的 `openai-codex` usage provider，并遵循 OMP 的额度缓存策略。

## 验证

```bash
cd plugins/omp-codex-token-remaining
bun test
```
