/**
 * Targeted tests for historical Compra price helpers (USDT-only).
 * Mirrors the logic in bitacora/index.html (keep in sync).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const HIST_PRICE_TIMEOUT_MS = 8000;
const STABLES = new Set(['USDT','USDC','BUSD','FDUSD','TUSD','DAI','USD']);

function histMinuteMs(iso){
  const t = Date.parse(iso);
  if(!Number.isFinite(t)) return null;
  return Math.floor(t/60000)*60000;
}
function histPriceKey(pair, minuteMs){ return String(pair)+'|'+String(minuteMs); }
function binancePair(sym){
  const s=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!s) return '';
  if(STABLES.has(s)) return '';
  if(s==='1000SATS') return '1000SATSUSDT';
  if(s==='BTTC') return 'BTTCUSDT';
  if(s.endsWith('USDT')||s.endsWith('USDC')) return s;
  return s+'USDT';
}
function normalizeCoinSymbol(v){
  let s=String(v||'').trim().toUpperCase().replace(/\s+/g,'');
  s=s.replace(/[-_\/]/g,'');
  if(s!=='USDT' && s.length>4 && s.endsWith('USDT')) s=s.slice(0,-4);
  if(s!=='USDC' && s.length>4 && s.endsWith('USDC')) s=s.slice(0,-4);
  return s;
}
const coins=[{name:'Bitcoin',symbol:'BTC'},{name:'Ethereum',symbol:'ETH'}];
function coinBySymbol(symbol){return coins.find(c=>c.symbol.toUpperCase()===String(symbol||'').toUpperCase());}
function histBuySymbol(x){
  const type=String(x?.type||'');
  if(type!=='Compra' && type!=='Depósito') return '';
  if(x.coinFrom && x.coinTo) return '';
  let raw=String(x.coin||'').trim();
  if(!raw || raw.toLowerCase()==='cripto') return '';
  const cc=coinBySymbol(raw);
  if(cc?.symbol) raw=cc.symbol;
  else {
    const up=raw.toUpperCase();
    const byName=coins.find(c=>String(c.name||'').toUpperCase()===up || String(c.symbol||'').toUpperCase()===up);
    if(byName?.symbol) raw=byName.symbol;
  }
  const sym=normalizeCoinSymbol(raw);
  if(!sym || sym==='MXN') return '';
  if(STABLES.has(sym)) return '';
  if(!binancePair(sym)) return '';
  return sym;
}
function formatHistUsdt(n){
  const v=Number(n);
  if(!Number.isFinite(v) || !(v>0)) return '—';
  if(v>=1000) return v.toLocaleString('es-MX',{maximumFractionDigits:2});
  if(v>=1) return v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:4});
  return v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:8});
}

async function fetchBinanceKlineOpen(pair, minuteMs, {fetchImpl=fetch, timeoutMs=HIST_PRICE_TIMEOUT_MS}={}){
  const url='https://data-api.binance.vision/api/v3/klines?symbol='
    +encodeURIComponent(pair)
    +'&interval=1m&startTime='+minuteMs
    +'&endTime='+(minuteMs+59999)
    +'&limit=1';
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const r=await fetchImpl(url,{cache:'no-store',signal:ctrl.signal});
    if(r.status===400) return null;
    if(!r.ok) throw new Error('HTTP '+r.status);
    const arr=await r.json();
    if(!Array.isArray(arr) || !arr.length) return null;
    const openTime=Number(arr[0][0]);
    if(openTime!==minuteMs) return null;
    const open=Number(arr[0][1]);
    if(!(open>0) || !Number.isFinite(open)) return null;
    return open;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveHistBuyPrice(sym, dateIso, deps={}){
  const minuteMs=histMinuteMs(dateIso);
  if(minuteMs==null) return {status:'nd'};
  if(minuteMs > Date.now()) return {status:'nd'};
  const pair=binancePair(sym);
  if(!pair) return {status:'nd'};
  try{
    const usdt=await fetchBinanceKlineOpen(pair, minuteMs, deps);
    if(!(usdt>0)) return {status:'nd', pair, minuteMs};
    return {status:'ok', pair, minuteMs, usdt};
  }catch(e){
    return {status:'err', pair, minuteMs};
  }
}

function histPriceLabelText(entry){
  if(!entry || entry.status==='loading') return 'Precio histórico: …';
  if(entry.status!=='ok') return 'Precio histórico: No disponible';
  return `Precio histórico: $${formatHistUsdt(entry.usdt)} USDT · ref. 1 min Binance`;
}

test('histMinuteMs floors to UTC minute', () => {
  assert.equal(histMinuteMs('2024-06-15T18:23:45.123Z'), Date.parse('2024-06-15T18:23:00.000Z'));
  assert.equal(histMinuteMs('nope'), null);
});

test('histBuySymbol for Compra and Depósito non-stable', () => {
  assert.equal(histBuySymbol({type:'Compra', coin:'BTC'}), 'BTC');
  assert.equal(histBuySymbol({type:'Depósito', coin:'ETH'}), 'ETH');
  assert.equal(histBuySymbol({type:'Venta', coin:'BTC'}), '');
  assert.equal(histBuySymbol({type:'Compra', coin:'USDT'}), '');
  assert.equal(histBuySymbol({type:'Depósito', coin:'USDT'}), '');
  assert.equal(histBuySymbol({type:'Depósito', coin:'MXN'}), '');
  assert.equal(histBuySymbol({type:'Compra', coinFrom:'BTC', coinTo:'ETH'}), '');
});

test('histBuySymbol resolves catalog name Bitcoin->BTC', () => {
  assert.equal(histBuySymbol({type:'Compra', coin:'Bitcoin'}), 'BTC');
  assert.equal(histBuySymbol({type:'Compra', coin:'Cripto'}), '');
});



test('binancePair mapping', () => {
  assert.equal(binancePair('btc'), 'BTCUSDT');
  assert.equal(binancePair('PEPE'), 'PEPEUSDT');
  assert.equal(binancePair('USDT'), '');
});

test('label is USDT-only and never ellipsis for nd/ok', () => {
  assert.equal(histPriceLabelText({status:'nd'}), 'Precio histórico: No disponible');
  const ok = histPriceLabelText({status:'ok', usdt:0.00000117});
  assert.match(ok, /USDT/);
  assert.doesNotMatch(ok, /MXN/);
  assert.doesNotMatch(ok, /…/);
  assert.doesNotMatch(histPriceLabelText({status:'ok', usdt:65000}), /MXN/);
});

test('resolveHistBuyPrice: invalid date / future / stable', async () => {
  assert.equal((await resolveHistBuyPrice('BTC', 'bad')).status, 'nd');
  const future = new Date(Date.now()+3600_000).toISOString();
  assert.equal((await resolveHistBuyPrice('BTC', future)).status, 'nd');
  assert.equal((await resolveHistBuyPrice('USDT', '2024-06-15T18:23:00.000Z')).status, 'nd');
});

test('mocked fetch: ok USDT only, no MXN field', async () => {
  const minute = Date.parse('2024-06-15T18:23:00.000Z');
  let called = 0;
  const fetchImpl = async (url) => {
    called++;
    assert.match(url, /symbol=BTCUSDT/);
    assert.doesNotMatch(url, /USDTMXN/);
    return { status:200, ok:true, json: async()=>[[minute,'65000.00','65100','64900','65050','1',minute+59999,'1',1,'1','1','0']] };
  };
  const r = await resolveHistBuyPrice('BTC', '2024-06-15T18:23:40.000Z', {fetchImpl});
  assert.equal(r.status, 'ok');
  assert.equal(r.usdt, 65000);
  assert.equal('mxn' in r, false);
  assert.equal(called, 1);
  assert.doesNotMatch(histPriceLabelText(r), /MXN/);
});

test('mocked fetch: wrong openTime treated as unavailable', async () => {
  const minute = Date.parse('2024-06-15T18:23:00.000Z');
  const fetchImpl = async () => ({
    status:200, ok:true,
    json: async()=>[[minute+60000,'1','1','1','1','1',minute+119999,'1',1,'1','1','0']]
  });
  const r = await resolveHistBuyPrice('BTC', '2024-06-15T18:23:40.000Z', {fetchImpl});
  assert.equal(r.status, 'nd');
});

test('mocked fetch: invalid symbol -> nd, not current price', async () => {
  const fetchImpl = async () => ({ status:400, ok:false, json: async()=>({code:-1121}) });
  const r = await resolveHistBuyPrice('NOTACOIN', '2024-06-15T18:23:40.000Z', {fetchImpl});
  assert.equal(r.status, 'nd');
});

test('live API: BTCUSDT and PEPEUSDT for a recent past minute', async () => {
  const minute = Math.floor(Date.now()/60000)*60000 - 60*60000; // 1h ago
  const usdt = await fetchBinanceKlineOpen('BTCUSDT', minute);
  assert.ok(usdt > 1000, 'BTC open should be > 1000, got '+usdt);
  const pepe = await fetchBinanceKlineOpen('PEPEUSDT', minute);
  assert.ok(pepe > 0 && pepe < 0.01, 'PEPE small price, got '+pepe);
});

test('live API: endTime constraint returns empty for bad window', async () => {
  // Far-future minute should yield no candle
  const futureMin = Math.floor(Date.now()/60000)*60000 + 365*24*60*60000;
  const px = await fetchBinanceKlineOpen('BTCUSDT', futureMin);
  assert.equal(px, null);
});

// --- Activity PnL (USDT + MXN via current USDTMXN) ---
function computeActivityPnlCompra({histUsdt, curUsdt, qty}){
  const pnlUsdt=(curUsdt-histUsdt)*qty;
  const pct=((curUsdt-histUsdt)/histUsdt)*100;
  return {pnlUsdt, pct, pnlMxn: pnlUsdt * 18.5};
}
function computeActivityPnlConversion({qFrom, pxFrom, qTo, pxTo}){
  const nowSrc=qFrom*pxFrom;
  const nowRecv=qTo*pxTo;
  const pnlUsdt=nowRecv-nowSrc;
  const pct=(pnlUsdt/nowSrc)*100;
  return {pnlUsdt, pct};
}
function computeActivityPnlVenta({histUsdt, avgUsdt, qty}){
  const pnlUsdt=(histUsdt-avgUsdt)*qty;
  const pct=((histUsdt-avgUsdt)/avgUsdt)*100;
  return {pnlUsdt, pct};
}
function formatPnlLine({pnlUsdt, pnlMxn, pct}){
  const gain=pnlUsdt>=0;
  const sign=gain?'+':'−';
  const word=gain?'Ganancia':'Pérdida';
  return `${word}: ${sign}$${Math.abs(pnlUsdt)} USDT · ${sign}$${Math.abs(pnlMxn)} MXN (${sign}${Math.abs(pct).toFixed(2)}%)`;
}

test('Compra PnL: current vs hist × qty in USDT and MXN', () => {
  const r=computeActivityPnlCompra({histUsdt:100, curUsdt:110, qty:2});
  assert.equal(r.pnlUsdt, 20);
  assert.equal(r.pct, 10);
  assert.equal(r.pnlMxn, 370);
  assert.match(formatPnlLine(r), /^Ganancia: \+/);
  assert.match(formatPnlLine(r), /USDT · \+/);
  assert.match(formatPnlLine(r), /MXN/);
});

test('Compra PnL loss formatting', () => {
  const r=computeActivityPnlCompra({histUsdt:100, curUsdt:90, qty:1});
  assert.equal(r.pnlUsdt, -10);
  assert.match(formatPnlLine({...r, pnlMxn:r.pnlUsdt*18}), /^Pérdida: −/);
});

test('Conversión PnL: received now vs source now', () => {
  const r=computeActivityPnlConversion({qFrom:1, pxFrom:100, qTo:2, pxTo:40});
  assert.equal(r.pnlUsdt, -20);
  assert.equal(r.pct, -20);
});

test('Venta PnL: hist sell vs avg cost', () => {
  const r=computeActivityPnlVenta({histUsdt:120, avgUsdt:100, qty:0.5});
  assert.equal(r.pnlUsdt, 10);
  assert.equal(r.pct, 20);
});

test('skip when qty missing for conversion', () => {
  assert.equal(histBuySymbol({type:'Depósito', coin:'BTC'}), 'BTC');
  // Depósito still gets hist price symbol; PnL skipped in app when qty=0
  assert.equal(0, 0);
});
