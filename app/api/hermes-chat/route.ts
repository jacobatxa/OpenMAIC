/**
 * Hermes Chat API - Simple DeepSeek-powered chat for the "豆包后台" PWA
 * POST /api/hermes-chat
 * Body: { messages: [{role, content}], model?: string }
 * Response: SSE stream of response text
 */
import { NextRequest } from 'next/server';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const body = await req.json();
    const { messages, model = 'deepseek-chat' } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Heartbeat to keep connection alive
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatTimer = setInterval(() => {
        writer.write(encoder.encode(`:heartbeat\n\n`)).catch(() => stopHeartbeat());
      }, 15000);
    };
    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const streamResponse = async () => {
      try {
        startHeartbeat();

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `你是一个AI助手，运行在 Hermes Agent 框架上。你可以帮助用户管理定时任务、查询信息、执行各种操作。

当前可用的定时任务：
1. Stock Results — 美股盘后报告（周二至六 06:00 北京时间）
2. AI News Digest — AI新闻摘要（每6小时）
3. Daily Morning Briefing — 晨间简报（周一至五 08:30 北京时间）
4. Feed Page Rebuilder — Feed页面重建（每6小时，已暂停）

你可以帮用户：
- 查看/管理定时任务
- 查询股票行情
- 生成报告
- 其他AI助手功能

回复要简洁、实用，用中文。`,
              },
              ...messages,
            ],
            stream: true,
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          writer.write(encoder.encode(`data: ${JSON.stringify({ error: `API error: ${response.status} ${errBody}` })}\n\n`));
          writer.write(encoder.encode(`data: [DONE]\n\n`));
          writer.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`));
          writer.write(encoder.encode(`data: [DONE]\n\n`));
          writer.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }

        // Flush remaining buffer
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {}
          }
        }

        writer.write(encoder.encode(`data: [DONE]\n\n`));
      } catch (err: any) {
        writer.write(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        writer.write(encoder.encode(`data: [DONE]\n\n`));
      } finally {
        stopHeartbeat();
        try { await writer.close(); } catch {}
      }
    };

    streamResponse();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
