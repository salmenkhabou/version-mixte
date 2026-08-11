import { useCoffeeShop } from './coffee-shop/useCoffeeShop';
import Header from './coffee-shop/Header';
import ShopView from './coffee-shop/ShopView';
import FavoritesView from './coffee-shop/FavoritesView';
import CartView from './coffee-shop/CartView';
import AboutView from './coffee-shop/AboutView';
import ContactView from './coffee-shop/ContactView';
import GameView from './coffee-shop/GameView';
import { PHONE_REGEX, TABLE_NUMBER_REGEX } from './coffee-shop/constants';

export default function CoffeeShop() {
  const {
    isMobile,
    scrolled,
    currentView,
    setCurrentView,
    menuOpen,
    setMenuOpen,
    favorites,
    isDarkMode,
    toggleTheme,
    siteSettings,
    cartItems,
    cartCount,
    cartTotal,
    tableNumber,
    setTableNumber,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    orderNotes,
    setOrderNotes,
    orderMsg,
    isSubmittingOrder,
    menuCoffeeItems,
    categories,
    toggleFavorite,
    clearAllFavorites,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    submitOrder,
    launchARExperience,
  } = useCoffeeShop();

  const tableNumberValid = TABLE_NUMBER_REGEX.test(String(tableNumber || '').trim());
  const customerPhoneValid = !customerPhone || PHONE_REGEX.test(String(customerPhone || '').trim());

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] transition-colors duration-300'>
      <Header
        isMobile={isMobile}
        scrolled={scrolled}
        currentView={currentView}
        setCurrentView={setCurrentView}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        favorites={favorites}
        cartCount={cartCount}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        showGames={siteSettings.showGames}
        showOrdersModule={siteSettings.showOrdersModule}
      />

      {currentView === 'shop' ? (
        <ShopView
          isMobile={isMobile}
          coffeeItems={menuCoffeeItems}
          categories={categories}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          isDarkMode={isDarkMode}
          onLaunchAR={launchARExperience}
          showAR={siteSettings.showAR}
          showOrdersModule={siteSettings.showOrdersModule}
          onAddToCart={addToCart}
        />
      ) : currentView === 'favorites' ? (
        <FavoritesView
          isMobile={isMobile}
          coffeeItems={menuCoffeeItems}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          clearAllFavorites={clearAllFavorites}
          isDarkMode={isDarkMode}
          showOrdersModule={siteSettings.showOrdersModule}
          onAddToCart={addToCart}
        />
      ) : currentView === 'cart' && siteSettings.showOrdersModule ? (
        <CartView
          isDarkMode={isDarkMode}
          cartItems={cartItems}
          cartTotal={cartTotal}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerPhoneValid={customerPhoneValid}
          orderNotes={orderNotes}
          setOrderNotes={setOrderNotes}
          onIncrement={(id) => updateCartQuantity(id, 1)}
          onDecrement={(id) => updateCartQuantity(id, -1)}
          onRemove={removeFromCart}
          onClear={clearCart}
          onConfirm={submitOrder}
          orderMsg={orderMsg}
          isSubmittingOrder={isSubmittingOrder}
          tableNumberValid={tableNumberValid}
        />
      ) : currentView === 'about' ? (
        <AboutView isMobile={isMobile} isDarkMode={isDarkMode} />
      ) : currentView === 'contact' ? (
        <ContactView isMobile={isMobile} isDarkMode={isDarkMode} />
      ) : currentView === 'game' && siteSettings.showGames ? (
        <GameView isMobile={isMobile} isDarkMode={isDarkMode} />
      ) : (
        <ShopView
          isMobile={isMobile}
          coffeeItems={menuCoffeeItems}
          categories={categories}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          isDarkMode={isDarkMode}
          onLaunchAR={launchARExperience}
          showAR={siteSettings.showAR}
          showOrdersModule={siteSettings.showOrdersModule}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
}

