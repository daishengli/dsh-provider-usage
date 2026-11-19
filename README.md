# 提供商余额与套餐 · Provider balances and plans

在 DSH 左侧栏增加一个「提供商余额与套餐」入口，点开后面板按提供商列出**账户余额**和 **Token 套餐剩余**。

## 从 GitHub 安装

仓库：<https://github.com/daishengli/dsh-provider-usage>

在 DSH 里用 `plugin_manager` 的 `install_bundle`，target 填下面这串（`<commit>` 换成 `git rev-parse HEAD` 得到的 40 位哈希）：

```text
github:daishengli/dsh-provider-usage#<commit>
```

- **必须 pin 完整 40 位 commit**。用 `main` 分支或 tag 也能装上，但之后 DSH 检测不到更新。
- 命令行等价写法：`dsh plugin --profile desktop add "github:daishengli/dsh-provider-usage#<commit>"`。
- 升级就是换成新 commit 重新安装；改完代码要重启一次 DSH。
- 本机开发时仍建议用本地目录链接安装（`link:`），改动直接生效。

### 通过插件索引（Discover）

索引地址：

```text
https://raw.githubusercontent.com/daishengli/dsh-provider-usage/main/market/index.json
```

在 DSH 里：**Plugins → 实验性插件** 打开「Custom plugin indexes」→ 切到 **Discover** → **Add index source** → 粘贴上面的 URL → 卡片上点 **Install**（确认框会显示 git 仓库与完整 commit）。

索引由 `npm run market` 生成：它读取 `package.json`、`locale/*.json` 和当前版本的 git tag，把 `source.commit` 固定到该 tag 的提交，并做一遍格式自检。发版顺序：

```sh
# 改版本号 → 提交 → 打 tag → 生成索引 → 再提交
git commit -am "版本 1.0.2"
git tag -a v1.0.2 -m "v1.0.2"
npm run market
git commit -am "更新索引到 1.0.2"
git push origin main --tags
```

索引和图标与 `market/index.json` 同目录托管，`raw.githubusercontent.com` 直接返回 2xx，不需要 GitHub Pages；若哪天该域名不可达，把 `market/` 目录原样发布到 Pages 即可，索引里的相对图标路径仍然成立。

## 入口

- 左侧栏面板列表里的**提供商余额与套餐**（图标：钱包）。行内名字跟随界面语言，中英文都有。
- 点击后占据中间主面板，和「对话」「插件」「自动化任务」并列。
- 页面右上角有**刷新**按钮。打开页面时读取一次；30 秒内再次打开复用同一份快照，点「刷新」会跳过缓存重新读取。
- 刷新失败时上一份成功数据会保留，页面顶部提示「未能刷新，下面是 xx:xx 的数据」并给出「重试」，不会把已经读到的内容清空。

## 支持哪些提供商

面板**不猜提供商**，而是读取本机 DSH 里真实配置过的模型路由：

1. `llm.listConfigurableProviders()` 给出可配置提供商目录（provider id、显示名、默认端点、原生环境变量）；
2. 设置文档里该提供商的 profile 覆盖端点与 `apiKeyEnv`；
3. `llm.listProviders()` 判断路由是否已激活。

只有「已激活」或「设置里有 profile」的提供商会出现在列表里，目录中那些还没配置的休眠条目不会刷屏。**同一账户只出一张卡**：DeepSeek 的账号路由与 API 密钥路由按同一家族合并，以有数据的那个为主（账号优先），另一条有数据时作为卡片里的一行「API 密钥 ¥x」列出，没有任何数据的那条不再单独占一张卡。MiniMax 国际站（`minimax.io`）与国内站（`minimaxi.com`）是两套独立账号，因此各占一张卡。分组规则在 Host 与页面各实现一次：Host 已合并的载荷原样渲染，只有逐路由条目（例如 Host 半未重载时）也由页面合并，所以刷新页面就能生效。

| 提供商 | 判定方式 | 数据来源 | 显示内容 |
| --- | --- | --- | --- |
| DeepSeek 账号（`deepseek-account`） | provider id | DSH 账号服务 | 充值余额、赠金余额；钱包为 0 时标记「余额不足」 |
| DeepSeek API 密钥 | 推理主机 `api.deepseek.com` | `GET https://api.deepseek.com/user/balance` | 可用余额、充值余额、赠金余额；`is_available` 为假或余额为 0 时标记「余额不足」 |
| MiniMax（`minimax` / `minimax-cn` 等） | 推理主机 `*.minimax.io`、`*.minimaxi.com`、`*.minimax.chat` | `GET https://<主机>/v1/token_plan/remains`，业务错误时回退旧路径 `/v1/coding_plan/remains` | **5 小时窗口**与**周窗口**：进度条按**已用**增长，上方写已用百分比，下方写剩余量（`剩余 1,245 / 1,500`）与重置时间；剩余不足 20% 时条与数字转为警示色。整份返回都是 0/0 时显示「无生效套餐」，不做 0/0 展示 |
| 其他提供商 | — | 无公开查询接口 | 如实显示「无查询接口」，不做估算 |

MiniMax 的字段按接口语义解析：`current_interval_remaining_percent` / `current_weekly_remaining_percent` 优先；没有百分比时用 `total_count` 与 `usage_count`（该字段名带 usage，语义是**剩余**）换算。`end_time` / `weekly_end_time` 是毫秒重置时间。窗口的「已用」由剩余反算（`100 - 剩余`），进度条只表达已用，避免「剩余越多条越满」这种反直觉画法。

## 数据流与安全

- 页面只调用 Host 上注册的 `GET /api/provider-usage/snapshot`，走 DSH 自己的浏览器会话认证（同 `/api` 通道的 Host/Origin 校验与 Cookie），不是公开端口。
- API 密钥只在 Host 侧通过凭据服务 `ctx.credentials.resolve()` 解析，**不进入浏览器**；页面收到的是提供商返回的余额与百分比数字。
- Host 对每个提供商单独请求，单个提供商失败只影响它自己那张卡（显示「查询失败」及原因码），不会让整页空白。
- 请求超时 8 秒；快照缓存 30 秒，刷新会强制重读。

## 限制

- 只实现 DeepSeek 与 MiniMax 两种额度体系。其余提供商（Moonshot、OpenRouter、GLM、Kimi 等）暂未接入，会显示「无查询接口」。
- 套餐额度没有手工维护入口：数据要么来自提供商接口，要么如实说明没有。
- 页面用 `fetch` 走同源 HTTP；如果某个将来版本把界面改成 `file://` 加载，这个路由就读不到，页面会显示「未能读取提供商余额与套餐」。
- MiniMax 的额度接口不是官方公开文档 API，字段或路径变化时这里需要跟着调整。

## 自测

`test/` 下是四个不依赖 DSH 进程的回归脚本，用假的 provider 响应覆盖发现、余额解析、套餐窗口、旧端点回退、错误分类、页面分组与金额格式：

```sh
node test/providers.test.mjs   # 42 项：路由注册、provider 发现、DeepSeek 余额、MiniMax 5h/周窗口、回退与错误码
node test/account.test.mjs     # 12 项：DeepSeek 账号钱包、余额不足判定、未登录
node test/merge.test.mjs       # 20 项：同家族合并成一张卡、无端点路由、MiniMax 空行与仅百分比回复
node test/client.test.mjs      # 27 项：页面侧分组规则（含旧 Host 逐路由条目）、金额截断与千分位
```

两个脚本都只在本地跑，不读取真实密钥、不发真实网络请求。

## 卸载

在 **插件** 页面停用或卸载本 bundle 即可，左侧栏入口与路由会一起撤掉，不残留配置。
