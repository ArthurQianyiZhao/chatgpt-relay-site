/**
 * Cloudflare Worker: OpenAI API 中转代理
 *
 * 环境变量：
 * - OPENAI_API_KEY：必填，OpenAI API key
 * - ACCESS_CODE：可选，设置后前端必须提交相同访问码
 * - ALLOWED_ORIGIN：可选，例如 https://your-site.pages.dev；不填则允许所有来源
 *
 * 部署后访问：
 * POST https://你的-worker.workers.dev/ask
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-access-code",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/ask") {
      return json({ error: "Not found" }, 404, corsHeaders);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "Server missing OPENAI_API_KEY" }, 500, corsHeaders);
    }

    if (allowedOrigin !== "*" && origin !== allowedOrigin) {
      return json({ error: "Origin not allowed" }, 403, corsHeaders);
    }

    if (env.ACCESS_CODE) {
      const submittedCode = request.headers.get("x-access-code") || "";
      if (submittedCode !== env.ACCESS_CODE) {
        return json({ error: "访问码错误" }, 401, corsHeaders);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求体必须是 JSON" }, 400, corsHeaders);
    }

    const question = String(body.question || "").trim();

    if (!question) {
      return json({ error: "问题不能为空" }, 400, corsHeaders);
    }

    if (question.length > 4000) {
      return json({ error: "问题过长，请控制在 4000 字以内" }, 400, corsHeaders);
    }

    try {
      const openaiRes = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          input: question,
          instructions: "你是一个简洁、准确、有帮助的中文助手。"
        })
      });

      const data = await openaiRes.json();

      if (!openaiRes.ok) {
        const message = data?.error?.message || `OpenAI API error: ${openaiRes.status}`;
        return json({ error: message }, openaiRes.status, corsHeaders);
      }

      // Responses API 通常提供 output_text；这里也做一个兼容兜底。
      const answer =
        data.output_text ||
        data.output?.flatMap(item => item.content || [])
          ?.filter(part => part.type === "output_text")
          ?.map(part => part.text)
          ?.join("\n") ||
        "";

      return json({ answer }, 200, corsHeaders);
    } catch (err) {
      return json({ error: err.message || "调用 OpenAI API 失败" }, 500, corsHeaders);
    }
  }
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
