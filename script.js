/* =========================================
   HEV COSMETICS - MAIN SCRIPT
   ========================================= */

// --- 1. INITIALIZATION & AUTHENTICATION ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadProducts();
    updateCartBadge();
});

// Check if user is logged in
function checkAuth() {
    const savedName = localStorage.getItem('userName');
    const loginLink = document.querySelector('.login-link'); 

    if (savedName && loginLink) {
        loginLink.outerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin: 0 15px;">
                <span style="color: var(--white); font-weight: bold; font-size: 1rem;">Hello, ${savedName}</span>
                <button onclick="logoutUser()" style="background: transparent; color: #e50000; border: 1px solid #e50000; border-radius: 20px; padding: 5px 15px; cursor: pointer; transition: 0.3s; font-weight: bold;">Logout</button>
            </div>
        `;
    }
}

// Logout function
function logoutUser() {
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    window.location.reload(); 
}

// --- المتغيرات العامة لنظام التقليب ---
let allProducts = []; // سيحفظ كل المنتجات القادمة من السيرفر
let filteredProducts = []; // سيحفظ المنتجات بعد البحث أو الفلترة
let currentPage = 1;
const productsPerPage = 4; // عدد المنتجات في كل صفحة

// --- 2. PRODUCT MANAGEMENT (FETCH FROM SERVER) ---
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const result = await response.json();

        if (result.success) {
            allProducts = result.products;
            filteredProducts = allProducts; // في البداية نعرض كل المنتجات
            renderProducts(); // استدعاء دالة الرسم الجديدة
        }
    } catch (error) {
        console.error("Error loading products:", error);
        document.getElementById('dynamic-products').innerHTML = '<p style="text-align:center; width:100%;">Failed to load products. Please try again later.</p>';
    }
}

// دالة رسم المنتجات حسب الصفحة الحالية
function renderProducts() {
    const productsContainer = document.getElementById('dynamic-products');
    if (!productsContainer) return;

    productsContainer.innerHTML = ''; 

    // حساب عدد الصفحات
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage) || 1;
    
    // حماية لتجنب تجاوز الصفحات
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // حساب المنتجات المسموح عرضها في هذه الصفحة
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);

    // رسم المنتجات الـ 6
    productsToShow.forEach(product => {
        const mainImage = (product.images && product.images.length > 0) ? product.images[0] : 'default-image.jpg'; 
        const categoryClass = product.category ? product.category.toLowerCase() : 'all';

        productsContainer.innerHTML += `
            <div class="product-card" data-category="${categoryClass}">
                <div class="product-img-container">
                    <img src="${mainImage}" alt="${product.name}">
                </div>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-price">$${product.price}</p>
                
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                    <button onclick="addToCart('${product.id}', '${product.name}', ${product.price}, '${mainImage}')" 
                            class="btn-add" style="border-radius: 5px; background-color: #e50000; color: white; padding: 10px; border: none; cursor: pointer; font-weight: bold;">
                        Add to Cart 🛒
                    </button>

                    <button onclick="window.location.href='product.html?id=${product.id}'" 
                            style="width:100%; padding:10px; background:#000; color:#fff; border:none; cursor:pointer; font-weight:bold; border-radius:5px; transition:0.3s;" 
                            onmouseover="this.style.background='#333'" 
                            onmouseout="this.style.background='#000'">
                        View Details
                    </button>
                </div>
            </div>
        `;
    });

    // تحديث أرقام الصفحات وحالة الأسهم
    document.getElementById('page-indicator').innerText = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

// دوال التقليب
function nextPage() {
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
    }
}

// --- 3. SEARCH & FILTER (محدثة لتعمل مع التقليب) ---
function searchProducts() {
    let input = document.getElementById('productSearch').value.toLowerCase();
    
    // فلترة المصفوفة الأصلية
    filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(input));
    
    // إعادة الصفحة للأولى ورسم المنتجات
    currentPage = 1;
    renderProducts();
}

function filterCategory(event, categoryName) {
    let buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // فلترة حسب القسم
    if (categoryName === 'all') {
        filteredProducts = allProducts;
    } else {
        filteredProducts = allProducts.filter(p => {
            let cat = p.category ? p.category.toLowerCase() : '';
            return cat === categoryName;
        });
    }
    
    // إعادة الصفحة للأولى ورسم المنتجات
    currentPage = 1;
    renderProducts();
}

// --- 4. CART LOGIC (LOCAL STORAGE) ---

// Add Item
function addToCart(id, name, price, image) {
    let cart = JSON.parse(localStorage.getItem('hevCart')) || [];
    let existingProduct = cart.find(item => item.id === id);

    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        cart.push({ id, name, price, image, quantity: 1 });
    }

    localStorage.setItem('hevCart', JSON.stringify(cart));
    
    updateCartBadge();
    renderDrawerCart();
    openCart(); // Auto-open drawer
}

// Render Cart Items in Drawer
function renderDrawerCart() {
    let cart = JSON.parse(localStorage.getItem('hevCart')) || [];
    let container = document.getElementById('drawer-items');
    let totalElement = document.getElementById('drawer-total');
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #777; margin-top: 20px;">Your cart is empty.</p>';
        if(totalElement) totalElement.innerText = '$0.00';
        return;
    }

    container.innerHTML = '';
    cart.forEach((item, index) => {
        total += (item.price * item.quantity);
        container.innerHTML += `
            <div class="drawer-item" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                <img src="${item.image}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; font-size: 0.95rem; color: #333;">${item.name}</h4>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div class="qty-controls" style="display: flex; align-items: center; border: 1px solid #ddd; border-radius: 4px; margin-right: 10px;">
                            <button class="qty-btn" onclick="changeQty(${index}, -1)" style="padding: 2px 8px; background: #f9f9f9; border: none; cursor: pointer;">-</button>
                            <span style="padding: 0 10px; font-weight: bold; font-size: 0.9rem;">${item.quantity}</span>
                            <button class="qty-btn" onclick="changeQty(${index}, 1)" style="padding: 2px 8px; background: #f9f9f9; border: none; cursor: pointer;">+</button>
                        </div>
                        <p style="margin: 0; color: #000; font-weight: bold; font-size: 0.9rem;">$${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                </div>
                <button onclick="removeFromDrawer(${index})" style="background: none; border: none; color: #ff4d4d; cursor: pointer; font-size: 1.1rem;">🗑️</button>
            </div>
        `;
    });
    if(totalElement) totalElement.innerText = `$${total.toFixed(2)}`;
}

// Change Quantity
function changeQty(index, delta) {
    let cart = JSON.parse(localStorage.getItem('hevCart')) || [];
    
    cart[index].quantity += delta;

    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    localStorage.setItem('hevCart', JSON.stringify(cart));
    renderDrawerCart();
    updateCartBadge();
}

// Remove Item
function removeFromDrawer(index) {
    let cart = JSON.parse(localStorage.getItem('hevCart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('hevCart', JSON.stringify(cart));
    renderDrawerCart();
    updateCartBadge();
}

// Open/Close Drawer
function openCart(e) {
    if(e) e.preventDefault();
    document.getElementById('cart-drawer').style.right = '0';
    document.getElementById('cart-overlay').style.display = 'block';
    renderDrawerCart();
}

function closeCart() {
    document.getElementById('cart-drawer').style.right = '-400px';
    document.getElementById('cart-overlay').style.display = 'none';
}

// Update Header Badge
function updateCartBadge() {
    let cart = JSON.parse(localStorage.getItem('hevCart')) || [];
    let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    let badge = document.getElementById('cart-count-badge');
    if (badge) {
        badge.innerText = totalItems;
    }
}

// --- 5. CHECKOUT ---
function checkout() {
    let cart = JSON.parse(localStorage.getItem('hevCart')) || [];
    if(cart.length === 0) {
        alert("Your cart is empty! Please add some products.");
    } else {
        alert("Proceeding to secure checkout...");
        // Here you would typically redirect to a checkout page
    }
}

// --- 6. MOBILE MENU ---
function closeMenu() {
    const navLinks = document.getElementById('nav-links');
    if(navLinks) navLinks.classList.remove('active');
}