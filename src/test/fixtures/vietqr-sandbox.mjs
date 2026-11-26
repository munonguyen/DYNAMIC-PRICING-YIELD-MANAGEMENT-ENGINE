import { createServer } from 'node:http';

const port = 18121;
const backendPort = Number(process.env.VIETQR_FIXTURE_BACKEND_PORT ?? 8080);
if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535 || backendPort === port) {
  throw new Error('Chọn cổng backend local khác 18121.');
}
const backend = `http://127.0.0.1:${backendPort}/api/v1/payments/vietqr`;
const merchantBasic = 'Basic ' + Buffer.from('fixture-merchant:fixture-secret').toString('base64');
const callbackBasic = 'Basic ' + Buffer.from('fixture-callback:fixture-callback-password').toString('base64');
const gatewayToken = 'fixture-provider-token';
const orders = new Map();

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) throw new Error('Payload quá lớn.');
  }
  return JSON.parse(body);
}

createServer(async (request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  if (request.method !== 'POST') return send(405, { error: 'Chỉ dùng POST.' });
  try {
    if (request.url === '/vqr/api/token_generate') {
      if (request.headers.authorization !== merchantBasic) return send(401, { error: 'Sai cấu hình merchant thử.' });
      return send(200, { access_token: gatewayToken, token_type: 'Bearer', expires_in: 300 });
    }
    if (request.url === '/vqr/api/qr/generate-customer') {
      const body = await readJson(request);
      if (request.headers.authorization !== 'Bearer ' + gatewayToken || body.qrType !== 0
        || body.transType !== 'C' || body.bankAccount !== '10000001' || body.bankCode !== 'MB') {
        return send(400, { error: 'Yêu cầu tạo mã không khớp cấu hình thử.' });
      }
      const order = {
        orderId: body.orderId, amount: body.amount, bankCode: body.bankCode,
        bankName: 'Ngân hàng thử nghiệm', bankAccount: body.bankAccount, content: 'TEST' + body.orderId,
        qrCode: '000201 ARENAPULSE LOCAL FIXTURE ONLY ' + body.orderId,
      };
      orders.set(body.orderId, order);
      return send(200, order);
    }
    if (request.url !== '/simulate') return send(404, { error: 'Đường dẫn thử không hợp lệ.' });
    if (!request.headers['content-type']?.startsWith('application/json')) {
      return send(415, { error: 'Dùng Content-Type: application/json.' });
    }
    const body = await readJson(request);
    const order = orders.get(body.orderId);
    if (!order || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.eventId ?? '')) {
      return send(400, { error: 'Cần mã giao dịch từ checkout và eventId thử.' });
    }
    const scenario = body.case ?? 'exact';
    if (!['exact', 'short', 'over', 'wrong-content', 'outgoing', 'bad-token'].includes(scenario)) {
      return send(400, { error: 'Kịch bản thử không hợp lệ.' });
    }
    const token = await fetch(backend + '/api/token_generate', { method: 'POST', headers: { Authorization: callbackBasic } });
    if (!token.ok) return send(502, { error: 'Backend chưa cấp token thử. Kiểm tra cấu hình fixture.' });
    const { access_token: accessToken } = await token.json();
    const amount = order.amount + (scenario === 'short' ? -1 : scenario === 'over' ? 1 : 0);
    const callback = await fetch(backend + '/bank/api/transaction-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (scenario === 'bad-token' ? accessToken + '.invalid' : accessToken) },
      body: JSON.stringify({
        bankaccount: order.bankAccount, amount, content: scenario === 'wrong-content' ? 'NO MATCH' : order.content,
        transType: scenario === 'outgoing' ? 'D' : 'C', orderId: order.orderId,
        transactionid: 'fixture-tx-' + body.eventId, referencenumber: 'fixture-bank-' + body.eventId,
        transactiontime: Date.now(),
      }),
    });
    return send(callback.status, await callback.json());
  } catch (error) {
    return send(400, { error: error instanceof Error ? error.message : 'Lỗi fixture.' });
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`VietQR fixture on http://127.0.0.1:${port}, backend port ${backendPort}\n`);
});
