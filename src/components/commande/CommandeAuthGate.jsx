export default function CommandeAuthGate({
  session,
  allowed,
  canSeeStaffDashboard,
  hasManagerRole,
  isManagerInterface,
  routeLabel,
  email,
  setEmail,
  password,
  setPassword,
  authError,
  handleLogin,
  handleLogout,
  statusMsg,
  children,
}) {
  if (!session) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-md border border-amber-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-3'>Serveur Access</p>
          <h1 className='text-3xl font-light mb-2'>{routeLabel}</h1>
          <p className='text-white/60 text-sm mb-6'>
            {isManagerInterface
              ? 'Connexion reservee au gerant (finances + gestion staff).'
              : 'Connexion reservee au personnel du cafe.'}
          </p>

          <form onSubmit={handleLogin} className='space-y-4'>
            <input
              type='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder='Email serveur'
              className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
              autoComplete='email'
            />
            <input
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder='Mot de passe'
              className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
              autoComplete='current-password'
            />

            {authError && <p className='text-red-400 text-sm'>{authError}</p>}

            <button
              type='submit'
              className='w-full bg-amber-500 text-black font-semibold py-3 hover:bg-amber-400 transition-colors'
            >
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3'>Access Refuse</p>
          <h1 className='text-2xl sm:text-3xl font-light mb-4'>Compte sans autorisation serveur</h1>
          <p className='text-white/65 text-sm sm:text-base'>
            Ajoutez cet utilisateur dans la table public.staff_users pour activer l acces a {routeLabel}.
          </p>
          {statusMsg && <p className='text-amber-400 text-sm mt-4'>{statusMsg}</p>}
          <button
            onClick={handleLogout}
            className='mt-6 px-5 py-2 border border-white/30 hover:bg-white/10 transition-colors'
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!canSeeStaffDashboard) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3'>Access Refuse</p>
          <h1 className='text-2xl sm:text-3xl font-light mb-4'>Permission insuffisante</h1>
          <p className='text-white/65 text-sm sm:text-base'>
            Votre session est active mais ne possede pas les permissions d action pour gerer les commandes.
          </p>
          <button
            onClick={handleLogout}
            className='mt-6 px-5 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (isManagerInterface && !hasManagerRole) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3'>Access Refuse</p>
          <h1 className='text-2xl sm:text-3xl font-light mb-4'>Acces reserve au gerant</h1>
          <p className='text-white/65 text-sm sm:text-base'>
            Cette interface requiert le role manager (ou admin). Connectez-vous via /commandes/staff pour l interface staff.
          </p>
          <div className='mt-6 flex flex-wrap gap-3'>
            <a
              href='/commandes/staff'
              className='px-5 py-2 border border-white/30 hover:bg-white/10 transition-colors text-sm'
            >
              Ouvrir /commandes/staff
            </a>
            <button
              onClick={handleLogout}
              className='px-5 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
