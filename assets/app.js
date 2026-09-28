const PRODUCTS = {
  cream:{id:'cream',name:"TOROLAGON Men’s Sensitive Skin Cream",price:19.99,size:'20 g / 0.71 oz',stock:50,url:'product-cream.html',image:'assets/images/product1-main.png'},
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
function getCart(){try{return JSON.parse(localStorage.getItem('torolagon_cart')||'{}')}catch(e){return {}}}
function saveCart(c){localStorage.setItem('torolagon_cart',JSON.stringify(c));updateCartCount()}
function cartCount(){return Object.values(getCart()).reduce((a,b)=>a+b,0)}
function updateCartCount(){document.querySelectorAll('.cart-count').forEach(el=>el.textContent=cartCount())}
function header(){
 const page=(location.pathname.split('/').pop()||'index.html');
 const nav=menu.map(([label,url])=>`<a class="${page===url?'active':''}" href="${url}">${label}</a>`).join('');
 return `<div class="announcement">Free U.S. shipping • Orders processed within 24–48 hours</div><header class="site-header"><div class="header-inner"><a class="brand" href="index.html"><img src="assets/images/torolagon-logo.png" alt="TOROLAGON"></a><nav class="nav" id="mainNav">${nav}</nav><div class="header-actions"><a class="cart-link" href="cart.html">Cart <span class="cart-count">0</span></a><button class="menu-btn" id="menuBtn" aria-label="Open menu">☰</button></div></div></header>`;
}
function footer(){return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div><img class="footer-logo" src="assets/images/torolagon-logo.png" alt="TOROLAGON"><p>Men’s personal care presented with discretion, simplicity, and professional customer support.</p><p><a href="mailto:info@torolagon.com">info@torolagon.com</a></p></div><div><strong>Explore</strong><div class="footer-links"><a href="shop.html">Shop</a><a href="about.html">About TOROLAGON</a><a href="faq.html">FAQ</a><a href="contact.html">Contact</a></div></div><div><strong>Policies</strong><div class="footer-links"><a href="shipping-policy.html">Shipping Policy</a><a href="returns.html">Return & Refund Policy</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></div></div></div><div class="copyright"><span>© 2026 TOROLAGON LLC. All rights reserved.</span><span>United States orders only.</span></div></div></footer>`}
function initLayout(){const h=document.querySelector('[data-header]');if(h)h.innerHTML=header();const f=document.querySelector('[data-footer]');if(f)f.innerHTML=footer();document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('mainNav')?.classList.toggle('open'));updateCartCount()}
function money(n){return '$'+n.toFixed(2)}
function addToCart(id,qty=1){const p=PRODUCTS[id];if(!p)return;const c=getCart();c[id]=Math.min((c[id]||0)+Number(qty||1),p.stock);saveCart(c);alert(`${p.name} added to cart.`)}
function bindAddButtons(){document.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.add;const q=document.querySelector(`[data-qty="${id}"]`)?.value||1;addToCart(id,q)}))}
function bindQty(){document.querySelectorAll('[data-qty-minus]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.qtyMinus,i=document.querySelector(`[data-qty="${id}"]`);i.value=Math.max(1,Number(i.value||1)-1)}));document.querySelectorAll('[data-qty-plus]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.qtyPlus,i=document.querySelector(`[data-qty="${id}"]`);i.value=Math.min(PRODUCTS[id].stock,Number(i.value||1)+1)}))}
function bindGallery(){document.querySelectorAll('.thumb').forEach(t=>t.addEventListener('click',()=>{const main=document.getElementById('galleryMain');if(main)main.src=t.dataset.src;document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));t.classList.add('active')}))}
function bindAccordions(){document.querySelectorAll('.acc button,.faq-q').forEach(b=>b.addEventListener('click',()=>b.parentElement.classList.toggle('open')))}
function renderCart(){const root=document.getElementById('cartItems');if(!root)return;const c=getCart();const ids=Object.keys(c).filter(id=>PRODUCTS[id]&&c[id]>0);if(!ids.length){root.innerHTML='<div class="empty"><h3>Your cart is empty.</h3><p>Browse the TOROLAGON collection to add products.</p><a class="btn btn-dark" href="shop.html">Shop products</a></div>';document.getElementById('cartSummary').style.display='none';return}
 root.innerHTML=ids.map(id=>{const p=PRODUCTS[id],q=c[id];return `<div class="cart-row"><img src="${p.image}" alt="${p.name}"><div><div class="cart-title"><a href="${p.url}">${p.name}</a></div><div class="cart-sub">${p.size}</div><button class="cart-remove" data-remove="${id}">Remove</button></div><div class="qty"><button data-cart-minus="${id}">−</button><input value="${q}" readonly><button data-cart-plus="${id}">+</button></div><div class="cart-price">${money(p.price*q)}</div></div>`}).join('');
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const c=getCart();delete c[b.dataset.remove];saveCart(c);renderCart()});
 document.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>{const c=getCart(),id=b.dataset.cartMinus;c[id]=Math.max(1,(c[id]||1)-1);saveCart(c);renderCart()});
 document.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>{const c=getCart(),id=b.dataset.cartPlus;c[id]=Math.min(PRODUCTS[id].stock,(c[id]||0)+1);saveCart(c);renderCart()});
 const subtotal=ids.reduce((s,id)=>s+PRODUCTS[id].price*c[id],0);document.getElementById('subtotal').textContent=money(subtotal);document.getElementById('total').textContent=money(subtotal);document.getElementById('cartSummary').style.display='block';
}
document.addEventListener('DOMContentLoaded',()=>{initLayout();bindAddButtons();bindQty();bindGallery();bindAccordions();renderCart()});
