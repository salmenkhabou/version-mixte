import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_STORAGE_KEYS,
  DEFAULT_SITE_SETTINGS,
  loadCoffeeItems,
  loadSiteSettings,
  saveCoffeeItems,
  saveSiteSettings,
} from '../../utils/adminStorage';

const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USER || 'chi5a-admin';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'chi5a-2026-secure';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
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
  };
}

export default function AdminPanel() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(() => Number(localStorage.getItem(ADMIN_STORAGE_KEYS.lockUntil) || 0));
  const [authSession, setAuthSession] = useState(null);
  const [authError, setAuthError] = useState('');

  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const existing = localStorage.getItem(ADMIN_STORAGE_KEYS.session);
    if (!existing) return;

    try {
      const parsed = JSON.parse(existing);
      if (parsed.expiresAt > Date.now()) {
        setAuthSession(parsed);
      } else {
        localStorage.removeItem(ADMIN_STORAGE_KEYS.session);
      }
    } catch (error) {
      console.error('Invalid admin session:', error);
    }
  }, []);

  useEffect(() => {
    if (!authSession) return;

    setSettings(loadSiteSettings());
    setArticles(loadCoffeeItems(fallbackArticles).map((item, index) => sanitizeItem(item, index)));
  }, [authSession]);

  const isLocked = lockUntil > Date.now();
  const lockRemainingMinutes = Math.max(1, Math.ceil((lockUntil - Date.now()) / 60000));

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => Number(a.id) - Number(b.id));
  }, [articles]);

  const persistSettings = (nextSettings) => {
    const saved = saveSiteSettings(nextSettings);
    setSettings(saved);
    setStatusMsg('Parametres enregistres.');
  };

  const persistArticles = (nextArticles) => {
    const normalized = nextArticles.map((item, index) => sanitizeItem(item, index));
    saveCoffeeItems(normalized);
    setArticles(normalized);
    setStatusMsg('Articles enregistres.');
  };

  const handleLogin = (event) => {
    event.preventDefault();
    setAuthError('');

    if (isLocked) {
      setAuthError(`Acces bloque. Reessayez dans ${lockRemainingMinutes} minute(s).`);
      return;
    }

    const userValid = username.trim() === ADMIN_USERNAME;
    const passValid = password === ADMIN_PASSWORD;

    if (!userValid || !passValid) {
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

    const nextSession = {
      user: ADMIN_USERNAME,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
      token: Math.random().toString(36).slice(2),
    };

    localStorage.setItem(ADMIN_STORAGE_KEYS.session, JSON.stringify(nextSession));
    setAuthSession(nextSession);
    setStatusMsg('Connexion admin reussie.');
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEYS.session);
    setAuthSession(null);
    setUsername('');
    setPassword('');
    setStatusMsg('Session fermee.');
  };

  const upsertArticle = (event) => {
    event.preventDefault();

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
      persistArticles(articles.map((item) => (Number(item.id) === Number(payload.id) ? payload : item)));
      setStatusMsg('Article modifie.');
    } else {
      persistArticles([...articles, payload]);
      setStatusMsg('Article ajoute.');
    }

    setForm(emptyForm);
  };

  const editArticle = (article) => {
    setForm({
      ...article,
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      originalPrice: article.originalPrice ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteArticle = (articleId) => {
    if (!window.confirm('Supprimer cet article ?')) return;
    persistArticles(articles.filter((item) => Number(item.id) !== Number(articleId)));
    setStatusMsg('Article supprime.');

    if (Number(form.id) === Number(articleId)) {
      setForm(emptyForm);
    }
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
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Utilisateur"
              className="w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500"
              autoComplete="username"
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
              Pour renforcer la securite, configurez VITE_ADMIN_USER et VITE_ADMIN_PASSWORD dans l environnement de build.
            </p>
          </form>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Site actif pour le client</p>
                <p className="text-xs text-white/50">Si desactive, le front public devient inaccessible.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.siteEnabled}
                onChange={(event) => persistSettings({ ...settings, siteEnabled: event.target.checked })}
                className="h-4 w-4 accent-amber-500"
              />
            </label>

            <label className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Boutons View in AR visibles</p>
                <p className="text-xs text-white/50">Affiche/cache tous les boutons AR dans la boutique.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showAR}
                onChange={(event) => persistSettings({ ...settings, showAR: event.target.checked })}
                className="h-4 w-4 accent-amber-500"
              />
            </label>

            <label className="border border-white/10 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">Section Games visible</p>
                <p className="text-xs text-white/50">Affiche/cache le menu Games et l acces aux jeux.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showGames}
                onChange={(event) => persistSettings({ ...settings, showGames: event.target.checked })}
                className="h-4 w-4 accent-amber-500"
              />
            </label>
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

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                className="px-6 py-3 bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
              >
                {form.id ? 'Mettre a jour' : 'Ajouter article'}
              </button>
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
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
                        {article.model3d && (
                          <p className="text-xs text-emerald-400 mt-1 truncate">3D: {article.model3d}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => editArticle(article)}
                        className="px-4 py-2 text-xs border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors"
                      >
                        Editer
                      </button>
                      <button
                        onClick={() => deleteArticle(article.id)}
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

        {statusMsg && (
          <p className="text-sm text-emerald-400">{statusMsg}</p>
        )}
      </main>
    </div>
  );
}
