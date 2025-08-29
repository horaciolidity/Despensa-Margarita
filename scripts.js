/**********************
 * CONFIG
 **********************/
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

function searchProduct() {
  var code = document.getElementById('search-code').value.trim();
  var product = getProducts().find(p => p.code === code);

  var resultDiv = document.getElementById('product-result');
  resultDiv.innerHTML = '';

  if (product) {
    var productSafe = withValidity(product);
    resultDiv.innerHTML = ''
      + '<p>Nombre: ' + productSafe.name + '</p>'
      + '<p>Precio: $' + fmtMoney(productSafe.price) + '</p>'
      + '<p>Cantidad: ' + productSafe.quantity + '</p>'
      + (productSafe._invalid
          ? '<p style="color:#c00;font-weight:bold;">⚠ Corregir precios: ' + productSafe._invalid_reasons.join(' | ') + '</p>'
          : '')
      + '<button onclick="deleteProduct(\'' + productSafe.code + '\')">Eliminar</button>'
      + '<button onclick="editProduct(\'' + productSafe.code + '\')">Editar</button>';
  } else {
    resultDiv.innerHTML = '<p>Producto no encontrado</p>';
  }
}

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
    if (parts.length !== 4) {
      console.error('Formato de producto inválido:', line);
      return null;
    }
    var code = parts[0], name = parts[1], price = parts[2], quantity = parts[3];
    var obj = {
      code: (code || '').trim(),
      name: (name || '').trim(),
      price: parseFloat((price || '').trim()),
      quantity: parseFloat((quantity || '').trim()),
      cost: 0,          // default si import no trae costo
      unit: '',         // default
      isBulk: false     // default
    };
    return withValidity(obj);
  }).filter(function(p){ return !!p; });
  return products;
}

function saveProductsToLocalStorage(products) {
  var existingProducts = getProducts();
  var updatedProducts = existingProducts.concat(products);
  saveProducts(updatedProducts);
}

function loadProducts() {
  var products = getProducts();
  displayProducts(products);
}

function downloadProducts() {
  var products = getProducts();
  var contents = products.map(function(p){
    return p.code + ', ' + p.name + ', ' + p.price + ', ' + p.quantity;
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
function getVentas() {
  return JSON.parse(localStorage.getItem('ventas')) || [];
}
function saveVentas(ventas) {
  localStorage.setItem('ventas', JSON.stringify(ventas));
}

// Verificar stock bajo
function checkStock(product) {
  if (product.quantity < 5) {
    alert('Quedan solo ' + product.quantity + ' unidades de ' + product.name + '.');
  }
}

function limpiarTotalVendido() {
  localStorage.removeItem('totalVendido');
  localStorage.removeItem('ventas');
  localStorage.removeItem('openingCash');
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
