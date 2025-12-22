# n8n Webhook Sender

A beautiful, simple web application to send messages to your n8n workflows via webhooks.

![n8n Webhook Sender](https://img.shields.io/badge/n8n-Webhook%20Sender-FF6B6B?style=for-the-badge)

## Features

- 🎨 Modern, dark-themed UI
- 💬 Text input for your messages
- 🚀 One-click send to n8n webhook
- 💾 Saves your webhook URL locally
- ⌨️ Keyboard shortcut: `Ctrl+Enter` to send
- 📱 Fully responsive design

## Quick Start

### 1. Set up your n8n Webhook

1. Open your n8n instance
2. Create a new workflow
3. Add a **Webhook** node as the trigger
4. Configure it:
   - **HTTP Method**: POST
   - **Path**: Choose any path (e.g., `my-webhook`)
5. Copy the **Webhook URL** (click "Test URL" or "Production URL")

### 2. Use the Sender

1. Open `index.html` in your browser
2. Paste your n8n webhook URL in the first field
3. Type your message
4. Click **Send to n8n** (or press `Ctrl+Enter`)

## Data Format

The sender posts JSON data in this format:

```json
{
  "message": "Your message text here",
  "timestamp": "2024-12-12T10:30:00.000Z",
  "source": "n8n-webhook-sender"
}
```

## Handling CORS

If you're running n8n locally and encounter CORS errors:

### Option 1: Disable CORS in n8n (Development only)
```bash
N8N_CORS_ALLOWED_ORIGINS=* n8n start
```

### Option 2: Use a local server
Run a simple local server:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## File Structure

```
n8n_webhook/
├── index.html    # Main HTML file
├── styles.css    # Styling
├── script.js     # JavaScript logic
└── README.md     # This file
```

## Browser Compatibility

Works in all modern browsers:
- Chrome / Edge (Chromium)
- Firefox
- Safari

## License

MIT License - Feel free to use and modify!



