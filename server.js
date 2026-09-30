import express from "express";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const { BROWSER_WS, AUTH_SECRET, PORT = 3000 } = process.env;

if (!BROWSER_WS) {
  console.error("Missing env: BROWSER_WS (e.g. wss://your-browserless-host?token=XXXX)");
  process.exit(1);
}
if (!AUTH_SECRET || AUTH_SECRET.length < 16) {
  console.error("Missing/short env: AUTH_SECRET (use a long random string, 16+ chars)");
  process.exit(1);
}

const MAX_CHARS = 20000;
const NAV_TIMEOUT = 30000;

// ---------- Browser connection (kept alive across requests) ----------
let browser = null;
let page = null;
let connecting = null;

async function getPage() {
  if (!browser || !browser.connected) {
    if (!connecting) {
      connecting = puppeteer
        .connect({
          browserWSEndpoint: BROWSER_WS,
          defaultViewport: { width: 1280, height: 800 },
        })
        .then((b) => {
          browser = b;
          page = null;
          b.on("disconnected", () => {
            browser = null;
            page = null;
          });
          return b;
        })
        .finally(() => {
          connecting = null;
        });
    }
    await connecting;
  }
  if (!page || page.isClosed()) {
    const pages = await browser.pages();
    page = pages[0] ?? (await browser.newPage());
    page.setDefaultTimeout(NAV_TIMEOUT);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  }
  return page;
}

// ---------- Helpers ----------
const text = (t) => ({ content: [{ type: "text", text: String(t) }] });
const truncate = (s) =>
  s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + `\n...[truncated, ${s.length} chars total]` : s;

const wrap = (fn) => async (args) => {
  try {
    return await fn(args ?? {});
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
  }
};

// ---------- MCP tools ----------
function createServer() {
  const server = new McpServer({ name: "browserless-mcp", version: "1.0.0" });

  server.tool(
    "navigate",
    "Open a URL in the browser and wait for it to load.",
    {
      url: z.string().url(),
      waitUntil: z
        .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
        .optional()
        .describe("Default: domcontentloaded"),
    },
    wrap(async ({ url, waitUntil }) => {
      const p = await getPage();
      const res = await p.goto(url, { waitUntil: waitUntil ?? "domcontentloaded" });
      return text(`Loaded ${p.url()} (status ${res?.status() ?? "n/a"}). Title: ${await p.title()}`);
    })
  );

  server.tool(
    "go_back",
    "Go back one page in browser history.",
    {},
    wrap(async () => {
      const p = await getPage();
      await p.goBack({ waitUntil: "domcontentloaded" });
      return text(`Now at ${p.url()}`);
    })
  );

  server.tool(
    "screenshot",
    "Take a screenshot of the page (or one element via CSS selector).",
    {
      selector: z.string().optional(),
      fullPage: z.boolean().optional(),
    },
    wrap(async ({ selector, fullPage }) => {
      const p = await getPage();
      let data;
      if (selector) {
        const el = await p.waitForSelector(selector, { timeout: 10000 });
        data = await el.screenshot({ encoding: "base64", type: "jpeg", quality: 70 });
      } else {
        data = await p.screenshot({
          encoding: "base64",
          type: "jpeg",
          quality: 70,
          fullPage: !!fullPage,
        });
      }
      return { content: [{ type: "image", data, mimeType: "image/jpeg" }] };
    })
  );

  server.tool(
    "click",
    "Click an element by CSS selector.",
    { selector: z.string() },
    wrap(async ({ selector }) => {
      const p = await getPage();
      await p.waitForSelector(selector, { timeout: 10000 });
      await p.click(selector);
      return text(`Clicked ${selector}`);
    })
  );

  server.tool(
    "type",
    "Type text into an input by CSS selector. Optionally clear first and press Enter after.",
    {
      selector: z.string(),
      text: z.string(),
      clear: z.boolean().optional(),
      submit: z.boolean().optional().describe("Press Enter after typing"),
    },
    wrap(async ({ selector, text: value, clear, submit }) => {
      const p = await getPage();
      await p.waitForSelector(selector, { timeout: 10000 });
      if (clear) {
        await p.click(selector, { clickCount: 3 });
        await p.keyboard.press("Backspace");
      }
      await p.type(selector, value);
      if (submit) await p.keyboard.press("Enter");
      return text(`Typed into ${selector}`);
    })
  );

  server.tool(
    "press_key",
    "Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown).",
    { key: z.string() },
    wrap(async ({ key }) => {
      const p = await getPage();
      await p.keyboard.press(key);
      return text(`Pressed ${key}`);
    })
  );

  server.tool(
    "get_text",
    "Get visible text of the page or of an element (CSS selector).",
    { selector: z.string().optional() },
    wrap(async ({ selector }) => {
      const p = await getPage();
      const out = await p.evaluate((sel) => {
        const el = sel ? document.querySelector(sel) : document.body;
        return el ? el.innerText : null;
      }, selector ?? null);
      if (out === null) throw new Error(`Selector not found: ${selector}`);
      return text(truncate(out));
    })
  );

  server.tool(
    "get_html",
    "Get HTML of the page or of an element (CSS selector).",
    { selector: z.string().optional() },
    wrap(async ({ selector }) => {
      const p = await getPage();
      const out = await p.evaluate((sel) => {
        const el = sel ? document.querySelector(sel) : document.documentElement;
        return el ? el.outerHTML : null;
      }, selector ?? null);
      if (out === null) throw new Error(`Selector not found: ${selector}`);
      return text(truncate(out));
    })
  );

  server.tool(
    "evaluate",
    "Run a JavaScript expression in the page and return the JSON result. Example: document.title",
    { script: z.string() },
    wrap(async ({ script }) => {
      const p = await getPage();
      const result = await p.evaluate(script);
      return text(truncate(JSON.stringify(result, null, 2) ?? "undefined"));
    })
  );

  server.tool(
    "scroll",
    "Scroll the page up or down by pixels (default 600).",
    {
      direction: z.enum(["down", "up", "top", "bottom"]),
      amount: z.number().optional(),
    },
    wrap(async ({ direction, amount }) => {
      const p = await getPage();
      await p.evaluate(
        (d, a) => {
          if (d === "top") window.scrollTo(0, 0);
          else if (d === "bottom") window.scrollTo(0, document.body.scrollHeight);
          else window.scrollBy(0, d === "down" ? a : -a);
        },
        direction,
        amount ?? 600
      );
      return text(`Scrolled ${direction}`);
    })
  );

  server.tool(
    "wait_for",
    "Wait for a CSS selector to appear, or just sleep for some milliseconds (max 15000).",
    {
      selector: z.string().optional(),
      ms: z.number().optional(),
    },
    wrap(async ({ selector, ms }) => {
      const p = await getPage();
      if (selector) {
        await p.waitForSelector(selector, { timeout: Math.min(ms ?? 15000, 15000) });
        return text(`Found ${selector}`);
      }
      const d = Math.min(ms ?? 1000, 15000);
      await new Promise((r) => setTimeout(r, d));
      return text(`Waited ${d}ms`);
    })
  );

  return server;
}

// ---------- HTTP layer ----------
const app = express();
app.use(express.json({ limit: "1mb" }));

const sha = (s) => crypto.createHash("sha256").update(s).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

// Accepts "Authorization: Bearer <secret>" OR "?key=<secret>" in the URL
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : "";
  const q = typeof req.query.key === "string" ? req.query.key : "";
  const key = bearer || q;
  if (key && safeEq(key, AUTH_SECRET)) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.get("/health", (_req, res) => res.send("ok"));

app.post("/mcp", auth, async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP error:", e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const notAllowed = (_req, res) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed (stateless server, use POST)." },
    id: null,
  });
app.get("/mcp", notAllowed);
app.delete("/mcp", notAllowed);

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`browserless-mcp listening on :${PORT}  (POST /mcp)`);
});
