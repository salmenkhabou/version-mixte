import { useEffect, useMemo, useState } from 'react';
import { BellRing, Clock3, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient';
import { hasServerAccess, loadOrders, updateOrderStatus } from '../../utils/orderService';

const REFRESH_INTERVAL_MS = 8000;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function statusStyle(status) {
  if (status === 'pending') return 'text-amber-400 border-amber-500/40';
  if (status === 'preparing') return 'text-sky-400 border-sky-500/40';
  if (status === 'served') return 'text-emerald-400 border-emerald-500/40';
  return 'text-rose-400 border-rose-500/40';
}

function normalizeRealtimeOrder(row) {
  return {
    id: row.id,
    tableNumber: String(row.table_number || '').trim(),
    customerName: String(row.customer_name || '').trim(),
    notes: String(row.notes || '').trim(),
    status: String(row.status || 'pending'),
    totalAmount: Number(row.total_amount || 0),
    items: Array.isArray(row.items) ? row.items : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function playNewOrderTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1174, ctx.currentTime + 0.11);
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.36);
  } catch (error) {
    console.warn('Unable to play order notification tone.', error);
  }
}

export default function CommandePanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [realtimeNotice, setRealtimeNotice] = useState('');

  const pendingCount = useMemo(() => orders.filter((order) => order.status === 'pending').length, [orders]);

  useEffect(() => {
    if (!supabaseClient) {
      setAuthError('Supabase n est pas configure.');
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
    };

    void bootstrap();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAllowed(false);
      setOrders([]);
      return;
    }

    let mounted = true;

    const verifyAndLoad = async () => {
      const access = await hasServerAccess();
      if (!mounted) return;
      setAllowed(access);

      if (!access) {
        setStatusMsg('Compte connecte sans acces serveur. Ajoutez-le dans public.staff_users.');
        return;
      }

      setLoading(true);
      const result = await loadOrders();
      if (!mounted) return;
      setLoading(false);

      if (!result.ok) {
        setStatusMsg(`Erreur chargement commandes: ${result.message}`);
        return;
      }

      setOrders(result.orders);
      setStatusMsg('');
    };

    void verifyAndLoad();

    const timer = setInterval(() => {
      void verifyAndLoad();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [session]);

  useEffect(() => {
    if (!session || !allowed || !supabaseClient) return;

    const channel = supabaseClient
      .channel('cafe-orders-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cafe_orders' },
        (payload) => {
          const incoming = normalizeRealtimeOrder(payload.new || {});

          setOrders((prev) => {
            const exists = prev.some((order) => Number(order.id) === Number(incoming.id));
            if (exists) return prev;
            return [incoming, ...prev];
          });

          setRealtimeNotice(`Nouvelle commande table ${incoming.tableNumber || '-'}`);
          playNewOrderTone();

          window.setTimeout(() => {
            setRealtimeNotice('');
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [session, allowed]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');

    if (!supabaseClient) {
      setAuthError('Supabase n est pas configure.');
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError('Identifiants invalides.');
      return;
    }

    setStatusMsg('Connexion serveur reussie.');
  };

  const handleLogout = async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    setSession(null);
    setAllowed(false);
    setOrders([]);
    setEmail('');
    setPassword('');
  };

  const refreshOrders = async () => {
    if (!allowed) return;
    setLoading(true);
    const result = await loadOrders();
    setLoading(false);

    if (!result.ok) {
      setStatusMsg(`Erreur chargement commandes: ${result.message}`);
      return;
    }

    setOrders(result.orders);
    setStatusMsg('Commandes rechargees.');
  };

  const setOrderStatus = async (orderId, nextStatus) => {
    const result = await updateOrderStatus(orderId, nextStatus);
    if (!result.ok) {
      setStatusMsg(`Erreur mise a jour: ${result.message}`);
      return;
    }

    setOrders((prev) => prev.map((order) => (order.id === orderId ? result.order : order)));
    setStatusMsg(`Commande #${orderId} mise a jour.`);
  };

  if (!session) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-md border border-amber-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-3'>Serveur Access</p>
          <h1 className='text-3xl font-light mb-2'>/commande</h1>
          <p className='text-white/60 text-sm mb-6'>
            Connexion reservee au personnel du cafe.
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
            Ajoutez cet utilisateur dans la table public.staff_users pour activer l acces a /commande.
          </p>
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

  return (
    <div className='min-h-screen bg-black text-white pb-14'>
      <header className='border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-30'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3'>
          <div>
            <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500'>Cafe Commandes</p>
            <h1 className='text-2xl sm:text-3xl font-light'>Dashboard Serveur</h1>
            <p className='text-xs text-white/50 mt-1'>{pendingCount} commande(s) en attente</p>
          </div>
          <div className='flex gap-2'>
            <button
              onClick={refreshOrders}
              className='px-4 py-2 border border-white/20 hover:bg-white/10 transition-colors text-sm flex items-center gap-2'
            >
              <RefreshCw size={14} /> Rafraichir
            </button>
            <button
              onClick={handleLogout}
              className='px-4 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {realtimeNotice && (
          <div className='mb-5 border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-3 text-amber-300'>
            <BellRing size={16} />
            <p className='text-sm'>{realtimeNotice}</p>
          </div>
        )}

        {statusMsg && <p className='text-sm text-amber-300 mb-5'>{statusMsg}</p>}
        {loading && <p className='text-white/60 text-sm mb-5'>Chargement des commandes...</p>}

        {!loading && orders.length === 0 && (
          <div className='border border-white/10 bg-white/5 p-7 text-center'>
            <UtensilsCrossed size={28} className='mx-auto text-amber-500 mb-3' />
            <p className='text-white/70'>Aucune commande pour le moment.</p>
          </div>
        )}

        <div className='space-y-4'>
          {orders.map((order) => (
            <article key={order.id} className='border border-white/10 bg-white/5 p-5'>
              <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
                <div>
                  <div className='flex flex-wrap items-center gap-3 mb-2'>
                    <p className='text-lg font-medium'>Commande #{order.id}</p>
                    <span className={`px-2 py-1 text-xs border uppercase ${statusStyle(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className='text-sm text-white/70'>Table: {order.tableNumber || '-'}</p>
                  <p className='text-sm text-white/70'>Client: {order.customerName || '-'}</p>
                  <p className='text-sm text-white/70 flex items-center gap-2'>
                    <Clock3 size={14} /> {formatDate(order.createdAt)}
                  </p>
                  {order.notes && <p className='text-sm text-white/60 mt-1'>Note: {order.notes}</p>}
                </div>

                <div className='flex flex-wrap gap-2'>
                  <button
                    onClick={() => setOrderStatus(order.id, 'preparing')}
                    className='px-3 py-2 text-xs border border-sky-500/40 text-sky-300 hover:bg-sky-500/20'
                  >
                    Preparing
                  </button>
                  <button
                    onClick={() => setOrderStatus(order.id, 'served')}
                    className='px-3 py-2 text-xs border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                  >
                    Served
                  </button>
                  <button
                    onClick={() => setOrderStatus(order.id, 'cancelled')}
                    className='px-3 py-2 text-xs border border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className='mt-4 border-t border-white/10 pt-4'>
                <p className='text-xs text-white/50 mb-2 uppercase tracking-widest'>Items</p>
                <div className='space-y-1'>
                  {(order.items || []).map((item, index) => (
                    <p key={`${order.id}-${index}`} className='text-sm text-white/75'>
                      {item.quantity}x {item.name} - {(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} DT
                    </p>
                  ))}
                </div>
                <p className='text-sm text-amber-400 mt-3'>Total: {Number(order.totalAmount || 0).toFixed(2)} DT</p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
