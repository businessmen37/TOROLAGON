(() => {
  'use strict';
  const API = 'https://torolagon-checkout.businessmen3737.workers.dev';
  const mode = document.body.dataset.checkoutMode === 'test' ? 'test' : 'live';
  const attemptKey = `torolagon_checkout_${mode}`;
  let enabled = false;
  let openingCheckout = false;
  const remainingStock = {};
  const note = message => {const element=document.getElementById('checkoutMessage');if(element)element.textContent=message;};
  const readAttempt=()=>{try{return JSON.parse(sessionStorage.getItem(attemptKey)||'null');}catch{return null;}};
  const storeAttempt=value=>{try{sessionStorage.setItem(attemptKey,JSON.stringify(value));}catch{/* A fresh request remains safe if browser storage is unavailable. */}};
  const forgetAttempt=()=>{try{sessionStorage.removeItem(attemptKey);}catch{}};
  function updateButton(){const button=document.getElementById('checkoutBtn');if(button){button.disabled=openingCheckout||!enabled||cartCount()===0;button.textContent=openingCheckout?'Opening secure checkout…':enabled?(mode==='test'?'Test checkout — no real charge':'Secure checkout'):'Checkout temporarily unavailable';}
    document.querySelectorAll('[data-buy-now]').forEach(button=>{button.disabled=openingCheckout||!enabled||remainingStock[button.dataset.buyNow]===0;button.textContent=openingCheckout?'Opening…':'Buy now';});
  }
  async function loadInventory(){
    try{
      const response=await fetch(`${API}/${mode}/inventory`,{cache:'no-store'});if(!response.ok)return;
      const {products}=await response.json();
      for(const product of products||[]){if(!Object.hasOwn(PRODUCTS,product.id)||!Number.isInteger(product.remaining))continue;
        remainingStock[product.id]=product.remaining;
        document.querySelectorAll(`[data-stock="${product.id}"]`).forEach(element=>element.textContent=product.remaining);
        document.querySelectorAll(`[data-stock-status="${product.id}"]`).forEach(element=>element.textContent=product.remaining>0?'In stock':'Currently unavailable');
        document.querySelectorAll(`[data-add="${product.id}"]`).forEach(button=>{button.disabled=product.remaining===0;});
      }
      updateButton();
    }catch{/* Checkout revalidates inventory on the server. */}
  }
  async function checkout(selectedItems=null){
    if(!enabled||openingCheckout)return;
    const preserveCart=selectedItems!==null;
    const items=selectedItems||Object.entries(getCart()).filter(([,quantity])=>quantity>0).map(([id,quantity])=>({id,quantity})).sort((a,b)=>a.id.localeCompare(b.id));if(!items.length)return;
    const fingerprint=JSON.stringify(items);let attempt=readAttempt();
    if(!attempt||attempt.fingerprint!==fingerprint||Boolean(attempt.preserveCart)!==preserveCart)attempt={fingerprint,preserveCart,requestId:crypto.randomUUID()};
    storeAttempt(attempt);openingCheckout=true;updateButton();note('Your payment details will be collected securely by Stripe.');
    try{
      const response=await fetch(`${API}/${mode}/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,requestId:attempt.requestId})});
      const result=await response.json();
      if(!response.ok){if(response.status===409)forgetAttempt();throw new Error(result.error||'Checkout is temporarily unavailable. Please try again.');}
      const checkoutUrl=new URL(result.url);if(checkoutUrl.protocol!=='https:'||checkoutUrl.hostname!=='checkout.stripe.com')throw new Error('Checkout could not be opened.');
      storeAttempt({...attempt,sessionId:result.sessionId});window.location.assign(checkoutUrl.href);
    }catch(error){const message=error.message||'Checkout could not be opened. Please try again.';note(message);notify(message);openingCheckout=false;updateButton();await loadInventory();}
  }
  async function showPaymentStatus(){
    const target=document.getElementById('paymentStatus');if(!target)return;
    const sessionId=new URLSearchParams(location.search).get('session_id');
    if(!sessionId||!/^cs_(test|live)_[\w]+$/.test(sessionId)){target.textContent='No checkout reference was provided. Contact info@torolagon.com if you need help with an order.';return;}
    const statusMode=sessionId.startsWith('cs_test_')?'test':'live';
    if(statusMode==='test')document.getElementById('paymentHeading').textContent='Test checkout';
    for(let count=0;count<10;count++){
      try{
        const response=await fetch(`${API}/${statusMode}/status?session_id=${encodeURIComponent(sessionId)}`,{cache:'no-store'});const result=await response.json();
        if(!response.ok)throw new Error('Order status could not be loaded.');
        if(result.state==='paid'){
          target.textContent=statusMode==='test'?'Test payment verified. No real payment was charged.':'Payment verified. Your order will be processed within 24–48 hours. Keep your Stripe receipt for your records.';
          // Only remove the purchased quantities when this browser initiated this exact checkout.
          const storedKey=`torolagon_checkout_${statusMode}`;let attempt;try{attempt=JSON.parse(sessionStorage.getItem(storedKey)||'null');}catch{}
          if(attempt?.sessionId===sessionId){if(!attempt.preserveCart){const cart=getCart();for(const item of result.items||[]){if(!Object.hasOwn(PRODUCTS,item.id))continue;cart[item.id]=Math.max(0,(cart[item.id]||0)-item.quantity);if(!cart[item.id])delete cart[item.id];}saveCart(cart);}try{sessionStorage.removeItem(storedKey);}catch{}}
          return;
        }
        if(result.state==='released'){target.textContent='This checkout expired or did not complete. Your cart is still available.';return;}
        target.textContent='Your payment status is being confirmed. You can keep this page open or contact info@torolagon.com with your receipt.';
      }catch{target.textContent='We could not confirm payment status yet. Check your Stripe receipt or contact info@torolagon.com before trying another payment.';}
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    document.getElementById('checkoutBtn')?.addEventListener('click',()=>checkout());
    document.querySelectorAll('[data-buy-now]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.buyNow,quantity=Number(document.querySelector(`[data-qty="${id}"]`)?.value||1);
      if(!button.disabled&&Object.hasOwn(PRODUCTS,id)&&Number.isInteger(quantity)&&quantity>0)checkout([{id,quantity}]);
    }));
    if(new URLSearchParams(location.search).get('checkout')==='cancelled')note('Checkout was cancelled. Your cart is saved, and no order is confirmed on this page.');
    try{const response=await fetch(`${API}/health`,{cache:'no-store'});if(response.ok){const health=await response.json();enabled=health[`${mode}Enabled`]===true;}}catch{}
    updateButton();await loadInventory();await showPaymentStatus();
  });
  window.addEventListener('torolagon:cart',updateButton);
  window.addEventListener('pageshow',()=>{openingCheckout=false;updateButton();});
})();
