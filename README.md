# Browserless MCP Server

A powerful browser automation server using Puppeteer and Model Context Protocol (MCP) integration.

## 📋 Project Description

This is a Node.js-based server that provides:
- **Browser Automation** - Navigate web pages using Puppeteer-core
- **MCP Integration** - Easy integration with AI models
- **Screenshot Capture** - Full-page or specific element screenshots
- **User Interactions** - Click, type, scroll, and more
- **JavaScript Execution** - Run custom scripts on pages

## 🛠️ Technology Stack

- **Node.js** (v18+ or v20 LTS)
- **Express.js** - HTTP Server
- **Puppeteer-core** - Browser automation
- **MCP SDK** - Model Context Protocol integration
- **Zod** - Schema validation

## 📦 Requirements

### Local Installation
- Node.js v18 or higher (v20 LTS recommended)
- npm or yarn
- Browserless/Puppeteer service (e.g., Browserless.io)

### Docker
- Docker installed
- Docker Compose (optional)

## 🚀 Installation

### Option 1: Local Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd browserless-mcp

# Install dependencies
npm install
```

### Option 2: Run with Docker

Create a `.env` file:
```env
BROWSER_WS=wss://your-browserless-host?token=XXXX
AUTH_SECRET=your-long-random-secret-16-chars-minimum
PORT=3000
```

Build and run:
```bash
# Build the image
docker build -t browserless-mcp .

# Run the container
docker run -d -p 3000:3000 \
  -e BROWSER_WS="$(cat .env | grep BROWSER_WS | cut -d '=' -f2)" \
  -e AUTH_SECRET="$(cat .env | grep AUTH_SECRET | cut -d '=' -f2)" \
  --name browserless-mcp \
  browserless-mcp
```

**Dockerfile:**
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "server.js"]
```

### Option 3: Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## ⚙️ Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BROWSER_WS` | Browserless/Puppeteer WebSocket URL (required) | `wss://your-host?token=abc123` |
| `AUTH_SECRET` | Security token (minimum 16 characters) | `your-secure-random-string` |
| `PORT` | Server port | `3000` (default) |

## 📡 API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

**Response:**
```
ok
```

### MCP Server
```
POST /mcp
```

All requests require authentication and use JSON-RPC 2.0 format.

**Using Bearer Token:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**Using Query Parameter:**
```bash
curl -X POST "http://localhost:3000/mcp?key=YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### JSON-RPC 2.0 Request Format

All MCP requests follow the JSON-RPC 2.0 standard:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

## 🔧 Available Tools

### 1. **navigate**
Open a URL in the browser and wait for it to load.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "navigate",
      "arguments": {
        "url": "https://example.com",
        "waitUntil": "domcontentloaded"
      }
    }
  }'
```

### 2. **screenshot**
Take a screenshot of the page or specific element.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "screenshot",
      "arguments": {
        "selector": "body",
        "fullPage": true
      }
    }
  }'
```

### 3. **click**
Click an element by CSS selector.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "click",
      "arguments": {
        "selector": "button.submit"
      }
    }
  }'
```

### 4. **type**
Type text into an input field.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "type",
      "arguments": {
        "selector": "input[type=\"text\"]",
        "text": "hello world",
        "clear": true,
        "submit": false
      }
    }
  }'
```

### 5. **get_text**
Get visible text from the page or an element.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_text",
      "arguments": {
        "selector": ".content"
      }
    }
  }'
```

### 6. **get_html**
Get HTML of the page or an element.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_html",
      "arguments": {
        "selector": "body"
      }
    }
  }'
```

### 7. **scroll**
Scroll the page up or down.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "scroll",
      "arguments": {
        "direction": "down",
        "amount": 600
      }
    }
  }'
```

### 8. **evaluate**
Run JavaScript code on the page.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "evaluate",
      "arguments": {
        "script": "document.title"
      }
    }
  }'
```

### 9. **wait_for**
Wait for a CSS selector to appear or sleep for milliseconds.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "wait_for",
      "arguments": {
        "selector": ".loading-complete",
        "ms": 5000
      }
    }
  }'
```

### 10. **press_key**
Press a keyboard key (Enter, Tab, Escape, ArrowDown, etc).

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "press_key",
      "arguments": {
        "key": "Enter"
      }
    }
  }'
```

### 11. **go_back**
Go back one page in browser history.

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "go_back",
      "arguments": {}
    }
  }'
```

## 💡 Usage Examples

### Example 1: Navigate to a Website

**Request:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "navigate",
      "arguments": {
        "url": "https://example.com",
        "waitUntil": "domcontentloaded"
      }
    }
  }'
```

### Example 2: Google Search Automation

**Step 1: Navigate to Google**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "navigate",
      "arguments": {
        "url": "https://google.com"
      }
    }
  }'
```

**Step 2: Click Search Box**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "click",
      "arguments": {
        "selector": "textarea[name=\"q\"]"
      }
    }
  }'
```

**Step 3: Type Search Term**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "type",
      "arguments": {
        "selector": "textarea[name=\"q\"]",
        "text": "Node.js tutorial",
        "submit": true
      }
    }
  }'
```

### Example 3: Web Scraping

**Get Page Text:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_text",
      "arguments": {
        "selector": "body"
      }
    }
  }'
```

**Get Element HTML:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_html",
      "arguments": {
        "selector": ".article"
      }
    }
  }'
```

### Example 4: Take Screenshot

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "screenshot",
      "arguments": {
        "fullPage": true
      }
    }
  }'
```

## 🔐 Security Considerations

- Keep **AUTH_SECRET** strong and unique (minimum 16 characters)
- Store sensitive information in environment variables
- Use HTTPS in production
- Use secure tokens for Browserless service

## 📊 Limitations

- Maximum response characters: **20,000**
- Navigation timeout: **30 seconds**
- Maximum wait time: **15 seconds**
- JSON request limit: **1MB**

## 🐛 Troubleshooting

### Issue: BROWSER_WS connection failed

**Solution:**
- Verify your Browserless token is correct
- Check network connectivity
- Verify URL format

### Issue: 401 Unauthorized

**Solution:**
- Check AUTH_SECRET is correct
- Verify Bearer token header is correct
- Verify AUTH_SECRET environment variable is set

### Issue: Page not loading

**Solution:**
- Check internet connection
- Verify website is accessible
- Try adjusting `waitUntil` parameter

## 📚 Additional Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Browserless.io](https://www.browserless.io/)
- [Express.js Guide](https://expressjs.com/)

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue.

## ✉️ Contact

For any questions or issues, please open an Issue on the repository.

---

**Version:** 1.0.0 | **Last Updated:** 2026
