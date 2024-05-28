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
    
    if (code && name && price) {
        const products = getProducts();
        products.push({ code, name, price: parseFloat(price) });
        saveProducts(products);
        displayProducts();
        clearForm();
    } else {
        alert('Por favor, complete todos los campos');
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

function displayProducts() {
    const products = getProducts();
    const productsList = document.getElementById('products');
    productsList.innerHTML = '';

    products.forEach(product => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${product.code} - ${product.name} - $${product.price.toFixed(2)}</span>
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

function scanProduct() {
    const code = document.getElementById('scan-code').value.trim();
    const products = getProducts();
    const product = products.find(p => p.code === code);

    if (product) {
        addToCart(product);
        updateTotalPrice();
        document.getElementById('scan-code').value = '';
    } else {
        alert('Producto no encontrado');
    }
}

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
    document.getElementById('cart').innerHTML = '';
    document.getElementById('total-price').textContent = '0.00';
    alert('Compra finalizada');
}


 const consultarButton = document.querySelector('.action-button:nth-child(1)');
    const limpiarButton = document.querySelector('.action-button:nth-child(2)');

    consultarButton.addEventListener('click', () => {
        // Lógica para consultar el total vendido
        const totalVendido = localStorage.getItem('totalVendido');
        if (totalVendido) {
            alert(`Total Vendido: $${totalVendido}`);
        } else {
            alert('No hay ventas registradas.');
        }
    });

    limpiarButton.addEventListener('click', () => {
        // Lógica para limpiar el total vendido
        localStorage.removeItem('totalVendido');
        alert('Total Vendido limpiado para el nuevo turno.');
    });
