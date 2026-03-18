// Importar e iniciar todos os workers em um único processo Node.js
// Isso economiza RAM e CPU em ambiente de desenvolvimento.

console.log('[Workers] Initializing all chat workers...');

import './whatsapp-webhook.worker';
import './send-message.worker';
import './download-media.worker';
import './chat-events.worker';
import './broadcast-send.worker';
import './broadcast-prepare.worker';
import './broadcast-dispatch-contact.worker';
import './broadcast-finish.worker';
import './cobranca-regua-send.worker';
import './cobranca-regua-prepare.worker';
import '../../chatbot/worker/chatbot-events.worker';
import '../../ai_agent/worker';

console.log('[Workers] All chat workers are running in a single process.');

