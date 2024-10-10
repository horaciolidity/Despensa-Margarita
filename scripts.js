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

// Modifica la función addProduct para incluir cantidad
function addProduct() {
    const code = document.getElementById('product-code').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const price = document.getElementById('product-price').value.trim();
    const quantity = parseInt(document.getElementById('product-quantity').value.trim()); // Agregar cantidad

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

// Modifica la función displayProducts para mostrar la cantidad
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

// Modifica el evento para añadir productos al carrito
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


// Modifica la función que muestra el carrito para que incluya la lógica de venta
function addToCart(product) {
    const cartList = document.getElementById('cart');
    const li = document.createElement('li');
    li.innerHTML = `
        <span>${product.code} - ${product.name} - $${product.price.toFixed(2)}</span>
    `;
    cartList.appendChild(li);
}

function updateTotalPrice() {
    const cartItems = document.querySelectorAll('#cart li');
    let total = 0;
    cartItems.forEach(item => {
        const price = parseFloat(item.textContent.split('$')[1]);
        total += price;
    });
    document.getElementById('total-price').textContent = total.toFixed(2);
}

function checkout() {
    const total = parseFloat(document.getElementById('total-price').textContent);
    let totalVendido = parseFloat(localStorage.getItem('totalVendido')) || 0;
    totalVendido += total;
    localStorage.setItem('totalVendido', totalVendido.toFixed(2));

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
            product.quantity--;
            saveProducts(products);
            updateTotalPrice();
            checkStock(product);
            document.getElementById('scan-code').value = '';
        } else {
            alert('No hay suficiente stock de este producto.');
        }
    } else {
        alert('Producto no encontrado');
    }
}
// Función para comprobar el stock y mostrar alertas
function checkStock(product) {
    if (product.quantity <= 5) { // Alerta cuando hay 5 o menos
        alert(`¡Alerta! El producto ${product.name} está por acabarse.`);
    }
}
