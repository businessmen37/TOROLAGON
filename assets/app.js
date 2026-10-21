const PRODUCTS = {
  spray:{id:'spray',name:"TOROLAGON Men’s Sensitive Skin Spray",price:17.99,size:'15 ml',stock:50,url:'product-spray.html',image:'assets/images/product2-main.png'},
  oil:{id:'oil',name:"TOROLAGON Men’s Massage Oil",price:24.99,size:'10 ml',stock:50,url:'product-oil.html',image:'assets/images/product3-main.png'},
  dragon:{id:'dragon',name:"Dragon Power 9000 Sensitive Skin Spray for Men",price:19.99,size:'15 ml',stock:50,url:'product-dragon.html',image:'assets/images/product4-main.png'}
};
const menu = [
 ['Home','index.html'],
 ['Shop','shop.html'],
 ['About TOROLAGON','about.html'],
 ['FAQ','faq.html'],
 ['Contact','contact.html']
];
function getCart(){
 try{const raw=JSON.parse(localStorage.getItem('torolagon_cart')||'{}');const clean={};
 if(raw && typeof raw==='object' && !Array.isArray(raw)) for(const [id,p] of Object.entries(PRODUCTS)){const q=Number(raw[id]);if(Number.isFinite(q)&&q>=1)clean[id]=Math.min(p.stock,Math.floor(q))}
 return clean}catch(e){return {}}
}
function saveCart(c){try{localStorage.setItem('torolagon_cart',JSON.stringify(c))}catch(e){notify('Your browser could not save the cart. Please enable browser storage.')}updateCartCount()}
function cartCount(){return Object.values(getCart()).reduce((a,b)=>a+b,0)}
function updateCartCount(){document.querySelectorAll('.cart-count').forEach(el=>el.textContent=cartCount())}
function header(){
 const page=(location.pathname.split('/').pop()||'index.html');
 const nav=menu.map(([label,url])=>`<a class="${page===url?'active':''}" href="${url}">${label}</a>`).join('');
 return `<div class="announcement">Free U.S. shipping • Orders processed within 24–48 hours</div><header class="site-header"><div class="header-inner"><a class="brand" href="index.html"><img src="assets/images/torolagon-logo.png" alt="TOROLAGON"></a><nav class="nav" id="mainNav" aria-label="Main navigation">${nav}</nav><div class="header-actions"><a class="cart-link" href="cart.html">Cart <span class="cart-count">0</span></a><button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="mainNav">☰</button></div></div></header>`;
}
function footer(){return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div><img class="footer-logo" src="assets/images/torolagon-logo.png" alt="TOROLAGON"><p>Men’s personal care presented with discretion, simplicity, and professional customer support.</p><p>info@torolagon.com</p></div><div><strong>Policies</strong><div class="footer-links"><a href="shipping-policy.html">Shipping Policy</a><a href="returns.html">Return & Refund Policy</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></div></div></div><div class="copyright"><span>© 2026 TOROLAGON LLC. All rights reserved.</span><span>United States orders only.</span></div></div></footer>`}
function initLayout(){const h=document.querySelector('[data-header]');if(h)h.innerHTML=header();const f=document.querySelector('[data-footer]');if(f)f.innerHTML=footer();const toggle=document.getElementById('menuBtn');toggle?.addEventListener('click',()=>{const open=document.getElementById('mainNav').classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close menu':'Open menu')});document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('mainNav')?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open menu')}});saveCart(getCart())}
function notify(message){let toast=document.getElementById('cartToast');if(!toast){toast=document.createElement('div');toast.id='cartToast';toast.className='cart-toast';toast.setAttribute('role','status');document.body.append(toast)}toast.textContent=message;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),4500)}
window.addEventListener('storage',()=>{updateCartCount();renderCart()});
function money(n){return '$'+n.toFixed(2)}
function addToCart(id,qty=1){const p=PRODUCTS[id];if(!p)return;const c=getCart();const n=Number(qty);if(!Number.isInteger(n)||n<1)return;c[id]=Math.min((c[id]||0)+n,p.stock);saveCart(c);notify(`${p.name} added. ${c[id]} in cart.`)}
function bindAddButtons(){document.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.add;const q=document.querySelector(`[data-qty="${id}"]`)?.value||1;addToCart(id,q)}))}
function bindQty(){document.querySelectorAll('[data-qty-minus]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.qtyMinus,i=document.querySelector(`[data-qty="${id}"]`);i.value=Math.max(1,Number(i.value||1)-1)}));document.querySelectorAll('[data-qty-plus]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.qtyPlus,i=document.querySelector(`[data-qty="${id}"]`);i.value=Math.min(PRODUCTS[id].stock,Number(i.value||1)+1)}))}
function bindGallery(){document.querySelectorAll('.thumb').forEach(t=>t.addEventListener('click',()=>{const main=document.getElementById('galleryMain');if(main)main.src=t.dataset.src;document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));t.classList.add('active')}))}
function bindAccordions(){document.querySelectorAll('.acc button,.faq-q').forEach(b=>b.addEventListener('click',()=>{b.parentElement.classList.toggle('open');b.setAttribute('aria-expanded',String(b.parentElement.classList.contains('open')))}))}
function renderCart(){const root=document.getElementById('cartItems');if(!root)return;const c=getCart();const ids=Object.keys(c).filter(id=>PRODUCTS[id]&&c[id]>0);if(!ids.length){root.innerHTML='<div class="empty"><h3>Your cart is empty.</h3><p>Browse the TOROLAGON collection to add products.</p><a class="btn btn-dark" href="shop.html">Shop products</a></div>';document.getElementById('cartSummary').style.display='none';window.dispatchEvent(new Event('torolagon:cart'));return}
 root.innerHTML=ids.map(id=>{const p=PRODUCTS[id],q=c[id];return `<div class="cart-row"><img src="${p.image}" alt="${p.name}"><div><div class="cart-title"><a href="${p.url}">${p.name}</a></div><div class="cart-sub">${p.size}</div><button class="cart-remove" data-remove="${id}">Remove</button></div><div class="qty"><button aria-label="Decrease ${p.name} quantity" data-cart-minus="${id}">−</button><input value="${q}" readonly aria-label="Quantity"><button aria-label="Increase ${p.name} quantity" data-cart-plus="${id}">+</button></div><div class="cart-price">${money(p.price*q)}</div></div>`}).join('');
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const c=getCart();delete c[b.dataset.remove];saveCart(c);renderCart()});
 document.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>{const c=getCart(),id=b.dataset.cartMinus;c[id]=Math.max(1,(c[id]||1)-1);saveCart(c);renderCart()});
 document.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>{const c=getCart(),id=b.dataset.cartPlus;c[id]=Math.min(PRODUCTS[id].stock,(c[id]||0)+1);saveCart(c);renderCart()});
 const subtotal=ids.reduce((s,id)=>s+PRODUCTS[id].price*c[id],0);document.getElementById('subtotal').textContent=money(subtotal);document.getElementById('total').textContent=money(subtotal);document.getElementById('cartSummary').style.display='block';window.dispatchEvent(new Event('torolagon:cart'));
}
function initStickyPurchase(){
 const actions=document.querySelector('.product-actions');if(!actions)return;
 const id=actions.querySelector('[data-add]')?.dataset.add,p=PRODUCTS[id];if(!p)return;
 const bar=document.createElement('aside');bar.className='sticky-purchase';bar.hidden=true;bar.setAttribute('aria-label','Product purchase options');
 bar.innerHTML=`<div class="container sticky-purchase-inner"><img src="${p.image}" alt=""><div class="sticky-product"><strong>${p.name}</strong><span data-sticky-price>${money(p.price)} · Quantity 1</span></div><div class="product-actions"><button class="btn btn-primary" data-add="${id}">Add to cart</button><button class="btn btn-dark" data-buy-now="${id}" disabled>Buy now</button></div></div>`;
 document.body.append(bar);document.body.classList.add('has-sticky-purchase');
 const syncPrice=()=>{const quantity=Number(document.querySelector(`[data-qty="${id}"]`).value);bar.querySelector('[data-sticky-price]').textContent=`${money(p.price*quantity)} · Quantity ${quantity}`;};
 document.querySelector('.quantity-row').addEventListener('click',syncPrice);
 const observer=new IntersectionObserver(entries=>{bar.hidden=entries[0].boundingClientRect.bottom>110;},{rootMargin:'-110px 0px 0px 0px',threshold:0});observer.observe(actions);
}
document.addEventListener('DOMContentLoaded',()=>{initLayout();initStickyPurchase();bindAddButtons();bindQty();bindGallery();bindAccordions();renderCart()});
