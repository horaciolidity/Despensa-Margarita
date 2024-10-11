document.addEventListener('DOMContentLoaded', () => {
    displayProducts();
    updateTotalPrice();
});

function getProducts() {
    return JSON.parse(localStorage.getItem('products')) || [];
}

function saveProducts(products) {
    localStorage.setItem('products', JSON.stringify(products));
}


function addProduct() {
    const code = document.getElementById('product-code').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const price = document.getElementById('product-price').value.trim();
    const quantity = parseInt(document.getElementById('product-quantity').value.trim());

    if (code && name && price && quantity > 0) {
        const products = getProducts();
        const existingProductIndex = products.findIndex(p => p.code === code);

        if (existingProductIndex !== -1) {
            // Si el producto ya existe, solo actualizamos la cantidad
            products[existingProductIndex].quantity += quantity;
        } else {
            // Si es un producto nuevo, lo añadimos
            products.push({ code, name, price: parseFloat(price), quantity });
        }

        saveProducts(products);
        displayProducts();
        clearForm();
    } else {
        alert('Por favor, complete todos los campos correctamente');
    }
}



function clearForm() {
    document.getElementById('product-code').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-quantity').value = ''; // Limpiar el campo de cantidad
}

function searchProduct() {
    const code = document.getElementById('search-code').value.trim();
    const products = getProducts();
    const product = products.find(p => p.code === code);

    const resultDiv = document.getElementById('product-result');
    resultDiv.innerHTML = '';

    if (product) {
        resultDiv.innerHTML = `
            <p>Nombre: ${product.name}</p>
            <p>Precio: $${product.price.toFixed(2)}</p>
            <button onclick="deleteProduct('${product.code}')">Eliminar</button>
            <button onclick="editProduct('${product.code}')">Editar</button>
        `;
    } else {
        resultDiv.innerHTML = '<p>Producto no encontrado</p>';
    }
}

// Función para mostrar los productos
function displayProducts() {
    const products = getProducts();
    const productsList = document.getElementById('products');
    productsList.innerHTML = '';

    products.forEach(product => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${product.code} - ${product.name} - $${product.price.toFixed(2)} - Cantidad: ${product.quantity}</span>
            <button onclick="deleteProduct('${product.code}')">Eliminar</button>
            <button onclick="editProduct('${product.code}')">Editar</button>
        `;
        productsList.appendChild(li);
    });
}


function deleteProduct(code) {
    let products = getProducts();
    products = products.filter(p => p.code !== code);
    saveProducts(products);
    displayProducts();
}

function editProduct(code) {
    const products = getProducts();
    const product = products.find(p => p.code === code);

    if (product) {
        document.getElementById('product-code').value = product.code;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        deleteProduct(code);
    }
}

// Modificar la función scanProduct para manejar la adición al carrito
function scanProduct() {
    const code = document.getElementById('scan-code').value.trim();
    const products = getProducts();
    const product = products.find(p => p.code === code);

    if (product) {
        if (product.quantity > 0) {
            addToCart(product);
            product.quantity--;
            saveProducts(products); // Actualiza el inventario después de añadir al carrito
            updateTotalPrice();
            document.getElementById('scan-code').value = '';
            checkStock(product);
        } else {
            alert('No hay suficiente stock de este producto.');
        }
    } else {
        alert('Producto no encontrado');
    }
}

// Función para añadir productos al carrito
function addToCart(product) {
    const cartList = document.getElementById('cart');
    const existingItem = Array.from(cartList.children).find(item => item.dataset.code === product.code);

    if (existingItem) {
        // Si el producto ya existe en el carrito, solo incrementamos la cantidad
        const quantitySpan = existingItem.querySelector('.quantity');
        const newQuantity = parseInt(quantitySpan.textContent) + 1;
        quantitySpan.textContent = newQuantity; // Actualiza la cantidad en la interfaz
    } else {
        // Si es un producto nuevo en el carrito, añadimos un nuevo elemento
        const li = document.createElement('li');
        li.dataset.code = product.code; // Guardamos el código del producto en un atributo data
        li.innerHTML = `
            <span>${product.code} - ${product.name} - $${product.price.toFixed(2)} - Cantidad: <span class="quantity">1</span></span>
            <button onclick="addQuantity('${product.code}')">+</button> <!-- Botón para añadir más -->
        `;
        cartList.appendChild(li);
    }
}

// Función para aumentar la cantidad de un producto en el carrito
function addQuantity(code) {
    const cartList = document.getElementById('cart');
    const existingItem = Array.from(cartList.children).find(item => item.dataset.code === code);

    if (existingItem) {
        const quantitySpan = existingItem.querySelector('.quantity');
        const newQuantity = parseInt(quantitySpan.textContent) + 1; // Incrementa la cantidad
        quantitySpan.textContent = newQuantity; // Actualiza la cantidad en la interfaz
        updateTotalPrice(); // Actualiza el total
    }
}

// Función para actualizar el total del carrito
function updateTotalPrice() {
    const cartItems = document.querySelectorAll('#cart li');
    let total = 0;
    cartItems.forEach(item => {
        const price = parseFloat(item.textContent.split('$')[1].split('-')[0]); // Extraer precio
        const quantity = parseInt(item.querySelector('.quantity').textContent); // Extraer cantidad
        total += price * quantity; // Multiplicar precio por cantidad
    });
    document.getElementById('total-price').textContent = total.toFixed(2);
}

function checkout() {
    const total = parseFloat(document.getElementById('total-price').textContent);
    let totalVendido = parseFloat(localStorage.getItem('totalVendido')) || 0;
    totalVendido += total;
    localStorage.setItem('totalVendido', totalVendido.toFixed(2));

    const cartItems = document.querySelectorAll('#cart li');
    const products = getProducts();

    // Creamos un objeto para almacenar la cantidad total a restar por producto
    const quantitiesToDeduct = {};

    cartItems.forEach(item => {
        const productCode = item.textContent.split('-')[0].trim();
        const quantity = parseInt(item.querySelector('.quantity').textContent);

        // Comprobar si la cantidad vendida excede la cantidad disponible
        const product = products.find(p => p.code === productCode);
        if (product) {
            if (product.quantity < quantity) {
                alert(`No hay suficiente stock de ${product.name}. Solo quedan ${product.quantity} unidades.`);
                return; // Salimos de la función si no hay suficiente stock
            }
            // Si hay suficiente stock, almacenamos la cantidad a deducir
            quantitiesToDeduct[productCode] = quantity;
        }
    });

    // Si hemos salido de la función debido a un stock insuficiente, no procedemos con la venta
    if (Object.keys(quantitiesToDeduct).length === 0) {
        return;
    }

    // Actualizamos el inventario
    Object.entries(quantitiesToDeduct).forEach(([code, quantity]) => {
        const product = products.find(p => p.code === code);
        if (product) {
            product.quantity -= quantity; // Restar la cantidad vendida
        }
    });

    saveProducts(products); // Guardar el inventario actualizado en localStorage
    document.getElementById('cart').innerHTML = '';
    document.getElementById('total-price').textContent = '0.00';
    alert('Compra finalizada');
}



function consultarTotalVendido() {
    const totalVendido = localStorage.getItem('totalVendido');
    if (totalVendido) {
        alert(`Total Vendido: $${totalVendido}`);
    } else {
        alert('No hay ventas registradas.');
    }
}

function limpiarTotalVendido() {
    localStorage.removeItem('totalVendido');
    alert('Total Vendido limpiado para el nuevo turno.');
}

document.getElementById('fileInput').addEventListener('change', handleFileSelect, false);

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
        if (parts.length !== 3) {
            console.error('Invalid product format:', line);
            return null; // Omitir líneas mal formateadas
        }
        const [code, name, price] = parts;
        return {
            code: code.trim(),
            name: name.trim(),
            price: parseFloat(price.trim())
        };
    }).filter(product => product !== null); // Filtrar productos nulos
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
    const contents = products.map(p => `${p.code}, ${p.name}, ${p.price}`).join('\n');
    const blob = new Blob([contents], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
// Función para manejar la venta de un producto
function sellProduct() {
    const code = document.getElementById('scan-code').value.trim();
    const products = getProducts();
    const product = products.find(p => p.code === code);

    if (product) {
        if (product.quantity > 0) {
            product.quantity--; // Resta uno del inventario
            saveProducts(products); // Guarda el inventario actualizado
            updateTotalPrice(); // Actualiza el total
            checkStock(product); // Verifica el stock
            document.getElementById('scan-code').value = '';
        } else {
            alert('No hay suficiente stock de este producto.');
        }
    } else {
        alert('Producto no encontrado');
    }
}

// Función para verificar el stock y mostrar alertas
function checkStock(product) {
    if (product.quantity < 5) { // Por ejemplo, menos de 5 unidades
        alert(`Quedan solo ${product.quantity} unidades de ${product.name}.`);
    }
}
