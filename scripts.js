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
 * INIT
 **********************/
document.addEventListener('DOMContentLoaded', () => {
  displayProducts();
  updateTotalPrice();

  const input = document.getElementById('opening-cash');
  const yaInicioCaja = localStorage.getItem('openingCashSet') === 'true';
  if (yaInicioCaja && input) input.disabled = true;

  // Animación de carga (si existe)
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  }, 4000);

  // Inicializar listeners del modal de vuelto si existe en el HTML
  initCashModalOnce();
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
  const code = document.getElementById('product-code').value.trim();
  const name = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value.trim());
  const quantity = parseFloat(document.getElementById('product-quantity').value.trim());
  const cost = parseFloat(document.getElementById('product-cost').value.trim());
  const unit = document.getElementById('product-unit').value;
  const isBulk = (unit === 'kg' || unit === 'litro');

  if (code && name && price > 0 && quantity > 0) {
    const products = getProducts();
    const i = products.findIndex(p => p.code === code);

    const newProduct = { code, name, price, quantity, unit, isBulk, cost };

    if (i !== -1) {
      products[i].quantity = Number(products[i].quantity) + Number(quantity);
      products[i].unit   = products[i].unit ?? unit;
      products[i].isBulk = products[i].isBulk ?? isBulk;
      products[i].price  = price;
      products[i].cost   = isNaN(cost) ? (products[i].cost || 0) : cost;
    } else {
      products.push(newProduct);
    }

    saveProducts(products);
    displayProducts();
    updateTotalPrice();
    if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();

    clearForm();
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
  const code = document.getElementById('search-code').value.trim();
  const product = getProducts().find(p => p.code === code);

  const resultDiv = document.getElementById('product-result');
  resultDiv.innerHTML = '';

  if (product) {
    resultDiv.innerHTML = `
      <p>Nombre: ${product.name}</p>
      <p>Precio: $${fmtMoney(product.price)}</p>
      <p>Cantidad: ${product.quantity}</p>
      <button onclick="deleteProduct('${product.code}')">Eliminar</button>
      <button onclick="editProduct('${product.code}')">Editar</button>
    `;
  } else {
    resultDiv.innerHTML = '<p>Producto no encontrado</p>';
  }
}

function displayProducts() {
  const products = getProducts();
  const productsList = document.getElementById('products');
  if (!productsList) return;
  productsList.innerHTML = '';

  products.forEach(product => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${product.code} - ${product.name} - $${fmtMoney(product.price)} - Cantidad: ${product.quantity}</span>
      <button onclick="deleteProduct('${product.code}')">Eliminar</button>
      <button onclick="editProduct('${product.code}')">Editar</button>
      <button onclick="updateProduct('${product.code}')">Actualizar</button>
    `;
    productsList.appendChild(li);
  });
}

function updateProduct(code) {
  const products = getProducts();
  const product = products.find(p => p.code === code);
  const newQuantity = prompt('Ingrese la nueva cantidad para el producto:', product.quantity);
  if (newQuantity !== null) {
    const quantityNumber = parseFloat(newQuantity);
    if (!isNaN(quantityNumber) && quantityNumber >= 0) {
      product.quantity = quantityNumber;
      saveProducts(products);
      displayProducts();
      updateTotalPrice();
      if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
      alert(`Cantidad de ${product.name} actualizada a ${quantityNumber}.`);
    } else {
      alert('Por favor, ingrese una cantidad válida.');
    }
  }
}

function deleteProduct(code) {
  let products = getProducts();
  products = products.filter(p => p.code !== code);
  saveProducts(products);
  displayProducts();
}

function editProduct(code) {
  const product = getProducts().find(p => p.code === code);
  if (product) {
    document.getElementById('product-code').value = product.code;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-price').value = product.price;
    deleteProduct(code);
  }
}

/**********************
 * CARRITO
 **********************/
function addToCart(product) {
  const cartList = document.getElementById('cart');
  const existingItem = Array.from(cartList.children).find(item => item.dataset.code === product.code);

  let quantity = 1;
  if (product.isBulk) {
    const input = prompt(`Ingrese la cantidad en ${product.unit} para "${product.name}" (ej: 0.300):`);
    const parsed = parseFloat(input);
    if (isNaN(parsed) || parsed <= 0) {
      alert("Cantidad inválida");
      return;
    }
    quantity = parsed;
  }

  if (existingItem) {
    // sumamos cantidad y recalculamos precio total
    const qEl = existingItem.querySelector('.quantity');
    const pEl = existingItem.querySelector('.price');
    const currentQty = parseFloat(qEl.textContent);
    const newQty = currentQty + quantity;
    qEl.textContent = product.isBulk ? fmtQty(newQty) : String(newQty);
    pEl.textContent = fmtMoney(newQty * product.price);
  } else {
    const li = document.createElement('li');
    li.dataset.code = product.code;
    li.dataset.unit = product.unit || '';
    li.dataset.isBulk = product.isBulk ? '1' : '0';

    const shownQty = product.isBulk ? fmtQty(quantity) : String(quantity);
    const lineTotal = quantity * product.price;

    li.innerHTML = `
      <span>
        ${product.name} - <span class="quantity">${shownQty}</span> ${product.isBulk ? product.unit : ''} -
        $<span class="price">${fmtMoney(lineTotal)}</span>
      </span>
      <button onclick="addQuantity('${product.code}')">+</button>
      <button onclick="removeQuantity('${product.code}')">-</button>
      <button onclick="editCartItemPrice('${product.code}')">Editar $</button>
    `;
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
  const cartList = document.getElementById('cart');
  const existingItem = Array.from(cartList.children).find(item => item.dataset.code === code);
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
  const codeInp = document.getElementById('scan-code');
  const code = codeInp.value.trim();
  const products = getProducts();
  const product = products.find(p => p.code === code);

  if (!product) {
    alert('Producto no encontrado');
    return;
  }

  const cartList = document.getElementById('cart');
  const existingItem = Array.from(cartList.children).find(item => item.dataset.code === product.code);

  if (existingItem) {
    const qEl = existingItem.querySelector('.quantity');
    const pEl = existingItem.querySelector('.price');
    const currentQty = parseFloat(qEl.textContent);

    if (product.isBulk) {
      const add = prompt(`Cantidad adicional en ${product.unit} para "${product.name}" (ej: 0.300):`);
      const parsed = parseFloat(add);
      if (isNaN(parsed) || parsed <= 0) return;
      const newQty = currentQty + parsed;
      qEl.textContent = fmtQty(newQty);
      pEl.textContent = fmtMoney(newQty * product.price);
    } else {
      const newQty = currentQty + 1;
      qEl.textContent = String(newQty);
      pEl.textContent = fmtMoney(newQty * product.price);
    }
    updateTotalPrice();
    if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
    codeInp.value = '';
    checkStock(product);
    return;
  }

  // si no existía: agregar normalmente
  addToCart(product);
  codeInp.value = '';
  updateTotalPrice();
  checkStock(product);
}

/**********************
 * EDITAR PRECIO (RECALC PESABLES)
 **********************/
function editCartItemPrice(code) {
  const cartList = document.getElementById('cart');
  const item = Array.from(cartList.children).find(item => item.dataset.code === code);
  if (!item) return;

  const currentPrice = parseFloat(item.querySelector('.price').textContent);
  const newPrice = parseFloat(prompt("Ingrese el nuevo precio total para este producto:", fmtMoney(currentPrice)));

  if (isNaN(newPrice) || newPrice <= 0) {
    alert("Precio inválido.");
    return;
  }

  const product = getByCode(code);
  if (!product) return;

  if (product.isBulk) {
    const newQty = newPrice / product.price;
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
  const cartList = document.getElementById('cart');
  const item = Array.from(cartList.children).find(i => i.dataset.code === code);
  const product = getByCode(code);
  if (!item || !product) return;

  const qEl = item.querySelector('.quantity');
  const pEl = item.querySelector('.price');

  const step = product.isBulk ? BULK_STEP : 1;
  let currentQty = parseFloat(qEl.textContent);
  let newQty = currentQty - step;

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
  const cartList = document.getElementById('cart');
  const item = Array.from(cartList.children).find(i => i.dataset.code === code);
  const product = getByCode(code);
  if (!item || !product) return;

  const qEl = item.querySelector('.quantity');
  const pEl = item.querySelector('.price');

  const step = product.isBulk ? BULK_STEP : 1;
  let currentQty = parseFloat(qEl.textContent);
  let newQty = currentQty + step;

  qEl.textContent = product.isBulk ? fmtQty(newQty) : String(Math.round(newQty));
  pEl.textContent = fmtMoney(newQty * product.price);

  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();
}

/**********************
 * TOTAL
 **********************/
function updateTotalPrice() {
  const cartList = document.getElementById('cart');
  let total = 0;

  Array.from(cartList.children).forEach(item => {
    const priceElement = item.querySelector('.price');
    if (priceElement) {
      const price = parseFloat(priceElement.textContent);
      total += (isNaN(price) ? 0 : price);
    }
  });

  const totalPriceElement = document.getElementById('total-price');
  if (totalPriceElement) totalPriceElement.textContent = fmtMoney(total);
}

/**********************
 * CHECKOUT (opcional) — Corregido para decimales
 **********************/
function checkout() {
  const total = parseFloat(document.getElementById('total-price').textContent);
  let totalVendido = parseFloat(localStorage.getItem('totalVendido')) || 0;
  totalVendido += total;
  localStorage.setItem('totalVendido', fmtMoney(totalVendido));

  const cartItems = document.querySelectorAll('#cart li');
  const products = getProducts();

  const quantitiesToDeduct = {};
  let hasStockIssue = false;

  cartItems.forEach(item => {
    const productCode = item.dataset.code;
    const quantity = parseFloat(item.querySelector('.quantity').textContent);
    const product = products.find(p => p.code === productCode);

    if (product) {
      if (product.quantity < quantity) {
        alert(`No hay suficiente stock de ${product.name}. Solo quedan ${product.quantity} unidades.`);
        hasStockIssue = true;
        return;
      }
      quantitiesToDeduct[productCode] = quantity;
    }
  });

  if (hasStockIssue) return;

  Object.entries(quantitiesToDeduct).forEach(([code, quantity]) => {
    const product = products.find(p => p.code === code);
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
  const input = document.getElementById('opening-cash');
  const value = parseFloat(input.value.trim());
  if (!isNaN(value) && value >= 0) {
    localStorage.setItem('openingCash', fmtMoney(value));
    localStorage.setItem('openingCashSet', 'true');
    input.disabled = true;
    alert("Caja iniciada con $" + fmtMoney(value));
  } else {
    alert("Ingrese un monto válido");
  }
}
function getOpeningCash() {
  return parseFloat(localStorage.getItem('openingCash')) || 0;
}

/**********************
 * VENTAS / FINALIZAR
 **********************/
function saveSale(cart, paymentMethod) {
  const sales = JSON.parse(localStorage.getItem('sales')) || [];
  const timestamp = new Date().toLocaleString();
  sales.push({ cart, paymentMethod, timestamp });
  localStorage.setItem('sales', JSON.stringify(sales));
}

function finalizeSale(method) {
  const cartItems = document.querySelectorAll('#cart li');
  if (cartItems.length === 0) {
    alert('El carrito está vacío');
    return;
  }

  const products = getProducts();
  const cart = [];
  let hasStockIssue = false;

  cartItems.forEach(item => {
    const code = item.dataset.code;
    const quantity = parseFloat(item.querySelector('.quantity').textContent);
    const totalPrice = parseFloat(item.querySelector('.price').textContent);
    const product = products.find(p => p.code === code);

    if (!product) return;

    if (product.quantity < quantity) {
      alert(`No hay suficiente stock de ${product.name}`);
      hasStockIssue = true;
      return;
    }

    const unitPrice = totalPrice / quantity;
    cart.push({
      code,
      name: product.name,
      price: unitPrice,
      quantity,
      cost: product.cost || 0
    });
  });

  if (hasStockIssue) return;

  const totalVenta = cart.reduce((acc, p) => acc + (p.price * p.quantity), 0);

  const m = (method || '').toString().toLowerCase();
  const methodLabel = m.startsWith('efect') ? 'Efectivo'
                    : m.startsWith('transf') ? 'Transferido'
                    : method;

  let pagoCon = null;
  let vuelto = null;

  if (methodLabel === 'Efectivo') {
    const input = prompt(`Total $${fmtMoney(totalVenta)}.\n¿Con cuánto paga?`, fmtMoney(totalVenta));
    const monto = parseFloat(input);
    if (isNaN(monto) || monto <= 0) { alert('Monto inválido.'); return; }
    if (monto < totalVenta) { alert(`Monto insuficiente. Faltan $${fmtMoney(totalVenta - monto)}.`); return; }
    pagoCon = Number(fmtMoney(monto));
    vuelto = Number(fmtMoney(monto - totalVenta));
  }

  const novedades = prompt("¿Desea agregar alguna novedad sobre esta venta? (opcional)") || "";
  const sales = JSON.parse(localStorage.getItem('sales')) || [];
  const timestamp = new Date().toLocaleString();
  sales.push({
    cart,
    paymentMethod: methodLabel,
    timestamp,
    novedades,
    ...(methodLabel === 'Efectivo' ? { pagoCon, vuelto } : {})
  });
  localStorage.setItem('sales', JSON.stringify(sales));

  let totalVendido = parseFloat(localStorage.getItem('totalVendido')) || 0;
  totalVendido += totalVenta;
  localStorage.setItem('totalVendido', fmtMoney(totalVendido));

  // Descontar stock y sumar vendidos
  cart.forEach(line => {
    const p = products.find(pp => pp.code === line.code);
    if (p) {
      p.quantity = Number((p.quantity - line.quantity).toFixed(QTY_DEC));
      p.sold = Number(((p.sold || 0) + line.quantity).toFixed(QTY_DEC));
    }
  });
  saveProducts(products);

  // Reset UI
  document.getElementById('cart').innerHTML = '';
  document.getElementById('total-price').textContent = '0.00';
  displayProducts();
  updateTotalPrice();
  if (typeof enviarCarritoAlCliente === 'function') enviarCarritoAlCliente();

  const canal = new BroadcastChannel('pos_channel');
  canal.postMessage({ tipo: 'despedida' });

  // 👉 Mostrar SOLO el modal para efectivo (sin alerts extra)
  if (methodLabel === 'Efectivo') {
    showCashChangeModal({ total: totalVenta, pagoCon, vuelto });
  } else {
    // Si querés conservar un aviso para transferencias, dejá este alert o quitálo.
    // alert('Venta registrada con pago: ' + methodLabel);
  }
}

/**********************
 * MODAL DE VUELTO (JS)
 * — Requiere el HTML del modal en index.html —
 **********************/
function showCashChangeModal({ total, pagoCon, vuelto }) {
  const root = document.getElementById('cash-change-modal');

  // Si no está el HTML del modal, usamos fallback
  if (!root) {
    alert(`Venta EFECTIVO\nTotal: $${fmtMoney(total)}\nPagó con: $${fmtMoney(pagoCon)}\nVuelto: $${fmtMoney(vuelto)}`);
    return;
  }

  root.querySelector('#ccm-total').textContent   = `$${fmtMoney(total)}`;
  root.querySelector('#ccm-pagocon').textContent = `$${fmtMoney(pagoCon)}`;
  root.querySelector('#ccm-vuelto').textContent  = `$${fmtMoney(vuelto)}`;
  root.querySelector('#ccm-vuelto-2').textContent = `$${fmtMoney(vuelto)}`;

  root.classList.add('show');
  root.setAttribute('aria-hidden', 'false');

  setTimeout(() => document.getElementById('ccm-ok')?.focus(), 30);
}

function hideCashChangeModal() {
  const root = document.getElementById('cash-change-modal');
  if (!root) return;
  root.classList.remove('show');
  root.setAttribute('aria-hidden', 'true');
}

function initCashModalOnce() {
  const root = document.getElementById('cash-change-modal');
  if (!root || root.dataset.bound === '1') return;

  root.querySelector('.cash-modal-close')?.addEventListener('click', hideCashChangeModal);
  document.getElementById('ccm-ok')?.addEventListener('click', hideCashChangeModal);
  root.addEventListener('click', (e) => { if (e.target === root) hideCashChangeModal(); });
  document.getElementById('ccm-print')?.addEventListener('click', () => { window.print(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('show')) hideCashChangeModal();
  });

  root.dataset.bound = '1';
}

/**********************
 * ARQUEO
 **********************/
function showSalesSummary() {
  const sales = JSON.parse(localStorage.getItem('sales')) || [];
  let summary = '';
  let totalCash = 0;
  let totalTransfer = 0;
  let totalCostos = 0;
  let totalGanancia = 0;

  sales.forEach((sale, index) => {
    summary += `🧾 Venta #${index + 1} - ${sale.timestamp} - Método: ${sale.paymentMethod}\n`;

    sale.cart.forEach(p => {
      const quantity = parseFloat(p.quantity);
      const price = parseFloat(p.price);
      const cost = parseFloat(p.cost || 0);
      const subtotal = price * quantity;
      const costoTotal = cost * quantity;
      const ganancia = subtotal - costoTotal;

      summary += `  🛒 ${fmtQty(quantity)} x ${p.name} | Precio u.: $${fmtMoney(price)} | Costo u.: $${fmtMoney(cost)} | Subtotal: $${fmtMoney(subtotal)} | Ganancia: $${fmtMoney(ganancia)}\n`;

      totalCostos += costoTotal;
    });

    const totalVenta = sale.cart.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const totalCosto = sale.cart.reduce((acc, p) => acc + ((p.cost || 0) * p.quantity), 0);
    const gananciaVenta = totalVenta - totalCosto;
    totalGanancia += gananciaVenta;

    if (sale.paymentMethod === 'Efectivo' && sale.pagoCon != null) {
      summary += `  💵 Pagó con: $${fmtMoney(sale.pagoCon)} — Vuelto: $${fmtMoney(sale.vuelto)}\n`;
    }

    if (sale.novedades && sale.novedades.trim() !== "") {
      summary += `  📝 Novedades: ${sale.novedades}\n`;
    }

    summary += `  💲 Total venta: $${fmtMoney(totalVenta)}\n`;
    summary += `  📦 Costo total: $${fmtMoney(totalCosto)}\n`;
    summary += `  📈 Ganancia: $${fmtMoney(gananciaVenta)}\n\n`;

    if (sale.paymentMethod.toLowerCase().includes("efectivo")) totalCash += totalVenta;
    if (sale.paymentMethod.toLowerCase().includes("transfer")) totalTransfer += totalVenta;
  });

  summary += `\n🔓 Apertura de caja: $${fmtMoney(getOpeningCash())}`;
  summary += `\n💰 Total efectivo: $${fmtMoney(totalCash)}`;
  summary += `\n💳 Total transferencia: $${fmtMoney(totalTransfer)}`;
  summary += `\n📦 Costo total de productos vendidos: $${fmtMoney(totalCostos)}`;
  summary += `\n📈 Ganancia total: $${fmtMoney(totalGanancia)}`;
  summary += `\n💵 Total vendido: $${fmtMoney(totalCash + totalTransfer)}`;

  const textarea = document.getElementById('sales-summary');
  if (textarea) textarea.value = summary;
}

function payWithTransfer() {
  finalizeSale('Transferido');
}
function downloadSummary() {
  const text = document.getElementById('sales-summary').value;
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'arqueo_caja.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**********************
 * IMPORT/EXPORT PRODUCTOS
 **********************/
(function(){
  var fileInputEl = document.getElementById('fileInput');
  if (fileInputEl) {
    fileInputEl.addEventListener('change', handleFileSelect, false);
  }
})();

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const contents = e.target.result;
      processFileContents(contents);
    };
    reader.readAsText(file);
  }
}

function processFileContents(contents) {
  const products = parseProducts(contents);
  saveProductsToLocalStorage(products);
  displayProducts();
}

function parseProducts(contents) {
  const lines = contents.split('\n');
  const products = lines.map(line => {
    const parts = line.split(',');
    if (parts.length !== 4) {
      console.error('Formato de producto inválido:', line);
      return null;
    }
    const [code, name, price, quantity] = parts;
    return {
      code: code.trim(),
      name: name.trim(),
      price: parseFloat(price.trim()),
      quantity: parseFloat(quantity.trim())
    };
  }).filter(Boolean);
  return products;
}

function saveProductsToLocalStorage(products) {
  const existingProducts = getProducts();
  const updatedProducts = existingProducts.concat(products);
  saveProducts(updatedProducts);
}

function loadProducts() {
  const products = getProducts();
  displayProducts(products);
}

function downloadProducts() {
  const products = getProducts();
  const contents = products.map(p => `${p.code}, ${p.name}, ${p.price}, ${p.quantity}`).join('\n');
  const blob = new Blob([contents], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
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
    alert(`Quedan solo ${product.quantity} unidades de ${product.name}.`);
  }
}

function limpiarTotalVendido() {
  localStorage.removeItem('totalVendido');
  localStorage.removeItem('ventas');
  localStorage.removeItem('openingCash');
  localStorage.setItem('openingCashSet', 'false');

  const products = getProducts();
  products.forEach(product => { product.sold = 0; });
  saveProducts(products);

  displayProducts();
  const ta = document.getElementById("sales-summary");
  if (ta) ta.value = '';
  const oc = document.getElementById("opening-cash");
  if (oc) oc.disabled = false;

  alert('Turno reiniciado. Todo el historial fue limpiado.');
  if (typeof resetCliente === 'function') resetCliente();
}

function resetDay() {
  localStorage.removeItem('sales');
  localStorage.removeItem('openingCash');
  localStorage.removeItem('openingCashSet');
  localStorage.removeItem('totalVendido');

  const products = getProducts();
  products.forEach(p => p.sold = 0);
  saveProducts(products);

  const ta = document.getElementById("sales-summary");
  if (ta) ta.value = "";
  const oc = document.getElementById("opening-cash");
  if (oc) oc.disabled = false;

  displayProducts();

  if (typeof resetCliente === 'function') {
    resetCliente();
  }

  alert("Caja, ventas y arqueo limpiados exitosamente.");
}

/*********** COMPAT: restaurar consultarTotalVendido() ***********/
function consultarTotalVendido() {
  showSalesSummary();
  const ventasModal = document.getElementById('ventas-modal');
  if (ventasModal) ventasModal.style.display = 'block';
}
document.addEventListener('click', (e) => {
  if (e.target.matches('.close')) {
    const ventasModal = document.getElementById('ventas-modal');
    if (ventasModal) ventasModal.style.display = 'none';
  }
});
      const contents = e.target.result;
      processFileContents(contents);
    };
    reader.readAsText(file);
  }
}

function processFileContents(contents) {
  const products = parseProducts(contents);
  saveProductsToLocalStorage(products);
  displayProducts();
}

function parseProducts(contents) {
  const lines = contents.split('\n');
  const products = lines.map(line => {
    const parts = line.split(',');
    if (parts.length !== 4) {
      console.error('Formato de producto inválido:', line);
      return null;
    }
    const [code, name, price, quantity] = parts;
    return {
      code: code.trim(),
      name: name.trim(),
      price: parseFloat(price.trim()),
      quantity: parseFloat(quantity.trim())
    };
  }).filter(Boolean);
  return products;
}

function saveProductsToLocalStorage(products) {
  const existingProducts = getProducts();
  const updatedProducts = existingProducts.concat(products);
  saveProducts(updatedProducts);
}

function loadProducts() {
  const products = getProducts();
  displayProducts(products);
}

function downloadProducts() {
  const products = getProducts();
  const contents = products.map(p => `${p.code}, ${p.name}, ${p.price}, ${p.quantity}`).join('\n');
  const blob = new Blob([contents], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
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
    alert(`Quedan solo ${product.quantity} unidades de ${product.name}.`);
  }
}

function limpiarTotalVendido() {
  localStorage.removeItem('totalVendido');
  localStorage.removeItem('ventas');
  localStorage.removeItem('openingCash');
  localStorage.setItem('openingCashSet', 'false');

  const products = getProducts();
  products.forEach(product => { product.sold = 0; });
  saveProducts(products);

  displayProducts();
  const ta = document.getElementById("sales-summary");
  if (ta) ta.value = '';
  const oc = document.getElementById("opening-cash");
  if (oc) oc.disabled = false;

  alert('Turno reiniciado. Todo el historial fue limpiado.');
  if (typeof resetCliente === 'function') resetCliente();
}

function resetDay() {
  localStorage.removeItem('sales');
  localStorage.removeItem('openingCash');
  localStorage.removeItem('openingCashSet');
  localStorage.removeItem('totalVendido');

  const products = getProducts();
  products.forEach(p => p.sold = 0);
  saveProducts(products);

  const ta = document.getElementById("sales-summary");
  if (ta) ta.value = "";
  const oc = document.getElementById("opening-cash");
  if (oc) oc.disabled = false;

  displayProducts();

  if (typeof resetCliente === 'function') {
    resetCliente();
  }

  alert("Caja, ventas y arqueo limpiados exitosamente.");
}
function consultarTotalVendido() {
  showSalesSummary();
}

/*********** COMPAT: restaurar consultarTotalVendido() ***********/
function consultarTotalVendido() {
  // Reusa el cálculo actual
  showSalesSummary();

  // Si usás modal, abrilo (compat con tu HTML original)
  const ventasModal = document.getElementById('ventas-modal');
  if (ventasModal) ventasModal.style.display = 'block';
}

/* Botón cerrar modal: hacerlo robusto por si el botón .close aún no existe al cargar */
document.addEventListener('click', (e) => {
  if (e.target.matches('.close')) {
    const ventasModal = document.getElementById('ventas-modal');
    if (ventasModal) ventasModal.style.display = 'none';
  }
});

function showCashChangeModal({ total, pagoCon, vuelto }) {
  var root = document.getElementById('cash-change-modal');

  // Si no está el HTML del modal, usamos fallback
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

  // focus en OK si existe
  setTimeout(function () {
    var okBtn = document.getElementById('ccm-ok');
    if (okBtn) okBtn.focus();
  }, 30);
}

function hideCashChangeModal() {
  const root = document.getElementById('cash-change-modal');
  if (!root) return;
  root.classList.remove('show');
  root.setAttribute('aria-hidden', 'true');
}

function initCashModalOnce() {
  var root = document.getElementById('cash-change-modal');
  if (!root || root.dataset.bound === '1') return;

  var btnClose = root.querySelector('.cash-modal-close');
  if (btnClose) {
    btnClose.addEventListener('click', hideCashChangeModal);
  }

  var okBtn = document.getElementById('ccm-ok');
  if (okBtn) {
    okBtn.addEventListener('click', hideCashChangeModal);
  }

  root.addEventListener('click', function (e) {
    if (e.target === root) hideCashChangeModal();
  });

  var printBtn = document.getElementById('ccm-print');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      window.print();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('show')) {
      hideCashChangeModal();
    }
  });

  root.dataset.bound = '1';
}
