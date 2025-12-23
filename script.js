/**
 * n8n Form Sender
 * Sends messages and images to n8n workflow via Form Trigger
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const charCount = document.getElementById('charCount');
    const notification = document.getElementById('notification');
    
    // Image elements
    const imageInput = document.getElementById('imageInput');
    const imageUploadArea = document.getElementById('imageUploadArea');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const imageInfo = document.getElementById('imageInfo');

    // Results elements
    const resultsSection = document.getElementById('resultsSection');
    const imageResultLink = document.getElementById('imageResultLink');
    const videoResultLink = document.getElementById('videoResultLink');
    const copyImageLink = document.getElementById('copyImageLink');
    const copyVideoLink = document.getElementById('copyVideoLink');
    const downloadImageLink = document.getElementById('downloadImageLink');
    const downloadVideoLink = document.getElementById('downloadVideoLink');

    // Constants
    const NOTIFICATION_DURATION = 4000;
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (initial validation)
    
    // Detect environment - use proxy for local development
    const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const WEBHOOK_URL = IS_LOCAL ? 'http://localhost:3001/webhook' : '/api/webhook';
    const CHECK_STATUS_URL = IS_LOCAL ? 'http://localhost:3001/check-status' : '/api/check-status';
    const POLLING_INTERVAL = 10000; // 10 seconds
    const MAX_POLLING_TIME = 300000; // 5 minutes max (timeout)

    // State
    let currentImageFile = null;
    let pollingInterval = null;
    let pollingStartTime = null;

    // Initialize
    init();

    function init() {
        // Event Listeners
        messageInput.addEventListener('input', updateCharCount);
        sendBtn.addEventListener('click', handleSend);

        // Enable sending with Ctrl+Enter
        messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                handleSend();
            }
        });

        // Image upload events
        imageInput.addEventListener('change', handleImageSelect);
        removeImageBtn.addEventListener('click', removeImage);
        
        // Drag and drop
        imageUploadArea.addEventListener('dragover', handleDragOver);
        imageUploadArea.addEventListener('dragleave', handleDragLeave);
        imageUploadArea.addEventListener('drop', handleDrop);

        // Copy buttons
        copyImageLink.addEventListener('click', () => copyToClipboard(imageResultLink.value, 'Link de imagen copiado'));
        copyVideoLink.addEventListener('click', () => copyToClipboard(videoResultLink.value, 'Link de video copiado'));

        // Download buttons
        downloadImageLink.addEventListener('click', () => downloadFile(imageResultLink.value, 'imagen'));
        downloadVideoLink.addEventListener('click', () => downloadFile(videoResultLink.value, 'video'));
    }

    function updateCharCount() {
        charCount.textContent = messageInput.value.length;
    }

    // Image handling functions
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        imageUploadArea.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        imageUploadArea.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        imageUploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processImageFile(files[0]);
        }
    }

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (file) {
            processImageFile(file);
        }
    }

    function processImageFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file', 'error');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            showNotification('Image must be less than 10MB', 'error');
            return;
        }

        // Store the actual file for FormData
        currentImageFile = file;

        // Read file for preview
        const reader = new FileReader();
        reader.onload = (e) => {
            // Update preview
            imagePreview.src = e.target.result;
            imageUploadArea.classList.add('has-image');
            
            // Update info
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            imageInfo.textContent = `${file.name} (${sizeMB} MB)`;
        };
        reader.readAsDataURL(file);
    }

    function removeImage(e) {
        e.preventDefault();
        e.stopPropagation();
        
        currentImageFile = null;
        imageInput.value = '';
        imagePreview.src = '';
        imageUploadArea.classList.remove('has-image');
        imageInfo.textContent = '';
    }


    async function handleSend() {
        const message = messageInput.value.trim();

        // Validation
        if (!message) {
            showNotification('Por favor ingresa una descripción', 'error');
            messageInput.focus();
            return;
        }

        if (!currentImageFile) {
            showNotification('Por favor selecciona una imagen', 'error');
            return;
        }

        // Send the request
        await sendToForm(WEBHOOK_URL, message);
    }

    async function sendToForm(url, message) {
        // Set loading state
        sendBtn.classList.add('loading');
        sendBtn.disabled = true;
        
        // Show processing status
        showProcessingStatus('Preparando imagen...');

        try {
            let imageToSend = currentImageFile;

            showProcessingStatus('Enviando datos...');

            // Create FormData for n8n Form Trigger
            const formData = new FormData();
            
            // Add fields matching n8n form configuration
            formData.append('Descripcion de producto', message);
            formData.append('Imagen', imageToSend);

            console.log('📤 Enviando a:', url);
            console.log('📤 Tamaño de imagen:', (imageToSend.size / 1024 / 1024).toFixed(2), 'MB');

            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            console.log('📥 Response status:', response.status);

            const responseText = await response.text();
            console.log('📥 Response text:', responseText);

            if (response.ok) {
                const responseData = JSON.parse(responseText);
                console.log('✅ Respuesta:', responseData);
                
                if (responseData.id) {
                    // Start polling for results
                    console.log('🔄 Iniciando polling con ID:', responseData.id);
                    showProcessingStatus('Generando contenido con IA... (esto puede tardar 2-3 minutos)');
                    clearForm();
                    startPolling(responseData.id);
                } else {
                    // Direct response (legacy)
                    hideProcessingStatus();
                    showNotification('¡Enviado correctamente!', 'success');
                    showResults(responseData);
                    clearForm();
                    sendBtn.classList.remove('loading');
                    sendBtn.disabled = false;
                }
            } else {
                console.error('❌ Server error:', responseText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Form submission error:', error);
            hideProcessingStatus();
            sendBtn.classList.remove('loading');
            sendBtn.disabled = false;
            
            let errorMessage = 'Error al enviar';
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                errorMessage = 'No se pudo conectar al servidor.';
            } else if (error.message.includes('HTTP')) {
                errorMessage = error.message;
            }
            
            showNotification(errorMessage, 'error');
        }
    }

    function startPolling(requestId) {
        pollingStartTime = Date.now();
        let pollCount = 0;
        
        console.log('🔄 Polling iniciado para ID:', requestId);
        
        // Show results section with "processing" state
        resultsSection.classList.remove('hidden');
        imageResultLink.value = '⏳ Procesando...';
        videoResultLink.value = '⏳ Procesando...';
        
        pollingInterval = setInterval(async () => {
            pollCount++;
            const elapsed = Date.now() - pollingStartTime;
            const elapsedMin = Math.floor(elapsed / 60000);
            const elapsedSec = Math.floor((elapsed % 60000) / 1000);
            
            console.log(`🔍 Polling #${pollCount} (${elapsedMin}m ${elapsedSec}s)...`);
            showProcessingStatus(`Generando contenido... (${elapsedMin}:${elapsedSec.toString().padStart(2, '0')})`);
            
            // Check if max time exceeded (5 minutes timeout)
            if (elapsed > MAX_POLLING_TIME) {
                stopPolling();
                hideProcessingStatus();
                sendBtn.classList.remove('loading');
                sendBtn.disabled = false;
                
                // Show timeout error in results section
                resultsSection.classList.remove('hidden');
                imageResultLink.value = '❌ Tiempo de espera agotado';
                videoResultLink.value = '❌ Tiempo de espera agotado';
                
                // Show prominent error alert
                showTimeoutAlert();
                return;
            }
            
            try {
                const response = await fetch(`${CHECK_STATUS_URL}?id=${requestId}`);
                const data = await response.json();
                
                console.log('📥 Polling response:', data);
                
                if (data.status === 'completed' && data.data) {
                    // Success! Show results
                    stopPolling();
                    hideProcessingStatus();
                    sendBtn.classList.remove('loading');
                    sendBtn.disabled = false;
                    
                    showNotification('¡Contenido generado exitosamente!', 'success');
                    showResults({
                        file_name: data.data.file_url,
                        video_name: data.data.video_url
                    });
                }
            } catch (error) {
                console.error('❌ Polling error:', error);
            }
        }, POLLING_INTERVAL);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            console.log('🛑 Polling detenido');
        }
    }
    
    function showProcessingStatus(message) {
        let statusEl = document.getElementById('processingStatus');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'processingStatus';
            statusEl.className = 'processing-status';
            sendBtn.parentNode.insertBefore(statusEl, sendBtn.nextSibling);
        }
        statusEl.innerHTML = `
            <div class="processing-spinner"></div>
            <span>${message}</span>
        `;
        statusEl.classList.add('show');
    }
    
    function hideProcessingStatus() {
        const statusEl = document.getElementById('processingStatus');
        if (statusEl) {
            statusEl.classList.remove('show');
        }
    }
    
    function showTimeoutMessage() {
        resultsSection.classList.remove('hidden');
        imageResultLink.value = '⏳ Proceso en curso - revisa n8n';
        videoResultLink.value = '⏳ Proceso en curso - revisa n8n';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showTimeoutAlert() {
        // Create overlay for alert
        const overlay = document.createElement('div');
        overlay.id = 'timeoutOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease;
        `;

        // Create alert box
        const alertBox = document.createElement('div');
        alertBox.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #e74c3c;
            border-radius: 16px;
            padding: 32px 40px;
            max-width: 450px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(231, 76, 60, 0.3);
            animation: slideIn 0.3s ease;
        `;

        alertBox.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 16px;">⏰</div>
            <h2 style="color: #e74c3c; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">
                Tiempo de Espera Agotado
            </h2>
            <p style="color: #a0a0a0; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Han pasado más de <strong style="color: #fff;">5 minutos</strong> sin recibir respuesta del servidor. 
                El proceso ha sido detenido.
            </p>
            <p style="color: #888; margin: 0 0 24px 0; font-size: 14px;">
                Por favor, verifica el estado en n8n o intenta nuevamente.
            </p>
            <button id="closeTimeoutAlert" style="
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
                border: none;
                padding: 14px 32px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            ">
                Entendido
            </button>
        `;

        overlay.appendChild(alertBox);
        document.body.appendChild(overlay);

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: scale(0.8) translateY(-20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            #closeTimeoutAlert:hover {
                transform: scale(1.05);
                box-shadow: 0 8px 25px rgba(231, 76, 60, 0.4);
            }
        `;
        document.head.appendChild(style);

        // Close button handler
        document.getElementById('closeTimeoutAlert').addEventListener('click', () => {
            overlay.style.animation = 'fadeIn 0.2s ease reverse';
            setTimeout(() => {
                overlay.remove();
                style.remove();
            }, 200);
        });

        // Also close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.animation = 'fadeIn 0.2s ease reverse';
                setTimeout(() => {
                    overlay.remove();
                    style.remove();
                }, 200);
            }
        });
    }

    function clearForm() {
        messageInput.value = '';
        updateCharCount();
        removeImage({ preventDefault: () => {}, stopPropagation: () => {} });
    }

    function showResults(data) {
        // Show results section
        resultsSection.classList.remove('hidden');
        
        // Populate fields with response data from n8n
        // n8n returns:
        //   file_name: webContentLinkIMG (link de imagen)
        //   file_url: nameIMG (nombre de imagen)
        //   video_name: webContentLinkVID (link de video)
        //   video_url: nameVID (nombre de video)
        if (data) {
            // Usar file_name para el link de imagen (contiene webContentLinkIMG)
            // Usar video_name para el link de video (contiene webContentLinkVID)
            imageResultLink.value = data.file_name || '';
            videoResultLink.value = data.video_name || '';
            
            console.log('📋 Resultados recibidos:');
            console.log('   🖼️ Imagen Link:', data.file_name || 'No disponible');
            console.log('   🖼️ Imagen Nombre:', data.file_url || 'No disponible');
            console.log('   🎬 Video Link:', data.video_name || 'No disponible');
            console.log('   🎬 Video Nombre:', data.video_url || 'No disponible');
        } else {
            imageResultLink.value = '';
            videoResultLink.value = '';
        }
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function copyToClipboard(text, successMessage) {
        if (!text) {
            showNotification('No hay link para copiar', 'error');
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showNotification(successMessage, 'success');
        }).catch(() => {
            showNotification('Error al copiar', 'error');
        });
    }

    async function downloadFile(url, type) {
        if (!url) {
            showNotification(`No hay ${type} para descargar`, 'error');
            return;
        }

        try {
            showNotification(`Descargando ${type}...`, 'success');
            
            // Determine file extension based on type
            const extension = type === 'video' ? '.mp4' : '.png';
            const filename = `${type}_${Date.now()}${extension}`;
            
            // Create a temporary link to force download with correct name
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.target = '_blank';
            
            // For Google Drive links, we need to open in new tab
            // as they handle the download themselves
            if (url.includes('drive.google.com')) {
                // Add export=download if not present
                const downloadUrl = url.includes('export=download') ? url : url + '&export=download';
                window.open(downloadUrl, '_blank');
            } else {
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Error downloading:', error);
            // Fallback: open in new tab
            window.open(url, '_blank');
        }
    }

    function showNotification(message, type = 'success') {
        const notificationIcon = notification.querySelector('.notification-icon');
        const notificationText = notification.querySelector('.notification-text');

        // Set content
        notificationIcon.textContent = type === 'success' ? '✓' : '✕';
        notificationText.textContent = message;

        // Set type class
        notification.classList.remove('success', 'error');
        notification.classList.add(type);

        // Show notification
        notification.classList.add('show');

        // Hide after duration
        setTimeout(() => {
            notification.classList.remove('show');
        }, NOTIFICATION_DURATION);
    }
});