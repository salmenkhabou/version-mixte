import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_STORAGE_KEYS,
  DEFAULT_SITE_SETTINGS,
  hasAdminWriteAccess,
  loadCoffeeItems,
  loadSiteSettings,
  saveCoffeeItems,
  saveSiteSettings,
} from '../../utils/adminStorage';
import {
  loadStaffMembers,
  provisionStaffAccount,
  removeStaffMember,
  upsertStaffMember,
} from '../../utils/orderService';
import { supabaseClient } from '../../lib/supabaseClient';
import { useAccess } from '../../contexts/AccessContext';
import { ERP_ACTIONS } from '../../erp/permissions';

const LOCK_DURATION_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const fallbackArticles = [
  {
    id: 1,
    name: 'Velvet Cappuccino',
    subtitle: 'Dark Chocolate & Vanilla Bean',
    description: 'Luxurious espresso blend with velvety steamed milk, artisan dark chocolate, and Madagascar vanilla',
    price: 20,
    originalPrice: null,
    rating: 4.9,
    reviews: 1247,
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&h=600&fit=crop&q=90',
    model3d: '',
    isPopular: true,
    isTrending: true,
    isNew: false,
    calories: 180,
    prepTime: '4 min',
    badge: '🔥 Trending',
    tags: ['Signature', 'Sweet', 'Creamy'],
    isAvailable: true,
  },
  {
    id: 2,
    name: 'Golden Oat Latte',
    subtitle: 'Turmeric & Honey Infusion',
    description: 'Creamy oat milk latte with golden turmeric, raw honey, and a hint of cinnamon',
    price: 18,
    originalPrice: null,
    rating: 4.8,
    reviews: 892,
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&h=600&fit=crop&q=90',
    model3d: '',
    isPopular: false,
    isTrending: false,
    isNew: true,
    calories: 150,
    prepTime: '3 min',
    badge: '✨ New',
    tags: ['Vegan', 'Healthy', 'Unique'],
    isAvailable: true,
  },
];

const emptyForm = {
  id: null,
  name: '',
  subtitle: '',
  description: '',
  price: '',
  originalPrice: '',
  image: '',
  model3d: '',
  rating: '',
  reviews: '',
  calories: '',
  prepTime: '',
  badge: '',
  tags: '',
  isPopular: false,
  isTrending: false,
  isNew: false,
  isAvailable: true,
};

function sanitizeItem(input, index = 0) {
  const safePrice = Number(input.price || 0);
  const safeOriginal = input.originalPrice === '' || input.originalPrice === null ? null : Number(input.originalPrice);

  return {
    id: input.id || Date.now() + index,
    name: input.name?.trim() || 'Untitled Article',
    subtitle: input.subtitle?.trim() || '',
    description: input.description?.trim() || '',
    price: Number.isFinite(safePrice) ? safePrice : 0,
    originalPrice: Number.isFinite(safeOriginal) ? safeOriginal : null,
    image: input.image?.trim() || '',
    model3d: input.model3d?.trim() || '',
    rating: Number.isFinite(Number(input.rating)) ? Number(input.rating) : 0,
    reviews: Number.isFinite(Number(input.reviews)) ? Number(input.reviews) : 0,
    calories: Number.isFinite(Number(input.calories)) ? Number(input.calories) : 0,
    prepTime: input.prepTime?.trim() || '',
    badge: input.badge?.trim() || '',
    tags: Array.isArray(input.tags)
      ? input.tags
      : String(input.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
    isPopular: Boolean(input.isPopular),
    isTrending: Boolean(input.isTrending),
    isNew: Boolean(input.isNew),
    isAvailable: input.isAvailable !== false,
  };
}

export default function AdminPanel() {
  const { can, isReady: accessReady, refreshAccess } = useAccess();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(() => Number(localStorage.getItem(ADMIN_STORAGE_KEYS.lockUntil) || 0));
  const [authSession, setAuthSession] = useState(null);
  const [authError, setAuthError] = useState('');

  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [statusMsg, setStatusMsg] = useState('');
  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [staffMembers, setStaffMembers] = useState([]);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('staff');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMsg, setStaffMsg] = useState('');

  useEffect(() => {
    if (!supabaseClient) {
      setAuthError('Supabase n est pas configure.');
      return;
    }

    let mounted = true;

    const bootstrapAuth = async () => {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error('Unable to restore admin session:', error);
        return;
      }

      if (mounted) {
        setAuthSession(data.session || null);
      }
    };

    void bootstrapAuth();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthSession(session || null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authSession) return;

    const loadAdminData = async () => {
      setAccessChecked(false);
      const adminAllowed = await hasAdminWriteAccess();
      setIsAdminAccess(adminAllowed);

      if (!adminAllowed) {
        setStatusMsg('Compte connecte sans droit ecriture. Ajoutez cet utilisateur dans public.admin_users.');
        setAccessChecked(true);
        return;
      }

      const [nextSettings, nextItems, staffResult] = await Promise.all([
        loadSiteSettings(),
        loadCoffeeItems(fallbackArticles),
        loadStaffMembers(),
      ]);
      setSettings(nextSettings);
      setArticles(nextItems.map((item, index) => sanitizeItem(item, index)));

      if (staffResult.ok) {
        setStaffMembers(staffResult.members);
        setStaffMsg('');
      } else {
        setStaffMsg(`Erreur chargement staff: ${staffResult.message}`);
      }

      setAccessChecked(true);
    };

    void loadAdminData();
  }, [authSession]);

  useEffect(() => {
    if (!authSession) return;
    refreshAccess().catch(() => {
      setStatusMsg('Impossible de rafraichir les droits en temps reel.');
    });
  }, [authSession, refreshAccess]);

  const isLocked = lockUntil > Date.now();
  const lockRemainingMinutes = Math.max(1, Math.ceil((lockUntil - Date.now()) / 60000));

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => Number(a.id) - Number(b.id));
  }, [articles]);

  const canWriteSettings = isAdminAccess && (!accessReady || can(ERP_ACTIONS.ADMIN_SETTINGS_WRITE));
  const canWriteArticles = isAdminAccess && (!accessReady || can(ERP_ACTIONS.ADMIN_ARTICLES_WRITE));
  const canManageStaff = isAdminAccess && (!accessReady || can(ERP_ACTIONS.ADMIN_STAFF_MANAGE));

  const persistSettings = async (nextSettings) => {
    if (!canWriteSettings) {
      setStatusMsg('Permission refusee: modification des parametres admin non autorisee.');
      return false;
    }

    try {
      const saved = await saveSiteSettings(nextSettings);
      setSettings(saved);
      setStatusMsg('Parametres enregistres sur Supabase.');
      return true;
    } catch (error) {
      console.error(error);
      setStatusMsg('Echec sauvegarde. Verifiez login Supabase et presence dans public.admin_users.');
      return false;
    }
  };

  const persistArticles = async (nextArticles) => {
    if (!canWriteArticles) {
      setStatusMsg('Permission refusee: modification des articles non autorisee.');
      return false;
    }

    const normalized = nextArticles.map((item, index) => sanitizeItem(item, index));
    const remoteSaved = await saveCoffeeItems(normalized);

    if (!remoteSaved) {
      setStatusMsg('Echec sauvegarde articles. Verifiez login Supabase et presence dans public.admin_users.');
      return false;
    }

    setArticles(normalized);
    setStatusMsg('Articles enregistres sur Supabase.');
    return true;
  };

  const refreshStaff = async () => {
    if (!canManageStaff) {
      setStaffMsg('Permission refusee: gestion du staff non autorisee.');
      return;
    }

    setStaffLoading(true);
    const result = await loadStaffMembers();
    setStaffLoading(false);

    if (!result.ok) {
      setStaffMsg(`Erreur chargement staff: ${result.message}`);
      return;
    }

    setStaffMembers(result.members);
    setStaffMsg('Liste staff mise a jour.');
  };

  const handleAddOrUpdateStaff = async (event) => {
    event.preventDefault();

    if (!canManageStaff) {
      setStaffMsg('Permission refusee: gestion du staff non autorisee.');
      return;
    }

    setStaffMsg('');

    const hasPassword = String(staffPassword || '').trim().length > 0;

    const result = hasPassword
      ? await provisionStaffAccount(staffEmail, staffPassword, staffRole)
      : await upsertStaffMember(staffEmail, staffRole);

    if (!result.ok) {
      setStaffMsg(`Erreur staff: ${result.message}`);
      return;
    }

    setStaffEmail('');
    setStaffPassword('');
    setStaffRole('staff');
    await refreshStaff();

    if (hasPassword) {
      if (result.rateLimited) {
        setStaffMsg(
          result.message ||
            'Limite email Supabase atteinte: invitation staff sauvegardee. Reessayez la creation du compte Auth plus tard.'
        );
        return;
      }

      if (result.accountCreated && result.requiresEmailConfirmation) {
        setStaffMsg('Compte staff cree. Verification email requise avant connexion (selon config Auth).');
      } else if (result.member?.isPending) {
        setStaffMsg('Compte en attente de synchronisation/activation. Reessayez dans quelques secondes puis testez /commandes/staff.');
      } else if (result.accountCreated) {
        setStaffMsg('Compte staff cree et role applique. L utilisateur peut se connecter a /commandes/staff.');
      } else if (result.accountAlreadyExists) {
        setStaffMsg('Compte Auth deja existant. Role staff/manager mis a jour.');
      } else {
        setStaffMsg('Compte staff traite avec succes.');
      }
      return;
    }

    setStaffMsg('Membre staff ajoute/mis a jour (invitation en attente si compte non cree).');
  };

  const handleRemoveStaff = async (member) => {
    if (!canManageStaff) {
      setStaffMsg('Permission refusee: suppression staff non autorisee.');
      return;
    }

    if (!globalThis.confirm('Supprimer ce membre du staff ?')) return;

    const result = await removeStaffMember({
      userId: member?.userId || null,
      email: member?.email || '',
    });
    if (!result.ok) {
      setStaffMsg(`Erreur suppression: ${result.message}`);
      return;
    }

    await refreshStaff();
    setStaffMsg('Membre staff supprime.');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');

    if (!supabaseClient) {
      setAuthError('Supabase n est pas configure.');
      return;
    }

    if (isLocked) {
      setAuthError(`Acces bloque. Reessayez dans ${lockRemainingMinutes} minute(s).`);
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);

      if (nextFailed >= MAX_FAILED_ATTEMPTS) {
        const nextLock = Date.now() + LOCK_DURATION_MS;
        setLockUntil(nextLock);
        localStorage.setItem(ADMIN_STORAGE_KEYS.lockUntil, String(nextLock));
        setFailedAttempts(0);
        setAuthError('Trop de tentatives. Acces temporairement bloque pendant 5 minutes.');
      } else {
        setAuthError(`Identifiants invalides (${nextFailed}/${MAX_FAILED_ATTEMPTS}).`);
      }
      return;
    }

    setFailedAttempts(0);
    localStorage.removeItem(ADMIN_STORAGE_KEYS.lockUntil);
    setLockUntil(0);

    setAuthSession(data.session || null);
    setStatusMsg('Connexion admin Supabase reussie.');
  };

  const handleLogout = async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    setAuthSession(null);
    setEmail('');
    setPassword('');
    setStatusMsg('Session fermee.');
  };

  const upsertArticle = async (event) => {
    event.preventDefault();

    if (!canWriteArticles) {
      setStatusMsg('Permission refusee: edition des articles non autorisee.');
      return;
    }

    if (!form.name.trim()) {
      setStatusMsg('Le nom de l article est obligatoire.');
      return;
    }

    const payload = sanitizeItem(
      {
        ...form,
        id: form.id || Date.now(),
      },
      0
    );

    const exists = articles.some((item) => Number(item.id) === Number(payload.id));

    if (exists) {
      const ok = await persistArticles(articles.map((item) => (Number(item.id) === Number(payload.id) ? payload : item)));
      if (ok) setStatusMsg('Article modifie.');
    } else {
      const ok = await persistArticles([...articles, payload]);
      if (ok) setStatusMsg('Article ajoute.');
    }

    setForm(emptyForm);
  };

  const editArticle = (article) => {
    if (!canWriteArticles) {
      setStatusMsg('Permission refusee: edition des articles non autorisee.');
      return;
    }

    setForm({
      ...article,
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      originalPrice: article.originalPrice ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteArticle = async (articleId) => {
    if (!canWriteArticles) {
      setStatusMsg('Permission refusee: suppression article non autorisee.');
      return;
    }

    if (!globalThis.confirm('Supprimer cet article ?')) return;
    const ok = await persistArticles(articles.filter((item) => Number(item.id) !== Number(articleId)));
    if (ok) setStatusMsg('Article supprime.');

    if (Number(form.id) === Number(articleId)) {
      setForm(emptyForm);
    }
  };

  const toggleArticleAvailability = async (articleId) => {
    if (!canWriteArticles) {
      setStatusMsg('Permission refusee: changement disponibilite non autorise.');
      return;
    }

    const target = articles.find((item) => Number(item.id) === Number(articleId));
    if (!target) return;

    const nextArticles = articles.map((item) => (
      Number(item.id) === Number(articleId)
        ? { ...item, isAvailable: !item.isAvailable }
        : item
    ));

    const ok = await persistArticles(nextArticles);
    if (!ok) return;

    setStatusMsg(target.isAvailable ? 'Article passe en rupture.' : 'Article repasse disponible.');
  };

  if (!authSession) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md border border-amber-500/30 bg-white/5 p-6 sm:p-8">
          <p className="text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-3">Admin Access</p>
          <h1 className="text-3xl font-light mb-2">/chika/super-admin</h1>
          <p className="text-white/60 text-sm mb-6">
            Espace securise pour administrer le site client.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email admin"
              className="w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              autoComplete="email"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              className="w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              autoComplete="current-password"
            />

            {authError && (
              <p className="text-red-400 text-sm">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 text-black font-semibold py-3 hover:bg-amber-400 transition-colors"
            >
              Se connecter
            </button>

            <p className="text-[11px] text-white/45">
              Connexion securisee via Supabase Auth (email + mot de passe).
            </p>
          </form>
        </div>
      </div>
    );
  }

  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md border border-white/20 bg-white/5 p-6 sm:p-8 text-center">
          <p className="text-sm text-white/70">Verification des droits admin...</p>
        </div>
      </div>
    );
  }

  if (!isAdminAccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8">
          <p className="text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3">Access Refuse</p>
          <h1 className="text-2xl sm:text-3xl font-light mb-4">Acces interdit a /chika/super-admin</h1>
          <p className="text-white/65 text-sm sm:text-base">
            Seul le proprietaire (compte present dans public.admin_users) peut acceder a cette interface.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 px-5 py-2 border border-white/30 hover:bg-white/10 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-14">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase text-amber-500">Admin Panel</p>
            <h1 className="text-2xl sm:text-3xl font-light">Gestion du site client</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <section className="border border-white/10 bg-white/5 p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-light mb-5">1) Controles de securite et disponibilite</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Site actif pour le client</p>
                <p className="text-xs text-white/50">Si desactive, le front public devient inaccessible.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.siteEnabled}
                disabled={!canWriteSettings}
                onChange={(event) => {
                  void persistSettings({ ...settings, siteEnabled: event.target.checked });
                }}
                className="h-4 w-4 accent-amber-500"
              />
            </div>

            <div className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Boutons View in AR visibles</p>
                <p className="text-xs text-white/50">Affiche/cache tous les boutons AR dans la boutique.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showAR}
                disabled={!canWriteSettings}
                onChange={(event) => {
                  void persistSettings({ ...settings, showAR: event.target.checked });
                }}
                className="h-4 w-4 accent-amber-500"
              />
            </div>

            <div className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Section Games visible</p>
                <p className="text-xs text-white/50">Affiche/cache le menu Games et l acces aux jeux.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showGames}
                disabled={!canWriteSettings}
                onChange={(event) => {
                  void persistSettings({ ...settings, showGames: event.target.checked });
                }}
                className="h-4 w-4 accent-amber-500"
              />
            </div>

            <div className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Module Commande actif</p>
                <p className="text-xs text-white/50">Active/desactive Add to cart, panier client et les routes /commandes/staff et /commandes/manager.</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.showOrdersModule)}
                disabled={!canWriteSettings}
                onChange={(event) => {
                  void persistSettings({ ...settings, showOrdersModule: event.target.checked });
                }}
                className="h-4 w-4 accent-amber-500"
              />
            </div>

            <div className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Module Inventaire Phase 2</p>
                <p className="text-xs text-white/50">Active/desactive les endpoints inventaire: niveaux, ajustements, pertes, recettes, consommation et alertes stock bas.</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.showInventoryModule)}
                disabled={!canWriteSettings}
                onChange={(event) => {
                  void persistSettings({ ...settings, showInventoryModule: event.target.checked });
                }}
                className="h-4 w-4 accent-amber-500"
              />
            </div>
          </div>
        </section>

        <section className="border border-white/10 bg-white/5 p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-light mb-5">2) CRUD Articles (image + objet 3D .glb)</h2>

          <form onSubmit={upsertArticle} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <input
              type="text"
              placeholder="Nom de l article"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              required
            />
            <input
              type="text"
              placeholder="Sous-titre"
              value={form.subtitle}
              onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <input
              type="number"
              placeholder="Prix"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              required
              step="0.1"
            />
            <input
              type="number"
              placeholder="Ancien prix (optionnel)"
              value={form.originalPrice}
              onChange={(event) => setForm({ ...form, originalPrice: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              step="0.1"
            />
            <input
              type="text"
              placeholder="URL Image"
              value={form.image}
              onChange={(event) => setForm({ ...form, image: event.target.value })}
              className="md:col-span-2 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Chemin/URL modele 3D .glb"
              value={form.model3d}
              onChange={(event) => setForm({ ...form, model3d: event.target.value })}
              className="md:col-span-2 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="md:col-span-2 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500 min-h-28"
            />
            <input
              type="text"
              placeholder="Prep time (ex: 4 min)"
              value={form.prepTime}
              onChange={(event) => setForm({ ...form, prepTime: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <input
              type="number"
              placeholder="Calories"
              value={form.calories}
              onChange={(event) => setForm({ ...form, calories: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <input
              type="number"
              placeholder="Rating"
              value={form.rating}
              onChange={(event) => setForm({ ...form, rating: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              step="0.1"
            />
            <input
              type="number"
              placeholder="Reviews"
              value={form.reviews}
              onChange={(event) => setForm({ ...form, reviews: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Badge (ex: 🔥 Trending)"
              value={form.badge}
              onChange={(event) => setForm({ ...form, badge: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Tags separes par virgule"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <label className="border border-white/15 px-4 py-3 flex items-center justify-between">
                <span>Trending</span>
                <input
                  type="checkbox"
                  checked={form.isTrending}
                  onChange={(event) => setForm({ ...form, isTrending: event.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
              <label className="border border-white/15 px-4 py-3 flex items-center justify-between">
                <span>New</span>
                <input
                  type="checkbox"
                  checked={form.isNew}
                  onChange={(event) => setForm({ ...form, isNew: event.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
              <label className="border border-white/15 px-4 py-3 flex items-center justify-between">
                <span>Popular</span>
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={(event) => setForm({ ...form, isPopular: event.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
              <label className="border border-white/15 px-4 py-3 flex items-center justify-between">
                <span>Disponible</span>
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canWriteArticles}
                className="px-6 py-3 bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
              >
                {form.id ? 'Mettre a jour' : 'Ajouter article'}
              </button>
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                disabled={!canWriteArticles}
                className="px-6 py-3 border border-white/30 hover:bg-white/10 transition-colors"
              >
                Vider formulaire
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {sortedArticles.length === 0 ? (
              <p className="text-white/60 text-sm">Aucun article enregistre.</p>
            ) : (
              sortedArticles.map((article) => (
                <article key={article.id} className="border border-white/10 p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={article.image || 'https://placehold.co/120x90?text=No+Image'}
                        alt={article.name}
                        className="w-20 h-16 object-cover border border-white/10"
                      />
                      <div className="min-w-0">
                        <h3 className="text-lg font-medium truncate">{article.name}</h3>
                        <p className="text-sm text-white/55 truncate">{article.subtitle || 'Sans sous-titre'}</p>
                        <p className="text-xs text-amber-500 mt-1">{Number(article.price).toFixed(1)} DT</p>
                        <p className={`text-xs mt-1 ${article.isAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {article.isAvailable ? 'Disponible' : 'Rupture'}
                        </p>
                        {article.model3d && (
                          <p className="text-xs text-emerald-400 mt-1 truncate">3D: {article.model3d}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          void toggleArticleAvailability(article.id);
                        }}
                        disabled={!canWriteArticles}
                        className={`px-4 py-2 text-xs border transition-colors ${
                          article.isAvailable
                            ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                            : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                        }`}
                      >
                        {article.isAvailable ? 'Passer en rupture' : 'Rendre disponible'}
                      </button>
                      <button
                        onClick={() => editArticle(article)}
                        disabled={!canWriteArticles}
                        className="px-4 py-2 text-xs border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors"
                      >
                        Editer
                      </button>
                      <button
                        onClick={() => deleteArticle(article.id)}
                        disabled={!canWriteArticles}
                        className="px-4 py-2 text-xs border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="border border-white/10 bg-white/5 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="text-xl sm:text-2xl font-light">3) Gestion du staff (/commandes/staff)</h2>
            <button
              onClick={() => {
                void refreshStaff();
              }}
              disabled={!canManageStaff}
              className="px-4 py-2 text-xs border border-white/25 hover:bg-white/10 transition-colors"
            >
              Rafraichir
            </button>
          </div>

          <form onSubmit={handleAddOrUpdateStaff} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <input
              type="email"
              placeholder="Email du staff (peut etre invite avant creation du compte)"
              value={staffEmail}
              onChange={(event) => setStaffEmail(event.target.value)}
              disabled={!canManageStaff}
              className="md:col-span-2 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe (optionnel pour creer le compte)"
              value={staffPassword}
              onChange={(event) => setStaffPassword(event.target.value)}
              disabled={!canManageStaff}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            />
            <select
              value={staffRole}
              onChange={(event) => setStaffRole(event.target.value)}
              disabled={!canManageStaff}
              className="bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
            >
              <option value="staff" className="text-black">staff</option>
              <option value="manager" className="text-black">manager (gerant)</option>
            </select>

            <div className="md:col-span-3 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canManageStaff}
                className="px-6 py-3 bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
              >
                Ajouter / Mettre a jour
              </button>
            </div>
          </form>

          {staffLoading && <p className="text-sm text-white/60 mb-4">Chargement du staff...</p>}

          <div className="space-y-3">
            {staffMembers.length === 0 ? (
              <p className="text-white/60 text-sm">Aucun staff configure.</p>
            ) : (
              staffMembers.map((member) => (
                <article key={`${member.userId || 'invite'}-${member.email}`} className="border border-white/10 p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-medium truncate">{member.email}</h3>
                      <p className="text-xs text-white/55 mt-1">{member.userId || 'Invite en attente de creation du compte'}</p>
                      <p className="text-xs mt-2">
                        Role:{' '}
                        <span className={member.role === 'manager' ? 'text-amber-400' : 'text-sky-400'}>
                          {member.role}
                        </span>
                      </p>
                      {member.isPending && (
                        <p className="text-xs mt-1 text-amber-300">Statut: invitation en attente</p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        void handleRemoveStaff(member);
                      }}
                      disabled={!canManageStaff}
                      className="px-4 py-2 text-xs border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <p className="text-[11px] text-white/45 mt-5">
            Note: si mot de passe renseigne, tentative de creation compte Auth + role staff. Sinon, invitation staff en attente.
          </p>
          {staffMsg && <p className="text-sm text-emerald-400 mt-3">{staffMsg}</p>}
        </section>

        {statusMsg && (
          <p className="text-sm text-emerald-400">{statusMsg}</p>
        )}
      </main>
    </div>
  );
}
