// AR Smart Menu - Main Application

class ARSmartMenu {
    constructor() {
        this.selectedDish = null;
        this.init();
    }

    init() {
        this.cacheElements();
        this.renderMenu();
        this.bindEvents();
    }

    cacheElements() {
        this.elements = {
            menuGrid: document.getElementById('menu-grid'),
            startARBtn: document.getElementById('start-ar-btn'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText: document.getElementById('loading-text')
        };
    }

    renderMenu() {
        // Group items by category
        const categories = {};
        menuData.forEach(dish => {
            if (!categories[dish.category]) {
                categories[dish.category] = [];
            }
            categories[dish.category].push(dish);
        });

        // Define category order
        const categoryOrder = ['Starters', 'Main Course', 'Desserts', 'Drinks'];
        
        let menuHTML = '';
        categoryOrder.forEach(category => {
            if (categories[category]) {
                menuHTML += `<div class="category-section">
                    <h2 class="category-title">${category}</h2>
                    <div class="menu-grid">
                        ${categories[category].map(dish => `
                            <div class="menu-item" data-dish-id="${dish.id}">
                                <span class="emoji">${dish.emoji}</span>
                                <h3>${dish.name}</h3>
                                <span class="price">${restaurantConfig.currency}${dish.price.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        });
        
        this.elements.menuGrid.innerHTML = menuHTML;
    }

    bindEvents() {
        // Start AR button - navigate to AR page
        this.elements.startARBtn.addEventListener('click', () => this.startAR());
        
        // Menu item clicks - select dish
        this.elements.menuGrid.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                this.selectDish(menuItem.dataset.dishId);
            }
        });
    }

    selectDish(dishId) {
        this.selectedDish = dishId;
        
        // Update visual selection
        document.querySelectorAll('.menu-item').forEach(item => {
            if (item.dataset.dishId === dishId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    async startAR() {
        // Check for camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Camera not supported on this browser.');
            return;
        }

        // Show loading
        this.elements.loadingOverlay.classList.add('visible');
        this.elements.loadingText.textContent = 'Requesting camera access...';

        try {
            // Request camera permission first
            await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            this.elements.loadingText.textContent = 'Opening AR view...';
            
            // Save selected dish to localStorage (default to burger if none selected)
            const dishToShow = this.selectedDish || 'burger';
            localStorage.setItem('selectedDish', dishToShow);
            
            // Navigate to AR page
            window.location.href = 'ar.html';
            
        } catch (error) {
            console.error('Camera Error:', error);
            this.elements.loadingOverlay.classList.remove('visible');
            
            if (error.name === 'NotAllowedError') {
                alert('Camera permission denied. Please allow camera access in your browser settings and try again.');
            } else {
                alert('Camera error: ' + error.message);
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading initially
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.classList.remove('visible');
    
    window.arSmartMenu = new ARSmartMenu();
});

