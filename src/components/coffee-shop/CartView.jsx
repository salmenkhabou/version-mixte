export default function CartView({
  isDarkMode,
  cartItems,
  cartTotal,
  tableNumber,
  setTableNumber,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerPhoneValid,
  orderNotes,
  setOrderNotes,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onConfirm,
  orderMsg,
  isSubmittingOrder,
  tableNumberValid,
}) {
  const canSubmit = cartItems.length > 0
    && tableNumberValid
    && !isSubmittingOrder
    && customerPhoneValid;

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] overflow-x-hidden transition-colors duration-300'>
      <div className='w-full pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 lg:pb-40'>
        <div className='max-w-[1100px] mx-auto px-4 sm:px-8 lg:px-12'>
          <section className='mb-10'>
            <h1 className='text-4xl sm:text-5xl font-light text-[var(--text-primary)]'>Panier</h1>
            <p className='text-sm text-[var(--text-secondary)] mt-3'>
              Verifiez votre commande, ajoutez votre numero de table, puis confirmez.
            </p>
          </section>

          {cartItems.length === 0 ? (
            <div className={`border p-8 text-center ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
              <p className='text-[var(--text-secondary)]'>Votre panier est vide.</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
              <div className='lg:col-span-2 space-y-4'>
                {cartItems.map((item) => (
                  <article
                    key={item.id}
                    className={`border p-4 sm:p-5 flex items-center gap-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}
                  >
                    <img src={item.image} alt={item.name} className='w-16 h-16 object-cover border border-white/10' />
                    <div className='flex-1 min-w-0'>
                      <p className='text-[var(--text-primary)] truncate'>{item.name}</p>
                      <p className='text-amber-500 text-sm'>{Number(item.price || 0).toFixed(2)} DT</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button onClick={() => onDecrement(item.id)} className='px-2 py-1 border border-white/20'>-</button>
                      <span className='w-6 text-center'>{item.quantity}</span>
                      <button onClick={() => onIncrement(item.id)} className='px-2 py-1 border border-white/20'>+</button>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className='px-3 py-1 text-xs border border-red-500/40 text-red-400 hover:bg-red-500/20'
                    >
                      Retirer
                    </button>
                  </article>
                ))}
              </div>

              <aside className={`border p-5 sm:p-6 space-y-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
                <h2 className='text-xl font-light text-[var(--text-primary)]'>Confirmation</h2>
                <input
                  type='text'
                  placeholder='Numero de table (obligatoire)'
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                />
                {!tableNumberValid && tableNumber && (
                  <p className='text-xs text-rose-400'>Format table invalide. Utilisez 1 a 3 chiffres.</p>
                )}
                <input
                  type='text'
                  placeholder='Nom client (optionnel)'
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                />
                <input
                  type='tel'
                  placeholder='Telephone mobile (optionnel)'
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                />
                {!customerPhoneValid && customerPhone && (
                  <p className='text-xs text-rose-400'>Telephone invalide (8 a 15 chiffres, + optionnel).</p>
                )}

                <textarea
                  placeholder='Note commande (optionnel)'
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  className='w-full min-h-24 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                />

                <div className='pt-2 border-t border-white/10'>
                  <p className='text-sm text-[var(--text-secondary)]'>Total</p>
                  <p className='text-2xl font-light text-amber-500'>{cartTotal.toFixed(2)} DT</p>
                </div>

                <div className='flex gap-3'>
                  <button
                    onClick={onConfirm}
                    disabled={!canSubmit}
                    className={`flex-1 font-semibold py-3 transition-colors ${
                      canSubmit
                        ? 'bg-amber-500 text-black hover:bg-amber-400'
                        : 'bg-amber-500/40 text-black/60 cursor-not-allowed'
                    }`}
                  >
                    {isSubmittingOrder ? 'Envoi en cours...' : 'Confirmer commande'}
                  </button>
                  <button
                    onClick={onClear}
                    className='px-4 py-3 border border-white/20 hover:bg-white/10 transition-colors text-sm'
                  >
                    Vider
                  </button>
                </div>

                {orderMsg && <p className='text-sm text-emerald-400'>{orderMsg}</p>}

              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
