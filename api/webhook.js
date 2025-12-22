/**
 * Vercel Serverless Function - Proxy to n8n webhook
 * Sends request to n8n with a unique ID for polling
 */

const N8N_WEBHOOK_URL = 'https://itaied.app.n8n.cloud/webhook/contenido-ia-veo';

export const config = {
    api: {
        bodyParser: false, // Disable body parsing to handle FormData
    },
};

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export default async function handler(req, res) {
    // CORS headers - set early for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Log incoming request for debugging
    console.log('📥 Incoming request:', req.method, req.url);
    console.log('📥 Content-Type:', req.headers['content-type']);

    // Generate unique ID for this request
    const requestId = generateId();
    console.log('🆔 Generated ID:', requestId);

    try {
        console.log('📤 Sending to n8n...');

        // Collect request body
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);

        const contentType = req.headers['content-type'];
        
        // Create new body with ID field prepended
        const boundary = contentType.split('boundary=')[1];
        const idField = `--${boundary}\r\nContent-Disposition: form-data; name="request_id"\r\n\r\n${requestId}\r\n`;
        const newBody = Buffer.concat([
            Buffer.from(idField),
            body
        ]);

        // Send to n8n and WAIT for the initial response (but not the full processing)
        console.log('📤 Enviando a n8n con ID:', requestId);
        
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
            },
            body: newBody,
        });

        console.log('📥 n8n response status:', n8nResponse.status);

        // If n8n responded (even if it's just "Workflow started"), we're good
        if (n8nResponse.ok || n8nResponse.status === 200) {
            console.log('✅ n8n recibió la solicitud');
        } else {
            const errorText = await n8nResponse.text();
            console.error('❌ n8n error:', errorText);
        }

        // Respond with the ID
        console.log('✅ Respondiendo con ID:', requestId);
        return res.status(200).json({
            success: true,
            id: requestId,
            status: 'processing',
            message: 'Solicitud recibida. El contenido se está generando...'
        });

    } catch (error) {
        console.error('❌ Proxy error:', error.message);
        console.error('❌ Stack:', error.stack);
        return res.status(500).json({ 
            error: error.message,
            details: 'Error al procesar la solicitud en el servidor'
        });
    }
}
