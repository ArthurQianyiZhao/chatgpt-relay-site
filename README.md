# ChatGPT 会话中转站

这是一个最小可部署版本：

- `index.html`：静态网页，支持当前 session 的上下文记忆
- `worker.js`：Cloudflare Worker 后端代理，安全保存 OpenAI API key
- `wrangler.toml.example`：Cloudflare Wrangler 配置示例

## 实现方式

静态网页不能自己“让模型记住上下文”。这个版本用浏览器的 `sessionStorage` 保存当前标签页里的聊天记录。

每次用户提问时，前端会把最近的 `messages` 一起发给 Worker，Worker 再调用 OpenAI Responses API。

效果：

- 同一个浏览器标签页里可以连续追问
- 刷新页面后通常仍保留上下文
- 关闭标签页后通常清空
- 不需要数据库
- 不跨设备同步

如果你需要长期记忆、账号系统、跨设备同步，需要再加数据库，例如 Cloudflare KV、D1、Supabase 等。

## 文件说明

```text
index.html
worker.js
wrangler.toml.example
README.md
```

## 第一步：部署 Cloudflare Worker

创建一个 Cloudflare Worker，把 `worker.js` 内容复制进去。

设置环境变量：

### 必填

```text
OPENAI_API_KEY=你的 OpenAI API key
```

### 可选

```text
OPENAI_MODEL=gpt-5.5
ACCESS_CODE=你想设置的访问码
ALLOWED_ORIGIN=https://你的静态站地址
MAX_MESSAGES=24
MAX_CHARS_PER_MESSAGE=4000
```

说明：

- `OPENAI_MODEL` 不填时默认使用 `gpt-5.5`
- `ACCESS_CODE` 设置后，前端也要开启访问码输入框
- `ALLOWED_ORIGIN` 建议填写你的静态站域名，减少被其他网站盗用
- `MAX_MESSAGES` 控制每次最多带多少条上下文，越多越贵、越慢
- `MAX_CHARS_PER_MESSAGE` 控制单条消息最大长度

部署完成后，你会得到类似：

```text
https://chatgpt-relay.yourname.workers.dev
```

真正请求地址是：

```text
https://chatgpt-relay.yourname.workers.dev/ask
```

## 第二步：修改 index.html

打开 `index.html`，找到：

```js
const API_URL = "https://YOUR-WORKER-SUBDOMAIN.workers.dev/ask";
```

改成你的 Worker `/ask` 地址。

如果你设置了 Worker 的 `ACCESS_CODE`，再找到：

```js
const REQUIRE_ACCESS_CODE = false;
```

改成：

```js
const REQUIRE_ACCESS_CODE = true;
```

## 第三步：部署静态网页

把 `index.html` 上传到任意静态网站托管服务，例如：

- Cloudflare Pages
- GitHub Pages
- Netlify
- Vercel Static
- 你自己的 Nginx / Apache 静态目录

## 本地测试

直接双击打开 `index.html` 可能会因为浏览器安全策略或 Worker 的 `ALLOWED_ORIGIN` 配置遇到问题。更推荐用本地静态服务器测试。

例如有 Python 的话：

```bash
python3 -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

如果你设置了 `ALLOWED_ORIGIN`，本地测试时需要临时设为：

```text
ALLOWED_ORIGIN=http://localhost:8080
```

或者先不设置 `ALLOWED_ORIGIN`。

## 重要安全提醒

不要把 OpenAI API key 写进 `index.html`。任何访问者都可以查看前端源码。

API key 必须只放在 Worker 的环境变量里。
