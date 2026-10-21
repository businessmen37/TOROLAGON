import Stripe from 'stripe';

export const CATALOG = Object.freeze({
  spray: {name:'TOROLAGON Men’s Sensitive Skin Spray',size:'15 ml',cents:1799,image:'product2-main.png'},
  oil: {name:'TOROLAGON Men’s Massage Oil',size:'10 ml',cents:2499,image:'product3-main.png'},
  dragon: {name:'Dragon Power 9000 Sensitive Skin Spray for Men',size:'15 ml',cents:1999,image:'product4-main.png'}
});
export const ORIGINS = ['https://torolagon.com','https://www.torolagon.com'];
export const EVENTS = ['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'];
const SITE='https://www.torolagon.com';
const VERSION='2026-09-30.endive';
const LIVE_PRICES={spray:'price_1UPRCCRMaEJwj08xM0FuQy4b',oil:'price_1UPRCuRMaEJwj08xk6LiE83Q',dragon:'price_1UPRDvRMaEJwj08xk8tO02fn'};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export class StoreError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export function normalizeCart(input) {
  if (!Array.isArray(input)||input.length<1||input.length>3) throw new StoreError('Select between one and three products.');
  const seen=new Set();
  return input.map(item=>{
    if (!item||!Object.hasOwn(CATALOG,item.id)||seen.has(item.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>50) throw new StoreError('Invalid product or quantity.');
    seen.add(item.id);return {id:item.id,quantity:item.quantity};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
export const subtotal=cart=>cart.reduce((sum,item)=>sum+CATALOG[item.id].cents*item.quantity,0);
export function ready(env,mode) {
  return env[`${mode.toUpperCase()}_ENABLED`]==='true' &&
    String(env[`STRIPE_${mode.toUpperCase()}_KEY`]||'').startsWith(`rk_${mode}_`) &&
    String(env[`STRIPE_${mode.toUpperCase()}_WEBHOOK_SECRET`]||'').startsWith('whsec_');
}
function client(env,mode){return new Stripe(env[`STRIPE_${mode.toUpperCase()}_KEY`],{apiVersion:VERSION,httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2,timeout:20000});}
export function sessionParams(cart,id,expires,mode='test') {
  return {
    mode:'payment',currency:'usd',adaptive_pricing:{enabled:false},billing_address_collection:'required',customer_creation:'always',
    phone_number_collection:{enabled:false},shipping_address_collection:{allowed_countries:['US']},
    shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:0,currency:'usd'},display_name:'Free U.S. shipping'}}],
    line_items:mode==='live'?cart.map(item=>({quantity:item.quantity,price:LIVE_PRICES[item.id]})):cart.map(item=>({quantity:item.quantity,price_data:{currency:'usd',unit_amount:CATALOG[item.id].cents,product_data:{name:CATALOG[item.id].name,description:`${CATALOG[item.id].size}. Orders processed within 24–48 hours.`,images:[`${SITE}/assets/images/${CATALOG[item.id].image}`],metadata:{torolagon_product:item.id}}}})),
    success_url:`${SITE}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${SITE}/cart.html?checkout=cancelled`,
    expires_at:expires,client_reference_id:id,metadata:{store:'torolagon',order_id:id},
    integration_identifier:'torolagon_hosted_zqkpvndb',
    custom_text:{submit:{message:'U.S. orders only. Free shipping. Processing within 24–48 hours. Support: info@torolagon.com.'}}
  };
}
function cors(response,origin){const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');return new Response(response.body,{status:response.status,headers});}

export default {
  async fetch(request,env) {
    const url=new URL(request.url),origin=request.headers.get('Origin');
    if(url.pathname==='/health'){const response=json({service:'torolagon-checkout',testEnabled:ready(env,'test'),liveEnabled:ready(env,'live')});return ORIGINS.includes(origin)?cors(response,origin):response;}
    const match=url.pathname.match(/^\/(test|live)\/(inventory|checkout|status|webhook)$/);
    if(!match)return json({error:'Not found.'},404);
    const [,mode,action]=match;
    if(action==='webhook'){
      if(request.method!=='POST')return json({error:'Method not allowed.'},405);
      const secret=env[`STRIPE_${mode.toUpperCase()}_WEBHOOK_SECRET`];
      if(!secret)return json({error:'Payment notifications are not configured.'},503);
      const raw=await request.text();if(raw.length>262144)return json({error:'Request too large.'},413);
      let event;
      try{event=await Stripe.webhooks.constructEventAsync(raw,request.headers.get('Stripe-Signature'),secret,300,Stripe.createSubtleCryptoProvider());}
      catch{return json({error:'Invalid signature.'},400);}
      if(event.livemode!==(mode==='live'))return json({error:'Wrong payment environment.'},400);
      if(!EVENTS.includes(event.type))return json({received:true});
      return env.STORE.get(env.STORE.idFromName(`torolagon-${mode}-v1`)).fetch(new Request('https://store/webhook',{method:'POST',body:JSON.stringify({mode,type:event.type,session:event.data.object})}));
    }
    if(!ORIGINS.includes(origin))return json({error:'This storefront origin is not allowed.'},403);
    if(request.method==='OPTIONS')return cors(new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}}),origin);
    let response;
    try{
      if((action==='checkout'&&request.method!=='POST')||(action!=='checkout'&&request.method!=='GET'))throw new StoreError('Method not allowed.',405);
      if(action==='checkout'&&!ready(env,mode))throw new StoreError('Checkout is temporarily unavailable. Please try again later.',503);
      if(Number(request.headers.get('Content-Length')||0)>4096)throw new StoreError('Request too large.',413);
      const headers=new Headers(request.headers);headers.set('X-Store-Mode',mode);
      headers.set('X-Client-IP',request.headers.get('CF-Connecting-IP')||'unknown');
      response=await env.STORE.get(env.STORE.idFromName(`torolagon-${mode}-v1`)).fetch(new Request(`https://store/${action}${url.search}`,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,duplex:request.method==='POST'?'half':undefined}));
    }catch(error){response=json({error:error instanceof StoreError?error.message:'Checkout could not be loaded. Please try again.'},error.status||500);}
    return cors(response,origin);
  }
};

export class TorolagonStore {
  constructor(ctx,env,stripeClient=null) {
    this.ctx=ctx;this.env=env;this.testClient=stripeClient;this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, remaining INTEGER NOT NULL CHECK(remaining>=0))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, cart TEXT NOT NULL, total INTEGER NOT NULL, state TEXT NOT NULL, session TEXT UNIQUE, url TEXT, expires INTEGER NOT NULL, created INTEGER NOT NULL, checked INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS limits (ip TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS pending_orders ON orders(state, expires)');
    for(const id of Object.keys(CATALOG))this.sql.exec('INSERT OR IGNORE INTO inventory VALUES (?,50)',id);
  }
  row(query,...params){return this.sql.exec(query,...params).toArray()[0];}
  stripe(mode){return this.testClient||client(this.env,mode);}
  async fetch(request) {
    try {
      const url=new URL(request.url),mode=request.headers.get('X-Store-Mode')||'test';
      if(url.pathname!=='/webhook')this.sql.exec("INSERT INTO settings VALUES ('mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",mode);
      if(url.pathname==='/inventory')return json({products:this.sql.exec('SELECT id,remaining FROM inventory').toArray()});
      if(url.pathname==='/checkout'){
        const raw=await request.text();if(raw.length>4096)throw new StoreError('Request too large.',413);
        let body;try{body=JSON.parse(raw);}catch{throw new StoreError('Invalid cart.');}
        const cart=normalizeCart(body.items),id=body.requestId;
        if(typeof id!=='string'||!/^\w[\w-]{20,79}$/.test(id))throw new StoreError('Invalid checkout request.');
        let order=this.row('SELECT * FROM orders WHERE id=?',id);
        if(order){if(order.cart!==JSON.stringify(cart))throw new StoreError('This request belongs to a different cart.',409);
          if(order.state==='paid')throw new StoreError('This order has already been paid.',409);
          if(order.state==='released')throw new StoreError('This checkout expired. Please try again.',409);
          if(order.session)return json({url:order.url,sessionId:order.session});
        }else{
          const now=Math.floor(Date.now()/1000),expires=now+1860;
          const ip=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('X-Client-IP')||'unknown'));
          const hash=Array.from(new Uint8Array(ip),b=>b.toString(16).padStart(2,'0')).join('');
          this.ctx.storage.transactionSync(()=>{
            const limit=this.row('SELECT * FROM limits WHERE ip=?',hash);
            if(limit&&limit.started>now-600&&limit.count>=10)throw new StoreError('Too many checkout attempts. Please wait a few minutes.',429);
            for(const item of cart){const stock=this.row('SELECT remaining FROM inventory WHERE id=?',item.id);if(stock.remaining<item.quantity)throw new StoreError(`Only ${stock.remaining} units of ${CATALOG[item.id].name} are available.`,409);}
            this.sql.exec('INSERT INTO limits VALUES (?,?,1) ON CONFLICT(ip) DO UPDATE SET started=excluded.started,count=CASE WHEN limits.started>? THEN limits.count+1 ELSE 1 END',hash,limit&&limit.started>now-600?limit.started:now,now-600);
            this.sql.exec('DELETE FROM limits WHERE started<?',now-86400);
            for(const item of cart)this.sql.exec('UPDATE inventory SET remaining=remaining-? WHERE id=?',item.quantity,item.id);
            this.sql.exec('INSERT INTO orders (id,cart,total,state,expires,created) VALUES (?,?,?,?,?,?)',id,JSON.stringify(cart),subtotal(cart),'reserved',expires,now);
          });
          order=this.row('SELECT * FROM orders WHERE id=?',id);
          await this.ctx.storage.setAlarm(Date.now()+60000);
        }
        return json(await this.createSession(order,mode));
      }
      if(url.pathname==='/status'){
        const id=url.searchParams.get('session_id');if(!id||!/^cs_(test|live)_[\w]+$/.test(id))throw new StoreError('Invalid checkout reference.');
        const order=this.row('SELECT * FROM orders WHERE session=?',id);if(!order)throw new StoreError('Checkout not found.',404);
        return json({state:order.state,items:order.state==='paid'?JSON.parse(order.cart):undefined});
      }
      if(url.pathname==='/webhook'){
        const {mode:eventMode,type,session}=await request.json();
        this.sql.exec("INSERT INTO settings VALUES ('mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",eventMode);
        if(session.metadata?.store!=='torolagon')return json({received:true});
        const order=this.row('SELECT * FROM orders WHERE id=?',session.metadata.order_id);
        if(!order)throw new StoreError('Order notification cannot be matched.',409);
        if(session.id!==order.session && order.session)throw new StoreError('Checkout reference mismatch.',409);
        const current=await this.stripe(eventMode).checkout.sessions.retrieve(session.id);
        this.settle(order,current,eventMode,type);
        return json({received:true});
      }
      return json({error:'Not found.'},404);
    }catch(error){return json({error:error instanceof StoreError?error.message:'Checkout is temporarily unavailable. Please try again.'},error.status||500);}
  }
  async createSession(order,mode) {
    this.sql.exec('UPDATE orders SET attempts=attempts+1 WHERE id=?',order.id);
    const attempts=this.row('SELECT attempts FROM orders WHERE id=?',order.id).attempts;
    try{
      const session=await this.stripe(mode).checkout.sessions.create(sessionParams(JSON.parse(order.cart),order.id,order.expires,mode),{idempotencyKey:`torolagon-${mode}-${order.id}`});
      if(session.livemode!==(mode==='live')||!session.url?.startsWith('https://checkout.stripe.com/'))throw new Error('Invalid checkout environment.');
      this.sql.exec('UPDATE orders SET session=?,url=? WHERE id=?',session.id,session.url,order.id);
      return {url:session.url,sessionId:session.id};
    }catch(error){
      // Network/timeouts are ambiguous: keep inventory reserved and reconcile with the same idempotency key.
      if(attempts===1 && ['StripeInvalidRequestError','StripeAuthenticationError','StripePermissionError'].includes(error.type))this.release(order);
      throw new StoreError('Checkout could not be opened. Please try again in a moment.',503);
    }
  }
  settle(order,session,mode,eventType) {
    if(session.livemode!==(mode==='live')||session.metadata?.order_id!==order.id||session.metadata?.store!=='torolagon')throw new StoreError('Payment environment mismatch.',409);
    if(session.payment_status==='paid'){
      const country=session.collected_information?.shipping_details?.address?.country||session.shipping_details?.address?.country;
      if(session.currency!=='usd'||session.amount_subtotal!==order.total||session.total_details?.amount_shipping!==0||country!=='US')throw new StoreError('Payment details require review.',409);
      if(order.state==='released')throw new StoreError('Released reservation requires review.',409);
      this.sql.exec("UPDATE orders SET state='paid',session=? WHERE id=?",session.id,order.id);
    }else if(order.state!=='paid'&&(session.status==='expired'||eventType==='checkout.session.async_payment_failed'))this.release(order);
    else if(session.status==='complete'&&order.state!=='paid')this.sql.exec("UPDATE orders SET state='processing' WHERE id=?",order.id);
  }
  release(order) {
    this.ctx.storage.transactionSync(()=>{
      const current=this.row('SELECT state FROM orders WHERE id=?',order.id);
      if(!current||current.state==='paid'||current.state==='released')return;
      for(const item of JSON.parse(order.cart))this.sql.exec('UPDATE inventory SET remaining=remaining+? WHERE id=?',item.quantity,item.id);
      this.sql.exec("UPDATE orders SET state='released' WHERE id=?",order.id);
    });
  }
  async alarm() {
    const mode=this.row("SELECT value FROM settings WHERE key='mode'")?.value||'test';
    const pending=this.sql.exec("SELECT * FROM orders WHERE state IN ('reserved','processing') ORDER BY checked,created LIMIT 10").toArray();
    for(const order of pending){try{
      // Never restore stock based on a browser cancel or a local clock alone.
      if(!order.session){await this.createSession(order,mode);continue;}
      const session=await this.stripe(mode).checkout.sessions.retrieve(order.session);
      this.settle(order,session,mode);
    }catch{/* Preserve inventory and retry; payment uncertainty must never cause overselling. */}
      finally{this.sql.exec('UPDATE orders SET checked=? WHERE id=?',Date.now(),order.id);}}
    if(this.row("SELECT id FROM orders WHERE state IN ('reserved','processing') LIMIT 1"))await this.ctx.storage.setAlarm(Date.now()+60000);
  }
}
