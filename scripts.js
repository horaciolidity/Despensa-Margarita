/**********************
 * LICENCIA / ACTIVACIÓN
 **********************/
(function(){

  // Clave ofuscada (Mn232323Mn)
  const _k = ['TW4y','MzIz','MjNN','bg=='].join('');
  const CLAVE_REAL = atob(_k);

  function pedirClave() {
    let input = prompt('Ingrese la clave de activación:');

    if (!input) return false;

    if (input === CLAVE_REAL) {
      localStorage.setItem('lic_ok', '1');
      alert('✅ Sistema activado correctamente');
      return true;
    } else {
      alert('❌ Clave incorrecta');
      return false;
    }
  }

  function bloquearSistema() {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;">
        <h2>🔒 Sistema no activado</h2>
        <p>Contacte al proveedor para obtener la clave</p>

        <a href="https://wa.me/542617048835?text=Hola%20necesito%20activar%20el%20sistema"
           target="_blank"
           style="margin-top:20px;padding:12px 20px;background:#25D366;color:white;text-decoration:none;border-radius:8px;font-size:18px;">
           💬 WhatsApp
        </a>
      </div>
    `;
  }

  const activado = localStorage.getItem('lic_ok');

  if (!activado) {
    const ok = pedirClave();
    if (!ok) {
      bloquearSistema();
      throw new Error('Sistema bloqueado');
    }
  }

})();


const BULK_STEP = 0.100;  // paso para kg/litro
const QTY_DEC   = 3;
const MONEY_DEC = 2;

/**********************
 * FORMAT HELPERS
 **********************/
const fmtQty   = n => Number(n || 0).toFixed(QTY_DEC);
const fmtMoney = n => Number(n || 0).toFixed(MONEY_DEC);

/**********************
 * PRODUCT VALIDATION
 **********************/
function _num(v, dflt = 0) {
  var n = Number(v);
  return (isNaN(n) ? dflt : n);
}

/**
 * Reglas:
 * - cost >= 0
 * - price > 0
 * - price >= cost (no vender por debajo del costo)
 * Devuelve { ok, reasons[] }
 */
function validateProduct(p) {
  var cost  = _num(p.cost, 0);
  var price = _num(p.price, 0);
  var reasons = [];

  if (cost < 0) reasons.push('El costo no puede ser negativo.');
  if (price <= 0) reasons.push('El precio debe ser mayor a 0.');
  if (price < cost) reasons.push('El precio es menor al costo.');

  return { ok: reasons.length === 0, reasons: reasons };
}

// Marca el objeto con flags para UI (sin alterar números)
function withValidity(p) {

  var v = validateProduct(p);

  var copy = Object.assign({}, p);

  copy._invalid = !v.ok;
  copy._invalid_reasons = v.reasons;

  // ⚠ ALERTA SOLO VISUAL
  copy._warning_cost =
    Number(p.cost || 0) <= 0;

  return copy;
}

/**********************
 * INIT
 **********************/
document.addEventListener('DOMContentLoaded', () => {
  displayProducts();
  updateTotalPrice();

  var input = document.getElementById('opening-cash');
  var yaInicioCaja = localStorage.getItem('openingCashSet') === 'true';
  if (yaInicioCaja && input) input.disabled = true;

  // Animación de carga (si existe)
  setTimeout(function() {
    var loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(function() {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  }, 4000);

  // Inicializar listeners del modal de vuelto si existe en el HTML
  initCashModalOnce();

  // file input (sin optional chaining)
  (function(){
    var fileInputEl = document.getElementById('fileInput');
    if (fileInputEl) fileInputEl.addEventListener('change', handleFileSelect, false);
  })();
});

/**********************
 * STORAGE
 **********************/
function getProducts() {
  return JSON.parse(localStorage.getItem('products')) || [];
}
function saveProducts(products) {
  localStorage.setItem('products', JSON.stringify(products));
}
function getByCode(code) {
  return getProducts().find(p => p.code === code);
}

/**********************
 * ABM PRODUCTOS
 **********************/
function addProduct() {
  var code = document.getElementById('product-code').value.trim();
  var name = document.getElementById('product-name').value.trim();
  var price = parseFloat(document.getElementById('product-price').value.trim());
  var quantity = parseFloat(document.getElementById('product-quantity').value.trim());
  var cost = parseFloat(document.getElementById('product-cost').value.trim());
  var unit = document.getElementById('product-unit').value;
  var isBulk = (unit === 'kg' || unit === 'litro');

  if (!code || !name) { alert('Código y nombre son obligatorios.'); return; }
  if (isNaN(price)) { price = 0; }
  if (isNaN(quantity)) { quantity = 0; }
  if (isNaN(cost)) { cost = 0; }

  var products = getProducts();
  var i = products.findIndex(p => p.code === code);

  var base = { code, name, price, quantity, unit, isBulk, cost };
  var tagged = withValidity(base);

  if (i !== -1) {
    // actualizamos manteniendo contadores previos
    var prev = products[i];
    products[i] = withValidity({
      code,
      name,
      price,
      unit: prev.unit != null ? prev.unit : unit,
      isBulk: prev.isBulk != null ? prev.isBulk : isBulk,
      cost: isNaN(cost) ? (prev.cost || 0) : cost,
      quantity: _num(prev.quantity, 0) + _num(quantity, 0)
    });
  } else {
    products.push(tagged);
  }

  saveProducts(products);
  displayProducts();
  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();

  clearForm();

  // Mensaje si quedó inválido
  if (tagged._invalid) {
    alert('Producto guardado con ALERTA para corregir:\n- ' + tagged._invalid_reasons.join('\n- '));
  }
}

function clearForm() {
  document.getElementById('product-code').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-quantity').value = '';
  document.getElementById('product-cost').value = '';
}

function searchProductLive(query) {
  var resultDiv = document.getElementById('product-result');
  resultDiv.innerHTML = '';

  if (!query) return;

  var products = getProducts();

  var resultados = products.filter(function(p){
    return (
      (p.code && p.code.toLowerCase().includes(query)) ||
      (p.name && p.name.toLowerCase().includes(query))
    );
  });

  if (resultados.length === 0) {
    resultDiv.innerHTML = '<p style="color:#999;">Sin resultados</p>';
    return;
  }

  var fontSize = resultados.length > 10 ? '11px'
               : resultados.length > 5  ? '13px'
               : '15px';

  resultados.forEach(function(productRaw){
    var product = withValidity(productRaw);

    var div = document.createElement('div');
    div.className = 'search-item';
    div.style.fontSize = fontSize;

    function highlight(text) {
      if (!text) return '';
      return text.replace(new RegExp('(' + query + ')', 'gi'), '<mark>$1</mark>');
    }

    div.innerHTML = `
      <div class="search-line">
        <strong>${highlight(product.name)}</strong>
        <span>$${fmtMoney(product.price)}</span>
      </div>
      <div class="search-sub">
        Cod: ${highlight(product.code)} | Stock: ${product.quantity}
      </div>
      ${product._invalid ? `<div style="color:#c00;font-size:11px;">⚠ ${product._invalid_reasons.join(' | ')}</div>` : ''}
    `;
    ${product._warning_cost
  ? `<div style="
      color:#f59e0b;
      font-size:11px;
      font-weight:700;
      margin-top:4px;
    ">
      ⚠ Producto sin costo cargado
    </div>`
  : ''
}

    // 👉 CLICK SOLO MUESTRA (NO AGREGA)
   div.onclick = function() {

  document.getElementById('search-code').value = product.name;

  resultDiv.innerHTML = '';

  var selected = document.createElement('div');
  selected.className = 'search-item';
  selected.style.fontSize = '15px';

  selected.innerHTML = `
    <div class="search-line">
      <strong>${product.name}</strong>
      <span>$${fmtMoney(product.price)}</span>
    </div>

    <div class="search-sub">
      Cod: ${product.code} | Stock: ${product.quantity}
    </div>

    <div class="search-actions">
      <button onclick="editProduct('${product.code}')">
        ✏ Editar
      </button>

      <button onclick="deleteProduct('${product.code}')">
        🗑 Eliminar
      </button>
    </div>
  `;

resultDiv.appendChild(selected);
};

resultDiv.appendChild(div);

}); // ← cierra el forEach

} // ← cierra searchProductLive
function displayProducts() {
  var products = getProducts();
  var productsList = document.getElementById('products');
  if (!productsList) return;
  productsList.innerHTML = '';

  products.forEach(function(raw){
    var product = withValidity(raw); // recalcula por si vinieron de import

    var li = document.createElement('li');
    li.style.position = 'relative';

    var line = '<span>' + product.code + ' - ' + product.name +
               ' - $' + fmtMoney(product.price) +
               ' - Cantidad: ' + (product.isBulk ? fmtQty(product.quantity) : product.quantity) + '</span>';

    // Botones CRUD
    line += ' <button onclick="deleteProduct(\'' + product.code + '\')">Eliminar</button>';
    line += ' <button onclick="editProduct(\'' + product.code + '\')">Editar</button>';
    line += ' <button onclick="updateProduct(\'' + product.code + '\')">Actualizar</button>';

    // Añadir al carrito (bloqueado si inválido)
    if (product._invalid) {
      line += ' <button disabled title="Corregí precios antes de vender">Añadir</button>';
    } else {
      line += ' <button onclick="addToCart(getByCode(\'' + product.code + '\'))">Añadir</button>';
    }

    li.innerHTML = line;
// ⚠ ALERTA COSTO 0
if (product._warning_cost) {

  var warn = document.createElement('div');

  warn.textContent = '⚠ Sin costo cargado';

  warn.style.position = 'absolute';
  warn.style.bottom = '-8px';
  warn.style.left = '10px';
  warn.style.background = '#f59e0b';
  warn.style.color = '#111';
  warn.style.fontSize = '10px';
  warn.style.fontWeight = '700';
  warn.style.padding = '3px 7px';
  warn.style.borderRadius = '6px';

  li.appendChild(warn);
}
    // Badge/alerta
    if (product._invalid) {
      var badge = document.createElement('div');
      badge.textContent = '⚠ Corregir precios';
      badge.title = product._invalid_reasons.join(' | ');
      badge.style.position = 'absolute';
      badge.style.top = '-6px';
      badge.style.right = '-6px';
      badge.style.background = '#e02424';
      badge.style.color = '#fff';
      badge.style.fontSize = '11px';
      badge.style.padding = '3px 6px';
      badge.style.borderRadius = '6px';
      badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
      li.appendChild(badge);
    }

    productsList.appendChild(li);
  });
}

function updateProduct(code) {
  var products = getProducts();
  var product = products.find(p => p.code === code);
  var newQuantity = prompt('Ingrese la nueva cantidad para el producto:', product.quantity);
  if (newQuantity !== null) {
    var quantityNumber = parseFloat(newQuantity);
    if (!isNaN(quantityNumber) && quantityNumber >= 0) {
      product.quantity = quantityNumber;
      // re-marcar validez por si tocaron algo externo
      var idx = products.findIndex(p => p.code === code);
      products[idx] = withValidity(product);
      saveProducts(products);
      displayProducts();
      updateTotalPrice();
      if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
      alert('Cantidad de ' + product.name + ' actualizada a ' + quantityNumber + '.');
    } else {
      alert('Por favor, ingrese una cantidad válida.');
    }
  }
}

function deleteProduct(code) {
  var products = getProducts().filter(p => p.code !== code);
  saveProducts(products);
  displayProducts();
}

function editProduct(code) {
  var product = getProducts().find(p => p.code === code);
  if (product) {
    // Cargamos TODOS los campos (no borramos aún el producto)
    document.getElementById('product-code').value = product.code;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-price').value = _num(product.price, 0);
    document.getElementById('product-quantity').value = _num(product.quantity, 0);
    document.getElementById('product-cost').value = _num(product.cost, 0);
  }
}

/**********************
 * CARRITO
 **********************/
function addToCart(product) {
  if (!product) return;
// ⚠ ALERTA SOLO VISUAL
if (Number(product.cost || 0) <= 0) {

  alert(
    '⚠ ALERTA\n\n' +
    'El producto "' + product.name + '"\n' +
    'no tiene costo cargado.'
  );
}
  // Bloqueo por producto inválido
  var v = validateProduct(product);
  if (!v.ok || product._invalid) {
    alert('No se puede vender este producto hasta corregir:\n- ' + (product._invalid_reasons || v.reasons).join('\n- '));
    return;
  }

  var cartList = document.getElementById('cart');
  var existingItem = Array.from(cartList.children).find(item => item.dataset.code === product.code);

  var quantity = 1;
  if (product.isBulk) {
    var input = prompt('Ingrese la cantidad en ' + product.unit + ' para "' + product.name + '" (ej: 0.300):');
    var parsed = parseFloat(input);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Cantidad inválida');
      return;
    }
    quantity = parsed;
  }

  if (existingItem) {
    // sumamos cantidad y recalculamos precio total
    var qEl = existingItem.querySelector('.quantity');
    var pEl = existingItem.querySelector('.price');
    var currentQty = parseFloat(qEl.textContent);
    var newQty = currentQty + quantity;
    qEl.textContent = product.isBulk ? fmtQty(newQty) : String(newQty);
    pEl.textContent = fmtMoney(newQty * product.price);
  } else {
    var li = document.createElement('li');
    li.dataset.code = product.code;
    li.dataset.unit = product.unit || '';
    li.dataset.isBulk = product.isBulk ? '1' : '0';

    var shownQty = product.isBulk ? fmtQty(quantity) : String(quantity);
    var lineTotal = quantity * product.price;

    li.innerHTML = ''
      + '<span>'
      +   product.name + ' - <span class="quantity">' + shownQty + '</span> ' + (product.isBulk ? product.unit : '') + ' - '
      +   '$<span class="price">' + fmtMoney(lineTotal) + '</span>'
      + '</span>'
      + '<button onclick="addQuantity(\'' + product.code + '\')">+</button>'
      + '<button onclick="removeQuantity(\'' + product.code + '\')">-</button>'
      + '<button onclick="editCartItemPrice(\'' + product.code + '\')">Editar $</button>';
    cartList.appendChild(li);
  }

  if (typeof notificarCliente === 'function') {
    notificarCliente(product.name, product.price, quantity);
  }
  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
  checkStock(product);
}

function removeFromCart(code) {
  var cartList = document.getElementById('cart');
  var existingItem = Array.from(cartList.children).find(item => item.dataset.code === code);
  if (existingItem) {
    existingItem.remove();
    updateTotalPrice();
    if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
  }
}

/**********************
 * ESCANEO
 **********************/
function scanProduct() {
  var codeInp = document.getElementById('scan-code');
  var code = (codeInp.value || '').trim();
  var products = getProducts();
  var product = products.find(p => p.code === code);

  if (!product) {
    alert('Producto no encontrado');
    return;
  }

  // Bloqueo al escanear si es inválido
  var v = validateProduct(product);
  if (!v.ok || product._invalid) {
    alert('Producto inválido. Corregir antes de vender:\n- ' + (product._invalid_reasons || v.reasons).join('\n- '));
    codeInp.value = '';
    return;
  }

  var cartList = document.getElementById('cart');
  var existingItem = Array.from(cartList.children).find(item => item.dataset.code === product.code);

  if (existingItem) {
    var qEl = existingItem.querySelector('.quantity');
    var pEl = existingItem.querySelector('.price');
    var currentQty = parseFloat(qEl.textContent);

    if (product.isBulk) {
      var add = prompt('Cantidad adicional en ' + product.unit + ' para "' + product.name + '" (ej: 0.300):');
      var parsed = parseFloat(add);
      if (isNaN(parsed) || parsed <= 0) { codeInp.value=''; return; }
      var newQty = currentQty + parsed;
      qEl.textContent = fmtQty(newQty);
      pEl.textContent = fmtMoney(newQty * product.price);
    } else {
      var newQty2 = currentQty + 1;
      qEl.textContent = String(newQty2);
      pEl.textContent = fmtMoney(newQty2 * product.price);
    }
    updateTotalPrice();
    if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
    codeInp.value = '';
    checkStock(product);
    return;
  }

  // si no existía: agregar normalmente (ya validado)
  addToCart(product);
  codeInp.value = '';
  updateTotalPrice();
  checkStock(product);
}

/**********************
 * EDITAR PRECIO (RECALC PESABLES)
 **********************/
function editCartItemPrice(code) {
  var cartList = document.getElementById('cart');
  var item = Array.from(cartList.children).find(item => item.dataset.code === code);
  if (!item) return;

  var currentPrice = parseFloat(item.querySelector('.price').textContent);
  var newPrice = parseFloat(prompt('Ingrese el nuevo precio total para este producto:', fmtMoney(currentPrice)));

  if (isNaN(newPrice) || newPrice <= 0) {
    alert('Precio inválido.');
    return;
  }

  var product = getByCode(code);
  if (!product) return;

  if (product.isBulk) {
    var newQty = newPrice / product.price;
    item.querySelector('.quantity').textContent = fmtQty(newQty);
  }

  item.querySelector('.price').textContent = fmtMoney(newPrice);
  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
}

/**********************
 * + / − (PASOS PARA PESABLES)
 **********************/
function removeQuantity(code) {
  var cartList = document.getElementById('cart');
  var item = Array.from(cartList.children).find(i => i.dataset.code === code);
  var product = getByCode(code);
  if (!item || !product) return;

  var qEl = item.querySelector('.quantity');
  var pEl = item.querySelector('.price');

  var step = product.isBulk ? BULK_STEP : 1;
  var currentQty = parseFloat(qEl.textContent);
  var newQty = currentQty - step;

  if (newQty <= 0) {
    item.remove();
  } else {
    qEl.textContent = product.isBulk ? fmtQty(newQty) : String(Math.round(newQty));
    pEl.textContent = fmtMoney(newQty * product.price);
  }

  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
}

function addQuantity(code) {
  var cartList = document.getElementById('cart');
  var item = Array.from(cartList.children).find(i => i.dataset.code === code);
  var product = getByCode(code);
  if (!item || !product) return;

  var qEl = item.querySelector('.quantity');
  var pEl = item.querySelector('.price');

  var step = product.isBulk ? BULK_STEP : 1;
  var currentQty = parseFloat(qEl.textContent);
  var newQty = currentQty + step;

  qEl.textContent = product.isBulk ? fmtQty(newQty) : String(Math.round(newQty));
  pEl.textContent = fmtMoney(newQty * product.price);

  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
}

/**********************
 * TOTAL
 **********************/
function updateTotalPrice() {
  var cartList = document.getElementById('cart');
  var total = 0;

  Array.from(cartList.children).forEach(function(item){
    var priceElement = item.querySelector('.price');
    if (priceElement) {
      var price = parseFloat(priceElement.textContent);
      total += (isNaN(price) ? 0 : price);
    }
  });

  var totalPriceElement = document.getElementById('total-price');
  if (totalPriceElement) totalPriceElement.textContent = fmtMoney(total);
}

/**********************
 * CHECKOUT (opcional) — Corregido para decimales
 **********************/
function checkout() {
  var total = parseFloat(document.getElementById('total-price').textContent);
  var totalVendido = parseFloat(localStorage.getItem('totalVendido')) || 0;
  totalVendido += total;
  localStorage.setItem('totalVendido', fmtMoney(totalVendido));

  var cartItems = document.querySelectorAll('#cart li');
  var products = getProducts();

  var quantitiesToDeduct = {};
  var hasStockIssue = false;

  cartItems.forEach(function(item){
    var productCode = item.dataset.code;
    var quantity = parseFloat(item.querySelector('.quantity').textContent);
    var product = products.find(p => p.code === productCode);

    if (product) {
      if (product.quantity < quantity) {
        alert('No hay suficiente stock de ' + product.name + '. Solo quedan ' + product.quantity + ' unidades.');
        hasStockIssue = true;
        return;
      }
      quantitiesToDeduct[productCode] = quantity;
    }
  });

  if (hasStockIssue) return;

  Object.entries(quantitiesToDeduct).forEach(function(entry){
    var code = entry[0], quantity = entry[1];
    var product = products.find(p => p.code === code);
    if (product) {
      product.quantity = Number((product.quantity - quantity).toFixed(QTY_DEC));
      product.sold = Number(((product.sold || 0) + quantity).toFixed(QTY_DEC));
    }
  });

  saveProducts(products);
  document.getElementById('cart').innerHTML = '';
  document.getElementById('total-price').textContent = '0.00';
  alert('Compra finalizada. El inventario ha sido actualizado.');
  displayProducts();
}

/**********************
 * APERTURA DE CAJA
 **********************/
function setOpeningCash() {
  var input = document.getElementById('opening-cash');
  var value = parseFloat(input.value.trim());
  if (!isNaN(value) && value >= 0) {
    localStorage.setItem('openingCash', fmtMoney(value));
    localStorage.setItem('openingCashSet', 'true');
    input.disabled = true;
    alert('Caja iniciada con $' + fmtMoney(value));
  } else {
    alert('Ingrese un monto válido');
  }
}
function getOpeningCash() {
  return parseFloat(localStorage.getItem('openingCash')) || 0;
}

/**********************
 * VENTAS / FINALIZAR
 **********************/
function saveSale(cart, paymentMethod) {
  var sales = JSON.parse(localStorage.getItem('sales')) || [];
  var timestamp = new Date().toLocaleString();
  sales.push({ cart, paymentMethod, timestamp });
  localStorage.setItem('sales', JSON.stringify(sales));
}

function finalizeSale(method) {
  var cartItems = document.querySelectorAll('#cart li');
  if (cartItems.length === 0) {
    alert('El carrito está vacío');
    return;
  }

  var products = getProducts();
  var cart = [];
  var hasStockIssue = false;

  cartItems.forEach(function(item){
    var code = item.dataset.code;
    var quantity = parseFloat(item.querySelector('.quantity').textContent);
    var totalPrice = parseFloat(item.querySelector('.price').textContent);
    var product = products.find(p => p.code === code);

    if (!product) return;

    if (product.quantity < quantity) {
      alert('No hay suficiente stock de ' + product.name);
      hasStockIssue = true;
      return;
    }

    // Revalidar por si alguien modificó localStorage a mano
    var v = validateProduct(product);
    if (!v.ok || product._invalid) {
      alert('No se puede finalizar venta: producto inválido (' + product.name + '). Motivos:\n- ' + (product._invalid_reasons || v.reasons).join('\n- '));
      hasStockIssue = true;
      return;
    }

    var unitPrice = totalPrice / quantity;
    cart.push({
      code: code,
      name: product.name,
      price: unitPrice,
      quantity: quantity,
      cost: product.cost || 0
    });
  });

  if (hasStockIssue) return;

  var totalVenta = cart.reduce(function(acc, p){ return acc + (p.price * p.quantity); }, 0);

  var m = (method || '').toString().toLowerCase();
  var methodLabel = m.indexOf('efect') === 0 ? 'Efectivo'
                   : m.indexOf('transf') === 0 ? 'Transferido'
                   : method;

  var pagoCon = null;
  var vuelto = null;

  if (methodLabel === 'Efectivo') {
    var input = prompt('Total $' + fmtMoney(totalVenta) + '.\n¿Con cuánto paga?', fmtMoney(totalVenta));
    var monto = parseFloat(input);
    if (isNaN(monto) || monto <= 0) { alert('Monto inválido.'); return; }
    if (monto < totalVenta) { alert('Monto insuficiente. Faltan $' + fmtMoney(totalVenta - monto) + '.'); return; }
    pagoCon = Number(fmtMoney(monto));
    vuelto  = Number(fmtMoney(monto - totalVenta));
  }

  var novedades = prompt('¿Desea agregar alguna novedad sobre esta venta? (opcional)') || '';
  var sales = JSON.parse(localStorage.getItem('sales')) || [];
  var timestamp = new Date().toLocaleString();
  sales.push({
    cart: cart,
    paymentMethod: methodLabel,
    timestamp: timestamp,
    novedades: novedades,
    ...(methodLabel === 'Efectivo' ? { pagoCon: pagoCon, vuelto: vuelto } : {})
  });
  localStorage.setItem('sales', JSON.stringify(sales));

  var totalVendido = parseFloat(localStorage.getItem('totalVendido')) || 0;
  totalVendido += totalVenta;
  localStorage.setItem('totalVendido', fmtMoney(totalVendido));

  // Descontar stock y sumar vendidos
  cart.forEach(function(line){
    var p = products.find(function(pp){ return pp.code === line.code; });
    if (p) {
      p.quantity = Number((p.quantity - line.quantity).toFixed(QTY_DEC));
      p.sold     = Number(((p.sold || 0) + line.quantity).toFixed(QTY_DEC));
    }
  });
  saveProducts(products);

  // Reset UI
  document.getElementById('cart').innerHTML = '';
  document.getElementById('total-price').textContent = '0.00';
  displayProducts();
  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();

  var canal = new BroadcastChannel('pos_channel');
  canal.postMessage({ tipo: 'despedida' });

  // Mostrar SOLO el modal para efectivo (sin alerts extra)
  if (methodLabel === 'Efectivo') {
    showCashChangeModal({ total: totalVenta, pagoCon: pagoCon, vuelto: vuelto });
  } else {
    // Si querés, podés avisar para transferencias:
    // alert('Venta registrada con pago: ' + methodLabel);
  }
}

/**********************
 * MODAL DE VUELTO (JS)
 * — Requiere el HTML del modal en index.html —
 **********************/
function showCashChangeModal(data) {
  var total = data.total, pagoCon = data.pagoCon, vuelto = data.vuelto;
  var root = document.getElementById('cash-change-modal');

  // fallback si no está el HTML del modal
  if (!root) {
    alert(
      'Venta EFECTIVO\n' +
      'Total: $' + fmtMoney(total) + '\n' +
      'Pagó con: $' + fmtMoney(pagoCon) + '\n' +
      'Vuelto: $' + fmtMoney(vuelto)
    );
    return;
  }

  var elTotal   = document.getElementById('ccm-total');
  var elPagoCon = document.getElementById('ccm-pagocon');
  var elVuelto1 = document.getElementById('ccm-vuelto');
  var elVuelto2 = document.getElementById('ccm-vuelto-2');

  if (elTotal)   elTotal.textContent   = '$' + fmtMoney(total);
  if (elPagoCon) elPagoCon.textContent = '$' + fmtMoney(pagoCon);
  if (elVuelto1) elVuelto1.textContent = '$' + fmtMoney(vuelto);
  if (elVuelto2) elVuelto2.textContent = '$' + fmtMoney(vuelto);

  root.classList.add('show');
  root.setAttribute('aria-hidden', 'false');

  setTimeout(function () {
    var okBtn = document.getElementById('ccm-ok');
    if (okBtn) okBtn.focus();
  }, 30);
}

function hideCashChangeModal() {
  var root = document.getElementById('cash-change-modal');
  if (!root) return;
  root.classList.remove('show');
  root.setAttribute('aria-hidden', 'true');
}

function initCashModalOnce() {
  var root = document.getElementById('cash-change-modal');
  if (!root || root.dataset.bound === '1') return;

  var btnClose = root.querySelector('.cash-modal-close');
  if (btnClose) btnClose.addEventListener('click', hideCashChangeModal);

  var okBtn = document.getElementById('ccm-ok');
  if (okBtn) okBtn.addEventListener('click', hideCashChangeModal);

  root.addEventListener('click', function (e) {
    if (e.target === root) hideCashChangeModal();
  });

  var printBtn = document.getElementById('ccm-print');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('show')) {
      hideCashChangeModal();
    }
  });

  root.dataset.bound = '1';
}

/**********************
 * ARQUEO
 **********************/
function showSalesSummary() {
  var sales = JSON.parse(localStorage.getItem('sales')) || [];
  var summary = '';
  var totalCash = 0;
  var totalTransfer = 0;
  var totalCostos = 0;
  var totalGanancia = 0;

  sales.forEach(function(sale, index){
    summary += '🧾 Venta #' + (index + 1) + ' - ' + sale.timestamp + ' - Método: ' + sale.paymentMethod + '\n';

    sale.cart.forEach(function(p){
      var quantity = parseFloat(p.quantity);
      var price = parseFloat(p.price);
      var cost = parseFloat(p.cost || 0);
      var subtotal = price * quantity;
      var costoTotal = cost * quantity;
      var ganancia = subtotal - costoTotal;

      summary += '  🛒 ' + fmtQty(quantity) + ' x ' + p.name
              + ' | Precio u.: $' + fmtMoney(price)
              + ' | Costo u.: $' + fmtMoney(cost)
              + ' | Subtotal: $' + fmtMoney(subtotal)
              + ' | Ganancia: $' + fmtMoney(ganancia) + '\n';

      totalCostos += costoTotal;
    });

    var totalVenta = sale.cart.reduce(function(acc, p){ return acc + (p.price * p.quantity); }, 0);
    var totalCosto = sale.cart.reduce(function(acc, p){ return acc + ((p.cost || 0) * p.quantity); }, 0);
    var gananciaVenta = totalVenta - totalCosto;
    totalGanancia += gananciaVenta;

    if (sale.paymentMethod === 'Efectivo' && sale.pagoCon != null) {
      summary += '  💵 Pagó con: $' + fmtMoney(sale.pagoCon) + ' — Vuelto: $' + fmtMoney(sale.vuelto) + '\n';
    }

    if (sale.novedades && sale.novedades.trim() !== '') {
      summary += '  📝 Novedades: ' + sale.novedades + '\n';
    }

    summary += '  💲 Total venta: $' + fmtMoney(totalVenta) + '\n';
    summary += '  📦 Costo total: $' + fmtMoney(totalCosto) + '\n';
    summary += '  📈 Ganancia: $' + fmtMoney(gananciaVenta) + '\n\n';

    if (sale.paymentMethod.toLowerCase().indexOf('efectivo') !== -1) totalCash += totalVenta;
    if (sale.paymentMethod.toLowerCase().indexOf('transfer') !== -1) totalTransfer += totalVenta;
  });

  summary += '\n🔓 Apertura de caja: $' + fmtMoney(getOpeningCash());
  summary += '\n💰 Total efectivo: $' + fmtMoney(totalCash);
  summary += '\n💳 Total transferencia: $' + fmtMoney(totalTransfer);
  summary += '\n📦 Costo total de productos vendidos: $' + fmtMoney(totalCostos);
  summary += '\n📈 Ganancia total: $' + fmtMoney(totalGanancia);
  summary += '\n💵 Total vendido: $' + fmtMoney(totalCash + totalTransfer);

  var textarea = document.getElementById('sales-summary');
  if (textarea) textarea.value = summary;
}

function payWithTransfer() {
  finalizeSale('Transferido');
}
function downloadSummary() {
  var text = document.getElementById('sales-summary').value;
  var blob = new Blob([text], { type: 'text/plain' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'arqueo_caja.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**********************
 * IMPORT/EXPORT PRODUCTOS
 **********************/
function handleFileSelect(event) {
  var file = event.target.files[0];
  if (file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var contents = e.target.result;
      processFileContents(contents);
    };
    reader.readAsText(file);
  }
}

function processFileContents(contents) {
  var products = parseProducts(contents);
  saveProductsToLocalStorage(products);
  displayProducts();
}

function parseProducts(contents) {
  var lines = contents.split('\n');

  var products = lines.map(function(line){
    var parts = line.split(',');

    // ✅ Soporta archivos viejos (4 columnas) y nuevos (5 columnas)
    if (parts.length < 4) {
      console.error('Formato de producto inválido:', line);
      return null;
    }

    var code     = parts[0];
    var name     = parts[1];
    var price    = parts[2];
    var quantity = parts[3];
    var cost     = parts[4]; // 👈 puede venir o no

    var obj = {
      code: (code || '').trim(),
      name: (name || '').trim(),
      price: parseFloat((price || '').trim()),
      quantity: parseFloat((quantity || '').trim()),
      cost: parseFloat((cost || '0').trim()), // ✅ FIX CLAVE
      unit: '',
      isBulk: false
    };

    return withValidity(obj);
  }).filter(function(p){ return !!p; });

  return products;
}
function saveProductsToLocalStorage(products) {
  var existingProducts = getProducts();

  var agregados = [];
  var actualizados = [];
  var errores = [];

  products.forEach(function(newProd) {

    // validar básico
    if (!newProd.code || !newProd.name) {
      errores.push('Producto inválido (sin código o nombre)');
      return;
    }

    var index = existingProducts.findIndex(p => p.code === newProd.code);

    if (index !== -1) {
      // 🔄 ACTUALIZAR
      var prev = existingProducts[index];

      var actualizado = {
        code: newProd.code,
        name: newProd.name || prev.name,
        price: !isNaN(newProd.price) ? newProd.price : prev.price,
        cost: !isNaN(newProd.cost) ? newProd.cost : (prev.cost || 0),
        quantity: !isNaN(newProd.quantity) ? newProd.quantity : prev.quantity,
        unit: newProd.unit || prev.unit || 'unidad',
        isBulk: newProd.isBulk != null ? newProd.isBulk : prev.isBulk
      };

      existingProducts[index] = withValidity(actualizado);
      actualizados.push(newProd.code + ' - ' + actualizado.name);

    } else {
      // ➕ NUEVO
      existingProducts.push(withValidity(newProd));
      agregados.push(newProd.code + ' - ' + newProd.name);
    }
  });

  saveProducts(existingProducts);

  // 📊 REPORTE FINAL
  var msg = '📦 Importación completada\n\n';

  if (agregados.length) {
    msg += '➕ Agregados (' + agregados.length + '):\n';
    msg += agregados.slice(0, 5).join('\n') + (agregados.length > 5 ? '\n...' : '') + '\n\n';
  }

  if (actualizados.length) {
    msg += '🔄 Actualizados (' + actualizados.length + '):\n';
    msg += actualizados.slice(0, 5).join('\n') + (actualizados.length > 5 ? '\n...' : '') + '\n\n';
  }

  if (errores.length) {
    msg += '⚠ Errores (' + errores.length + '):\n';
    msg += errores.slice(0, 5).join('\n') + '\n\n';
  }

  alert(msg);
}


function loadProducts() {
  var products = getProducts();
  displayProducts(products);
}

function downloadProducts() {
  var products = getProducts();

  var contents = products.map(function(p){
    return [
      p.code,
      p.name,
      p.price,
      p.quantity,
      (p.cost || 0) // ✅ ahora incluye costo
    ].join(',');
  }).join('\n');

  var blob = new Blob([contents], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);

  var a = document.createElement('a');
  a.href = url;
  a.download = 'productos.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
/**********************
 * LIMPIEZAS
 **********************/
function getSales() {
  // Compatibilidad: si existen "ventas", las migramos
  var old = JSON.parse(localStorage.getItem('ventas')) || [];
  var current = JSON.parse(localStorage.getItem('sales')) || [];

  if (old.length && current.length === 0) {
    localStorage.setItem('sales', JSON.stringify(old));
    localStorage.removeItem('ventas');
    return old;
  }

  return current;
}

function saveSales(sales) {
  localStorage.setItem('sales', JSON.stringify(sales));
}

// Verificar stock bajo
function checkStock(product) {
  if (product.quantity < 5) {
    alert('Quedan solo ' + product.quantity + ' unidades de ' + product.name + '.');
  }
}

function limpiarTotalVendido() {
  localStorage.removeItem('totalVendido');
  localStorage.removeItem('sales'); // 🔥 corregido  localStorage.removeItem('openingCash');
  localStorage.setItem('openingCashSet', 'false');

  var products = getProducts();
  products.forEach(function(product){ product.sold = 0; });
  saveProducts(products);

  displayProducts();
  var ta = document.getElementById('sales-summary');
  if (ta) ta.value = '';
  var oc = document.getElementById('opening-cash');
  if (oc) oc.disabled = false;

  alert('Turno reiniciado. Todo el historial fue limpiado.');
  if (typeof resetCliente === 'function') resetCliente();
}

function resetDay() {
  localStorage.removeItem('sales');
  localStorage.removeItem('openingCash');
  localStorage.removeItem('openingCashSet');
  localStorage.removeItem('totalVendido');

  var products = getProducts();
  products.forEach(function(p){ p.sold = 0; });
  saveProducts(products);

  var ta = document.getElementById('sales-summary');
  if (ta) ta.value = '';
  var oc = document.getElementById('opening-cash');
  if (oc) oc.disabled = false;

  displayProducts();

  if (typeof resetCliente === 'function') {
    resetCliente();
  }

  alert('Caja, ventas y arqueo limpiados exitosamente.');
}

/*********** COMPAT: restaurar consultarTotalVendido() ***********/
function consultarTotalVendido() {
  showSalesSummary();
  var ventasModal = document.getElementById('ventas-modal');
  if (ventasModal) ventasModal.style.display = 'block';
}
document.addEventListener('click', function(e){
  if (e.target && e.target.matches('.close')) {
    var ventasModal = document.getElementById('ventas-modal');
    if (ventasModal) ventasModal.style.display = 'none';
  }
});


/**********************
 * BOTÓN FLOTANTE WHATSAPP
 **********************/
(function(){
  const btn = document.createElement('a');

  btn.href = 'https://wa.me/542617048835?text=Hola%20tengo%20una%20consulta%20del%20POS';
  btn.target = '_blank';
  btn.innerHTML = '💬';

  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    background: '#25D366',
    color: '#fff',
    fontSize: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
    zIndex: '9999',
    textDecoration: 'none'
  });

  document.addEventListener('DOMContentLoaded', function(){
    document.body.appendChild(btn);
  });
})();
// ====== AUTOFOCUS ESCÁNER ======
function focusScanner() {
  const scanInput = document.getElementById("scan-code");
  if (scanInput) scanInput.focus();
}

// cada vez que carga
window.addEventListener("load", focusScanner);

// después de cada acción importante
// ====== AUTOFOCUS INTELIGENTE ======
function focusScanner() {
  const scanInput = document.getElementById("scan-code");
  if (scanInput) scanInput.focus();
}

// SOLO cuando carga la página
window.addEventListener("load", focusScanner);

// SOLO después de escanear
document.getElementById("scan-code")?.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    scanProduct();
    setTimeout(focusScanner, 100);
  }
});
// ====== ENTER PARA ESCANEAR ======
document.getElementById("scan-code")?.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    scanProduct();
    setTimeout(focusScanner, 100);
  }
});

// ====== SONIDO (CAJA REGISTRADORA SIMPLE) ======
function playBeep() {
  const audio = new Audio("https://www.soundjay.com/buttons/sounds/button-16.mp3");
  audio.volume = 0.3;
  audio.play();
}

// enganchar al agregar producto
const originalScan = window.scanProduct;
window.scanProduct = function() {
  originalScan();
  playBeep();
  scrollCart();
};

// ====== AUTO SCROLL CARRITO ======
function scrollCart() {
  const cart = document.getElementById("cart");
  cart.scrollTop = cart.scrollHeight;
}

// ====== BUSCADOR INVENTARIO EN VIVO ======
const searchInput = document.createElement("input");
searchInput.placeholder = "Buscar en inventario...";
searchInput.style.marginBottom = "10px";

const productList = document.getElementById("product-list");
if (productList) {
  productList.prepend(searchInput);
}

searchInput.addEventListener("input", function() {
  const value = this.value.toLowerCase();
  const items = document.querySelectorAll("#products li");

  items.forEach(li => {
    const text = li.innerText.toLowerCase();
    li.style.display = text.includes(value) ? "grid" : "none";
  });
});
document.getElementById('search-code').addEventListener('input', function() {
  var value = this.value.trim().toLowerCase();
  searchProductLive(value);
});
