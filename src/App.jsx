import { Fragment, useEffect, useState } from 'react';
import { completeNewPassword, currentUser, signIn, signOut } from './auth.js';
import { ErrorBox, Field, ToastProvider } from './ui.jsx';
import Recipes from './pages/Recipes.jsx';
import DietTags from './pages/DietTags.jsx';
import Ingredients from './pages/Ingredients.jsx';
import Accounts from './pages/Accounts.jsx';
import Explorer from './pages/Explorer.jsx';

// key -> [label, component, nav group]
const PAGES = {
  recipes: ['Recipes', Recipes, 'Catalog'],
  ingredients: ['Ingredients', Ingredients, 'Catalog'],
  tags: ['Diet tags', DietTags, 'Catalog'],
  accounts: ['Accounts', Accounts, 'Support'],
  explorer: ['API Explorer', Explorer, 'Support'],
};
const DEFAULT_PAGE = 'recipes';

function Login({ onDone }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [newPw, setNewPw] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = challenge
        ? await completeNewPassword({ username: challenge.username, session: challenge.session, newPassword: newPw })
        : await signIn(username, password);
      if (r.challenge) setChallenge(r); else onDone(r.user);
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>🍴 Forkplan Admin</h1>
        <ErrorBox error={err} />
        {!challenge ? (
          <>
            <Field label="Username"><input value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus /></Field>
            <Field label="Password"><input type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></Field>
          </>
        ) : (
          <Field label="Choose a new password" hint="Your account requires a new password before first sign-in.">
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" autoFocus />
          </Field>
        )}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : challenge ? 'Set password' : 'Sign in'}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(currentUser());
  const readPage = () => (PAGES[window.location.hash.slice(1)] ? window.location.hash.slice(1) : DEFAULT_PAGE);
  const [page, setPage] = useState(readPage);
  useEffect(() => {
    const h = () => { setPage(readPage()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => { document.title = `${PAGES[page][0]} · Forkplan Admin`; }, [page]);

  if (!user?.isAdmin) return <Login onDone={setUser} />;
  const [, Page] = PAGES[page];
  let lastGroup = null;

  return (
    <ToastProvider>
      <div className="shell">
        <nav>
          <div className="brand"><img src="/logo.png" alt="" width="28" height="28" />Forkplan</div>
          {Object.entries(PAGES).map(([k, [label, , group]]) => {
            const showGroup = group !== lastGroup;
            lastGroup = group;
            return (
              <Fragment key={k}>
                {showGroup && <div className="nav-group">{group}</div>}
                <a href={`#${k}`} className={page === k ? 'active' : ''} aria-current={page === k ? 'page' : undefined}>{label}</a>
              </Fragment>
            );
          })}
          <div className="spacer" />
          <div className="who">{user.username}</div>
          <button onClick={() => { signOut(); setUser(null); }}>Sign out</button>
        </nav>
        <main><Page /></main>
      </div>
    </ToastProvider>
  );
}
