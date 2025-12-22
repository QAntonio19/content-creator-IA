/**
 * Proxy Server for Development
 * Solves CORS issues when calling n8n webhook from localhost
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PROXY_PORT = 3001;
const N8N_WEBHOOK_URL = 'https://itaied.app.n8n.cloud/webhook/contenido-ia-veo';
const TIMEOUT_MS = 300000; // 5 minutos de timeout

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Only handle POST to /webhook
    if (req.method === 'POST' && req.url === '/webhook') {
        console.log('📤 Recibida solicitud del frontend...');
        console.log('⏳ Esperando respuesta de n8n (puede tardar varios minutos)...');

        // Collect request body
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            
            // Parse n8n URL
            const targetUrl = new URL(N8N_WEBHOOK_URL);
            
            // Forward request to n8n with extended timeout
            const proxyReq = https.request({
                hostname: targetUrl.hostname,
                port: 443,
                path: targetUrl.pathname,
                method: 'POST',
                timeout: TIMEOUT_MS,
                headers: {
                    'Content-Type': req.headers['content-type'],
                    'Content-Length': body.length
                }
            }, (proxyRes) => {
                console.log('📥 Respuesta de n8n:', proxyRes.statusCode);
                
                // Handle Cloudflare timeout error
                if (proxyRes.statusCode === 524) {
                    console.log('⚠️ Timeout de Cloudflare (524) - El workflow tardó demasiado');
                    res.writeHead(504, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ 
                        error: 'timeout',
                        message: 'El workflow tardó demasiado. El proceso continúa en n8n.'
                    }));
                    return;
                }
                
                let responseData = '';
                proxyRes.on('data', chunk => responseData += chunk);
                proxyRes.on('end', () => {
                    console.log('📦 Datos recibidos:', responseData.substring(0, 300));
                    
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(responseData);
                });
            });

            proxyReq.on('timeout', () => {
                console.error('⏰ Timeout del proxy');
                proxyReq.destroy();
                res.writeHead(504, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'timeout', message: 'Timeout esperando a n8n' }));
            });

            proxyReq.on('error', (error) => {
                console.error('❌ Error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Increase server timeout
server.timeout = TIMEOUT_MS;

server.listen(PROXY_PORT, () => {
    console.log('');
    console.log('🚀 Proxy server corriendo en http://localhost:' + PROXY_PORT);
    console.log('📡 Redirigiendo a:', N8N_WEBHOOK_URL);
    console.log('⏱️  Timeout:', TIMEOUT_MS / 1000, 'segundos');
    console.log('');
    console.log('Usa esta URL en tu frontend: http://localhost:' + PROXY_PORT + '/webhook');
    console.log('');
});