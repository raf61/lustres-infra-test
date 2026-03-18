"use strict";
/**
 * NFe.io Webhook Server
 *
 * Servidor standalone que recebe webhooks da Nfe.io e atualiza o status
 * das notas fiscais no banco de dados. Comportamento idêntico ao SyncNfeUseCase.
 *
 * Eventos tratados:
 *   - issued_successfully  → status AUTHORIZED + download XML
 *   - issued_error         → status ERROR
 *   - issued_failed        → status ERROR
 *   - cancelled_successfully → status CANCELLED
 *   - cancelled_error      → apenas log (mantém status atual para permitir nova tentativa)
 *   - cancelled_failed     → apenas log (mantém status atual para permitir nova tentativa)
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNfeWebhookServer = startNfeWebhookServer;
// @ts-ignore - Express types not installed
var express_1 = require("express");
var crypto_1 = require("crypto");
var dotenv_1 = require("dotenv");
var client_1 = require("@prisma/client");
var client_s3_1 = require("@aws-sdk/client-s3");
dotenv_1.default.config();
// ─── Prisma ────────────────────────────────────────────────────────────────────
var prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error']
});
// ─── S3 Storage (inline, sem depender de @/ alias) ─────────────────────────────
function getEnv(name) {
    var v = process.env[name];
    if (!v)
        throw new Error("[nfe-webhook] Missing env: ".concat(name));
    return v;
}
function getS3Client() {
    var region = getEnv('S3_REGION');
    var host = getEnv('S3_HOST');
    var endpoint = host.startsWith('http') ? host : "https://".concat(host);
    return new client_s3_1.S3Client({
        region: region,
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: getEnv('S3_ACCESS_KEY'),
            secretAccessKey: getEnv('S3_SECRET_KEY'),
        },
    });
}
function uploadXmlToS3(nfeDbId, xmlContent) {
    return __awaiter(this, void 0, void 0, function () {
        var bucket, key, client, endpoint;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bucket = getEnv('S3_BUCKET');
                    key = "notafiscal/xml/".concat(nfeDbId, ".xml");
                    client = getS3Client();
                    return [4 /*yield*/, client.send(new client_s3_1.PutObjectCommand({
                            Bucket: bucket,
                            Key: key,
                            Body: Buffer.from(xmlContent),
                            ContentType: 'application/xml',
                            ACL: 'private',
                        }))];
                case 1:
                    _a.sent();
                    endpoint = (getEnv('S3_HOST').startsWith('http') ? getEnv('S3_HOST') : "https://".concat(getEnv('S3_HOST'))).replace(/\/$/, '');
                    return [2 /*return*/, "".concat(endpoint, "/").concat(bucket, "/").concat(key)];
            }
        });
    });
}
// ─── NFe.io API Helper ─────────────────────────────────────────────────────────
function downloadXmlFromNfeIo(companyId, invoiceId) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, url, controller, timeout, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = process.env.NFE_IO_API_KEY;
                    if (!apiKey)
                        throw new Error('NFE_IO_API_KEY não configurada');
                    url = "https://api.nfe.io/v1/companies/".concat(companyId, "/serviceinvoices/").concat(invoiceId, "/xml");
                    controller = new AbortController();
                    timeout = setTimeout(function () { return controller.abort(); }, 120000);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 4, 5]);
                    return [4 /*yield*/, fetch(url, {
                            headers: { 'Authorization': apiKey },
                            signal: controller.signal,
                        })];
                case 2:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("Nfe.io XML download failed: ".concat(res.status));
                    return [4 /*yield*/, res.text()];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ─── Buscar NFe local pelo nfeIoId ─────────────────────────────────────────────
function findNfeByIoId(nfeIoId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma.nfe.findFirst({
                    where: { nfeIoId: nfeIoId },
                })];
        });
    });
}
// ─── Handlers por ação ─────────────────────────────────────────────────────────
//
// Cada handler recebe o payload completo do webhook e é IDEMPOTENTE:
// se chamado múltiplas vezes com o mesmo payload, o resultado é o mesmo.
//
// O comportamento é IDÊNTICO ao SyncNfeUseCase para o mesmo status.
/**
 * issued_successfully → AUTHORIZED
 *
 * Coerente com SyncNfeUseCase quando remoteStatus === 'Issued':
 * - Seta status AUTHORIZED
 * - Salva number, verificationCode, issuedOn
 * - Se não tem XML, baixa e salva no S3
 */
function handleIssuedSuccessfully(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var nfe, updateData, xmlContent, url, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNfeByIoId(payload.id)];
                case 1:
                    nfe = _a.sent();
                    if (!nfe) {
                        console.warn("[nfe-webhook] issued_successfully: NFe n\u00E3o encontrada para nfeIoId=".concat(payload.id));
                        return [2 /*return*/, { updated: false, action: 'issued_successfully' }];
                    }
                    // Idempotência: se já está AUTHORIZED com número, verifica se precisa de XML apenas
                    if (nfe.status === 'AUTHORIZED' && nfe.number && nfe.xml) {
                        console.log("[nfe-webhook] issued_successfully: NFe ".concat(nfe.id, " j\u00E1 est\u00E1 AUTHORIZED com XML. Ignorando."));
                        return [2 /*return*/, { updated: false, action: 'issued_successfully' }];
                    }
                    updateData = {
                        status: 'AUTHORIZED',
                        number: payload.number ? String(payload.number) : undefined,
                        verificationCode: payload.checkCode || payload.verificationCode || undefined,
                        issuedOn: payload.issuedOn ? new Date(payload.issuedOn) : undefined,
                    };
                    if (!!nfe.xml) return [3 /*break*/, 7];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    console.log("[nfe-webhook] Baixando XML para conformidade legal (NFe ".concat(nfe.id, ")..."));
                    return [4 /*yield*/, downloadXmlFromNfeIo(nfe.companyId, nfe.nfeIoId)];
                case 3:
                    xmlContent = _a.sent();
                    if (!xmlContent) return [3 /*break*/, 5];
                    return [4 /*yield*/, uploadXmlToS3(nfe.id, xmlContent)];
                case 4:
                    url = _a.sent();
                    updateData.xml = url;
                    console.log("[nfe-webhook] XML salvo: ".concat(url));
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    err_1 = _a.sent();
                    console.error("[nfe-webhook] Falha ao baixar XML autom\u00E1tico: ".concat(err_1));
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, prisma.nfe.update({ where: { id: nfe.id }, data: updateData })];
                case 8:
                    _a.sent();
                    console.log("[nfe-webhook] \u2705 NFe ".concat(nfe.id, " \u2192 AUTHORIZED (number: ").concat(updateData.number, ")"));
                    return [2 /*return*/, { updated: true, action: 'issued_successfully' }];
            }
        });
    });
}
/**
 * issued_error → ERROR
 *
 * Coerente com SyncNfeUseCase quando remoteStatus === 'Error' ou 'Denied'
 */
function handleIssuedError(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var nfe, flowMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNfeByIoId(payload.id)];
                case 1:
                    nfe = _a.sent();
                    if (!nfe) {
                        console.warn("[nfe-webhook] issued_error: NFe n\u00E3o encontrada para nfeIoId=".concat(payload.id));
                        return [2 /*return*/, { updated: false, action: 'issued_error' }];
                    }
                    // Idempotência: já está em ERROR
                    if (nfe.status === 'ERROR') {
                        console.log("[nfe-webhook] issued_error: NFe ".concat(nfe.id, " j\u00E1 est\u00E1 ERROR. Ignorando."));
                        return [2 /*return*/, { updated: false, action: 'issued_error' }];
                    }
                    // Não sobrescreve um status "final positivo"
                    if (nfe.status === 'AUTHORIZED') {
                        console.warn("[nfe-webhook] issued_error: NFe ".concat(nfe.id, " j\u00E1 est\u00E1 AUTHORIZED. N\u00E3o vou regredir para ERROR."));
                        return [2 /*return*/, { updated: false, action: 'issued_error' }];
                    }
                    flowMessage = payload.flowMessage || '';
                    return [4 /*yield*/, prisma.nfe.update({ where: { id: nfe.id }, data: { status: 'ERROR' } })];
                case 2:
                    _a.sent();
                    console.log("[nfe-webhook] \u274C NFe ".concat(nfe.id, " \u2192 ERROR (flowMessage: ").concat(flowMessage, ")"));
                    return [2 /*return*/, { updated: true, action: 'issued_error' }];
            }
        });
    });
}
/**
 * issued_failed → ERROR
 *
 * Mesmo comportamento que issued_error
 */
function handleIssuedFailed(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var nfe, flowMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNfeByIoId(payload.id)];
                case 1:
                    nfe = _a.sent();
                    if (!nfe) {
                        console.warn("[nfe-webhook] issued_failed: NFe n\u00E3o encontrada para nfeIoId=".concat(payload.id));
                        return [2 /*return*/, { updated: false, action: 'issued_failed' }];
                    }
                    if (nfe.status === 'ERROR') {
                        console.log("[nfe-webhook] issued_failed: NFe ".concat(nfe.id, " j\u00E1 est\u00E1 ERROR. Ignorando."));
                        return [2 /*return*/, { updated: false, action: 'issued_failed' }];
                    }
                    if (nfe.status === 'AUTHORIZED') {
                        console.warn("[nfe-webhook] issued_failed: NFe ".concat(nfe.id, " j\u00E1 est\u00E1 AUTHORIZED. N\u00E3o vou regredir para ERROR."));
                        return [2 /*return*/, { updated: false, action: 'issued_failed' }];
                    }
                    flowMessage = payload.flowMessage || '';
                    return [4 /*yield*/, prisma.nfe.update({ where: { id: nfe.id }, data: { status: 'ERROR' } })];
                case 2:
                    _a.sent();
                    console.log("[nfe-webhook] \u274C NFe ".concat(nfe.id, " \u2192 ERROR (issued_failed, msg: ").concat(flowMessage, ")"));
                    return [2 /*return*/, { updated: true, action: 'issued_failed' }];
            }
        });
    });
}
/**
 * cancelled_successfully → CANCELLED
 *
 * Coerente com SyncNfeUseCase quando remoteStatus === 'Cancelled'
 */
function handleCancelledSuccessfully(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var nfe;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNfeByIoId(payload.id)];
                case 1:
                    nfe = _a.sent();
                    if (!nfe) {
                        console.warn("[nfe-webhook] cancelled_successfully: NFe n\u00E3o encontrada para nfeIoId=".concat(payload.id));
                        return [2 /*return*/, { updated: false, action: 'cancelled_successfully' }];
                    }
                    // Idempotência: já está cancelada
                    if (nfe.status === 'CANCELLED') {
                        console.log("[nfe-webhook] cancelled_successfully: NFe ".concat(nfe.id, " j\u00E1 est\u00E1 CANCELLED. Ignorando."));
                        return [2 /*return*/, { updated: false, action: 'cancelled_successfully' }];
                    }
                    return [4 /*yield*/, prisma.nfe.update({ where: { id: nfe.id }, data: { status: 'CANCELLED' } })];
                case 2:
                    _a.sent();
                    console.log("[nfe-webhook] \uD83D\uDEAB NFe ".concat(nfe.id, " \u2192 CANCELLED"));
                    return [2 /*return*/, { updated: true, action: 'cancelled_successfully' }];
            }
        });
    });
}
/**
 * cancelled_error → NÃO altera status
 *
 * Falha ao cancelar: a nota continua com o status atual.
 * Não setamos ERROR para que o usuário possa tentar cancelar novamente.
 * Apenas logamos para investigação.
 */
function handleCancelledError(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var nfe, flowMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNfeByIoId(payload.id)];
                case 1:
                    nfe = _a.sent();
                    if (!nfe) {
                        console.warn("[nfe-webhook] cancelled_error: NFe n\u00E3o encontrada para nfeIoId=".concat(payload.id));
                        return [2 /*return*/, { updated: false, action: 'cancelled_error' }];
                    }
                    flowMessage = payload.flowMessage || '';
                    console.error("[nfe-webhook] \u26A0\uFE0F Falha no cancelamento da NFe ".concat(nfe.id, " (nfeIoId: ").concat(payload.id, "). Status mantido: ").concat(nfe.status, ". Msg: ").concat(flowMessage));
                    return [2 /*return*/, { updated: false, action: 'cancelled_error' }];
            }
        });
    });
}
/**
 * cancelled_failed → NÃO altera status
 *
 * Mesmo comportamento que cancelled_error: mantém status para permitir retry.
 */
function handleCancelledFailed(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var nfe, flowMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNfeByIoId(payload.id)];
                case 1:
                    nfe = _a.sent();
                    if (!nfe) {
                        console.warn("[nfe-webhook] cancelled_failed: NFe n\u00E3o encontrada para nfeIoId=".concat(payload.id));
                        return [2 /*return*/, { updated: false, action: 'cancelled_failed' }];
                    }
                    flowMessage = payload.flowMessage || '';
                    console.error("[nfe-webhook] \u26A0\uFE0F Falha no cancelamento da NFe ".concat(nfe.id, " (nfeIoId: ").concat(payload.id, "). Status mantido: ").concat(nfe.status, ". Msg: ").concat(flowMessage));
                    return [2 /*return*/, { updated: false, action: 'cancelled_failed' }];
            }
        });
    });
}
// ─── Registry de handlers ──────────────────────────────────────────────────────
// Para adicionar um novo evento, basta criar a função e adicionar aqui.
var ACTION_HANDLERS = {
    'issued_successfully': handleIssuedSuccessfully,
    'issued_error': handleIssuedError,
    'issued_failed': handleIssuedFailed,
    'cancelled_successfully': handleCancelledSuccessfully,
    'cancelled_error': handleCancelledError,
    'cancelled_failed': handleCancelledFailed,
};
// ─── Express Server ────────────────────────────────────────────────────────────
function startNfeWebhookServer() {
    var _this = this;
    var app = (0, express_1.default)();
    var PORT = Number(process.env.NFE_WEBHOOK_PORT || 4002);
    // Capturar rawBody para validação HMAC
    app.use(express_1.default.json({
        verify: function (req, _res, buf) {
            req.rawBody = buf;
        }
    }));
    // ─── Health Check ──────────────────────────────────────────────────────────
    app.get('/health', function (_req, res) {
        res.json({ status: 'ok', service: 'nfe-webhook', uptime: process.uptime() });
    });
    // ─── HMAC Signature Validation ─────────────────────────────────────────────
    var validateSignature = function (req, res, next) {
        var secret = process.env.NFE_IO_WEBHOOK_SECRET;
        // Se não houver secret configurado em DEV, avisa mas deixa passar
        if (!secret) {
            if (process.env.NODE_ENV === 'production') {
                console.error('[nfe-webhook] CRITICAL: NFE_IO_WEBHOOK_SECRET missing in production!');
                return res.sendStatus(500);
            }
            console.warn('[nfe-webhook] ⚠️ Sem WEBHOOK_SECRET — aceitando sem validação (dev mode)');
            return next();
        }
        var signature = req.headers['x-hub-signature'] || req.headers['x-webhook-signature'] || req.headers['x-nfeio-signature'];
        if (!signature) {
            console.error('[nfe-webhook] Rejecting: Missing signature header');
            return res.sendStatus(401);
        }
        var hmac = crypto_1.default.createHmac('sha256', secret);
        var digest = hmac.update(req.rawBody).digest('hex');
        // Nfe.io pode enviar com ou sem prefixo sha256=
        var cleanSig = signature.replace(/^sha256=/, '');
        if (crypto_1.default.timingSafeEqual(Buffer.from(cleanSig, 'hex'), Buffer.from(digest, 'hex'))) {
            next();
        }
        else {
            console.error('[nfe-webhook] Rejecting: Signature mismatch');
            return res.sendStatus(401);
        }
    };
    // ─── POST: Webhook endpoint ────────────────────────────────────────────────
    app.post('/webhook', validateSignature, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var startTime, _a, action, payload, handler, result, elapsed, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    startTime = Date.now();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    _a = req.body, action = _a.action, payload = _a.payload;
                    if (!action || !(payload === null || payload === void 0 ? void 0 : payload.id)) {
                        console.warn('[nfe-webhook] Payload inválido:', JSON.stringify(req.body).substring(0, 200));
                        return [2 /*return*/, res.status(400).json({ error: 'Missing action or payload.id' })];
                    }
                    console.log("[nfe-webhook] \u2190 Recebido: action=".concat(action, " nfeIoId=").concat(payload.id, " flowStatus=").concat(payload.flowStatus || 'N/A'));
                    handler = ACTION_HANDLERS[action];
                    if (!handler) {
                        console.warn("[nfe-webhook] A\u00E7\u00E3o desconhecida: \"".concat(action, "\". Ignorando."));
                        // Retorna 200 para não causar retry do Nfe.io
                        return [2 /*return*/, res.status(200).json({ received: true, handled: false, action: action })];
                    }
                    return [4 /*yield*/, handler(payload)];
                case 2:
                    result = _b.sent();
                    elapsed = Date.now() - startTime;
                    console.log("[nfe-webhook] \u2192 Processado: action=".concat(action, " updated=").concat(result.updated, " (").concat(elapsed, "ms)"));
                    return [2 /*return*/, res.status(200).json(__assign({ received: true }, result))];
                case 3:
                    error_1 = _b.sent();
                    console.error('[nfe-webhook] Erro crítico:', error_1);
                    // Retorna 500 para que o Nfe.io tente reenviar
                    return [2 /*return*/, res.status(500).json({ error: error_1.message || 'Internal server error' })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    app.listen(PORT, function () {
        console.log("[nfe-webhook] \uD83D\uDE80 Listening on port ".concat(PORT));
        console.log("[nfe-webhook] Handlers registrados: ".concat(Object.keys(ACTION_HANDLERS).join(', ')));
        console.log("[nfe-webhook] HMAC: ".concat(process.env.NFE_IO_WEBHOOK_SECRET ? '✅ Ativo' : '⚠️ Desativado (dev)'));
    });
}
// ─── Boot ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
    startNfeWebhookServer();
}
