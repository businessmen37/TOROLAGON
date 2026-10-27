import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import Stripe from 'stripe';
import worker,{TorolagonStore,normalizeCart,sessionParams,ready,inventoryItems,inventoryListing} from '../src/index.js';

function fixture(){
 const db=new DatabaseSync(':memory:');
 const ctx={storage:{sql:{exec(query,...values){const rows=db.prepare(query).all(...values);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},async setAlarm(){} }};
 const sessions=new Map(),params=[],keys=new Map();
 const stripe={checkout:{sessions:{async create(p,options){params.push(p);if(keys.has(options.idempotencyKey))return keys.get(options.idempotencyKey);const session={id:'cs_test_'+crypto.randomUUID().replaceAll('-',''),url:'https://checkout.stripe.com/c/pay/test',livemode:false,metadata:p.metadata,payment_status:'unpaid',status:'open',currency:'usd',amount_subtotal:p.line_items.reduce((a,i)=>a+i.quantity*i.price_data.unit_amount,0),total_details:{amount_shipping:0},collected_information:{shipping_details:{address:{country:'US'}}}};sessions.set(session.id,session);keys.set(options.idempotencyKey,session);return session;},async retrieve(id){if(!sessions.has(id))throw new Error('Missing session');return sessions.get(id);}}}};
 const store=new TorolagonStore(ctx,{},stripe);
 async function checkout(items,requestId=crypto.randomUUID()) {const r=await store.fetch(new Request('https://store/checkout',{method:'POST',headers:{'X-Store-Mode':'test','X-Client-IP':crypto.randomUUID()},body:JSON.stringify({items,requestId})}));return {status:r.status,...await r.json(),requestId};}
 const stock=id=>store.row('SELECT remaining FROM inventory WHERE id=?',id).remaining;
 async function notify(session,type='checkout.session.completed'){return store.fetch(new Request('https://store/webhook',{method:'POST',body:JSON.stringify({session,type,mode:'test'})}));}
 return {store,checkout,stock,notify,sessions,params,stripe};
}

test('rejects unknown, removed, duplicated and invalid quantities',()=>{
 for(const cart of [[],[{id:'cream',quantity:1}],[{id:'spray',quantity:0}],[{id:'spray',quantity:51}],[{id:'spray',quantity:1.5}],[{id:'spray',quantity:'2'}],[{id:'spray',quantity:1},{id:'spray',quantity:1}]])assert.throws(()=>normalizeCart(cart));
});
test('prices are server controlled and checkout requires US address, billing, email and free shipping',async()=>{
 const f=fixture();const r=await f.checkout([{id:'spray',quantity:2,price:1},{id:'oil',quantity:1}]);assert.equal(r.status,200);
 const p=f.params[0];assert.equal(p.line_items.reduce((a,i)=>a+i.price_data.unit_amount*i.quantity,0),5197);assert.equal(p.customer_creation,'always');assert.equal(p.adaptive_pricing.enabled,false);assert.equal(p.billing_address_collection,'required');assert.deepEqual(p.shipping_address_collection.allowed_countries,['US']);assert.equal(p.shipping_options[0].shipping_rate_data.fixed_amount.amount,0);assert.ok(p.success_url.startsWith('https://www.torolagon.com/'));assert.ok(p.cancel_url.includes('/cart.html'));assert.ok(!('payment_method_types' in p));
});
test('inventory cannot be oversold by concurrent checkouts and rejected carts roll back all lines',async()=>{
 const f=fixture();const results=await Promise.all([f.checkout([{id:'spray',quantity:40}]),f.checkout([{id:'spray',quantity:40}])]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.stock('spray'),10);
 const r=await f.checkout([{id:'oil',quantity:1},{id:'spray',quantity:11}]);assert.equal(r.status,409);assert.equal(f.stock('oil'),50);
});
test('idempotent retries reserve only once and reject a changed cart under the same reference',async()=>{
 const f=fixture(),id=crypto.randomUUID();const a=await f.checkout([{id:'dragon',quantity:3}],id),b=await f.checkout([{id:'dragon',quantity:3}],id);assert.equal(a.sessionId,b.sessionId);assert.equal(f.stock('dragon'),47);assert.equal((await f.checkout([{id:'oil',quantity:1}],id)).status,409);
});
test('duplicate paid events do not change stock; an expired notification cannot undo paid order',async()=>{
 const f=fixture(),r=await f.checkout([{id:'spray',quantity:3}]);const s=f.sessions.get(r.sessionId);s.status='complete';s.payment_status='paid';assert.equal((await f.notify(s)).status,200);assert.equal((await f.notify(s)).status,200);assert.equal(f.stock('spray'),47);s.payment_status='unpaid';s.status='expired';await f.notify(s,'checkout.session.expired');assert.equal(f.stock('spray'),47);assert.equal(f.store.row('SELECT state FROM orders WHERE session=?',s.id).state,'paid');
});
test('unpaid asynchronous completion holds stock; failure releases it exactly once',async()=>{
 const f=fixture(),r=await f.checkout([{id:'oil',quantity:4}]);const s=f.sessions.get(r.sessionId);s.status='complete';await f.notify(s);assert.equal(f.stock('oil'),46);assert.equal(f.store.row('SELECT state FROM orders WHERE session=?',s.id).state,'processing');await f.notify(s,'checkout.session.async_payment_failed');await f.notify(s,'checkout.session.async_payment_failed');assert.equal(f.stock('oil'),50);
});
test('wrong totals, country or live mode cannot mark a test order paid',async()=>{
 for(const change of [{amount_subtotal:1},{livemode:true},{collected_information:{shipping_details:{address:{country:'CA'}}}}]){
  const f=fixture(),r=await f.checkout([{id:'spray',quantity:1}]);const s=f.sessions.get(r.sessionId);Object.assign(s,{payment_status:'paid',status:'complete'},change);assert.equal((await f.notify(s)).status,409);assert.equal(f.store.row('SELECT state FROM orders WHERE session=?',s.id).state,'reserved');
 }
});
test('hard API errors release stock; network uncertainty keeps it reserved',async()=>{
 for(const type of ['StripeInvalidRequestError','StripeConnectionError']){const f=fixture();f.stripe.checkout.sessions.create=async()=>{throw Object.assign(new Error('example'),{type});};const r=await f.checkout([{id:'dragon',quantity:2}]);assert.equal(r.status,503);assert.equal(f.stock('dragon'),type==='StripeInvalidRequestError'?50:48);}
});
test('origin protection, credential gates and signed webhook validation',async()=>{
 const env={TEST_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_example',STRIPE_TEST_WEBHOOK_SECRET:'whsec_example',STORE:{get(){throw new Error('Should not forward');}}};assert.equal(ready(env,'test'),true);assert.equal(ready(env,'live'),false);
 assert.equal((await worker.fetch(new Request('https://api/test/checkout',{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://api/live/checkout',{method:'POST',headers:{Origin:'https://www.torolagon.com'}}),env)).status,503);
 assert.equal((await worker.fetch(new Request('https://api/test/webhook',{method:'POST',body:'{}'}),env)).status,400);
 const body=JSON.stringify({id:'evt_example',type:'unhandled.event',livemode:false});const signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_TEST_WEBHOOK_SECRET});assert.equal((await worker.fetch(new Request('https://api/test/webhook',{method:'POST',headers:{'Stripe-Signature':signature},body}),env)).status,200);
 const old=Stripe.webhooks.generateTestHeaderString({payload:body,secret:env.STRIPE_TEST_WEBHOOK_SECRET,timestamp:1});assert.equal((await worker.fetch(new Request('https://api/test/webhook',{method:'POST',headers:{'Stripe-Signature':old},body}),env)).status,400);
});


test('kit charges 2998 cents and reserves both components atomically',async()=>{
 const f=fixture(),r=await f.checkout([{id:'kit',quantity:2},{id:'oil',quantity:1}]);assert.equal(r.status,200);
 assert.equal(f.stock('oil'),47);assert.equal(f.stock('spray'),48);
 assert.equal(f.params[0].line_items.reduce((sum,item)=>sum+item.quantity*item.price_data.unit_amount,0),7595);
 const listing=inventoryListing([{id:'oil',remaining:47},{id:'spray',remaining:48},{id:'dragon',remaining:50}]);assert.equal(listing.find(p=>p.id==='kit').remaining,47);
});
test('kit and single-item purchases cannot oversell shared component stock',async()=>{
 const f=fixture(),results=await Promise.all([f.checkout([{id:'kit',quantity:40}]),f.checkout([{id:'oil',quantity:40}])]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const g=fixture(),r=await g.checkout([{id:'kit',quantity:30},{id:'spray',quantity:21}]);assert.equal(r.status,409);assert.equal(g.stock('oil'),50);assert.equal(g.stock('spray'),50);
});
test('expired kit checkout restores both components exactly once',async()=>{
 const f=fixture(),r=await f.checkout([{id:'kit',quantity:3}]);const s=f.sessions.get(r.sessionId);s.status='expired';await f.notify(s,'checkout.session.expired');await f.notify(s,'checkout.session.expired');assert.equal(f.stock('oil'),50);assert.equal(f.stock('spray'),50);
});
test('a paid kit retains its component reservation and records the purchased kit',async()=>{
 const f=fixture(),id=crypto.randomUUID(),r=await f.checkout([{id:'kit',quantity:1}],id);await f.checkout([{id:'kit',quantity:1}],id);assert.equal(f.stock('oil'),49);assert.equal(f.stock('spray'),49);
 const s=f.sessions.get(r.sessionId);s.status='complete';s.payment_status='paid';assert.equal((await f.notify(s)).status,200);assert.equal((await f.notify(s)).status,200);assert.equal(f.stock('oil'),49);assert.deepEqual(JSON.parse(f.store.row('SELECT cart FROM orders WHERE id=?',id).cart),[{id:'kit',quantity:1}]);
});
test('updated authoritative individual prices remain consistent across cart and checkout',()=>{
 const p=sessionParams([{id:'oil',quantity:1},{id:'dragon',quantity:1}],'example',1900000000);
 assert.deepEqual(p.line_items.map(item=>item.price_data.unit_amount),[1599,1799]);assert.deepEqual(inventoryItems([{id:'kit',quantity:2},{id:'spray',quantity:1}]),[{id:'oil',quantity:2},{id:'spray',quantity:3}]);
});

test('live checkout uses the verified new Stripe prices including the kit',()=>{
 const p=sessionParams([{id:'oil',quantity:1},{id:'dragon',quantity:1},{id:'kit',quantity:1}],'example',1900000000,'live');
 assert.deepEqual(p.line_items.map(i=>i.price),['price_1UVIQdRMaEJwj08xoaWMyRPI','price_1UVIRoRMaEJwj08xIRtqfpdT','price_1UVIU0RMaEJwj08xrgesX3N3']);
});
