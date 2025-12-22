/**
 * Vercel Serverless Function - Check status from Google Sheets
 * Polls Google Sheets to get results by ID
 */

const SHEET_ID = '13cqf39Q1xICgXh7TyXElUAMcq9Hx9pL9Sej4WIHnY8o';
const SHEET_NAME = 'Hoja 1';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'ID is required' });
    }

    try {
        console.log('🔍 Buscando ID:', id);

        // Fetch Google Sheet as JSON
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
        
        const response = await fetch(csvUrl);
        const text = await response.text();
        
        // Parse Google's JSON response
        const jsonText = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (!jsonText) {
            console.log('⚠️ No se pudo parsear la respuesta del Sheet');
            return res.status(200).json({ 
                found: false, 
                status: 'pending',
                message: 'Procesando...' 
            });
        }

        const data = JSON.parse(jsonText[1]);
        const rows = data.table.rows;

        console.log('📊 Filas encontradas:', rows.length);

        // Find the row with matching ID (column A = index 0)
        for (const row of rows) {
            if (!row.c || !row.c[0]) continue;
            
            const rowId = String(row.c[0].v || '').trim();
            
            if (rowId === id) {
                // Get values, handling null cells
                const getValue = (cell) => cell?.v ?? cell?.f ?? '';
                
                const status = String(getValue(row.c[1])).toLowerCase().trim();
                const imageName = getValue(row.c[2]);
                const imageUrl = getValue(row.c[3]);
                const videoName = getValue(row.c[4]);
                const videoUrl = getValue(row.c[5]);

                console.log('✅ Encontrado!');
                console.log('   ID:', rowId);
                console.log('   Estado:', status);
                console.log('   Imagen URL:', imageUrl);
                console.log('   Video URL:', videoUrl);

                // Check if completed
                if (status === 'completado' || status === 'completed' || status === 'true') {
                    return res.status(200).json({
                        found: true,
                        status: 'completed',
                        data: {
                            file_name: imageName,
                            file_url: imageUrl,
                            video_name: videoName,
                            video_url: videoUrl
                        }
                    });
                } else {
                    return res.status(200).json({
                        found: true,
                        status: 'pending',
                        message: 'Aún procesando...'
                    });
                }
            }
        }

        // ID not found yet
        console.log('⏳ ID no encontrado');
        return res.status(200).json({
            found: false,
            status: 'pending',
            message: 'Procesando...'
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        return res.status(500).json({ error: error.message });
    }
}
