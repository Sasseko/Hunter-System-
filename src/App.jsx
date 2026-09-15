import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dumbbell, BookOpen, Footprints, Droplet, Eye, Flame, Coins,
  Plus, X, Check, Loader2, Sparkles, ShoppingBag, ListChecks, UserRound,
  Bell, Swords, Users, Play, Pause, Ban, LogOut,
} from 'lucide-react';
import { supabase } from './supabaseClient';

const C = {
  bg: '#080B14',
  panel: '#10152A',
  panelAlt: '#161D3D',
  border: 'rgba(103,124,255,0.35)',
  accent: '#677CFF',
  accentSoft: 'rgba(103,124,255,0.14)',
  text: '#E8ECFB',
  textMuted: '#8993B8',
  textFaint: '#5B6488',
  gold: '#F0B429',
  danger: '#E5484D',
  success: '#22C58B',
};

const STAT_META = {
  force: { label: 'Force', icon: Dumbbell, color: '#E5657A' },
  intelligence: { label: 'Intelligence', icon: BookOpen, color: '#677CFF' },
  agilite: { label: 'Agilité', icon: Footprints, color: '#22C58B' },
  vitalite: { label: 'Vitalité', icon: Droplet, color: '#3FBFDD' },
  perception: { label: 'Perception', icon: Eye, color: '#C084F5' },
};

const RANK_TABLE = [
  { min: 1, label: 'E' },
  { min: 10, label: 'D' },
  { min: 20, label: 'C' },
  { min: 30, label: 'B' },
  { min: 40, label: 'A' },
  { min: 50, label: 'S' },
];

const DIFFICULTIES = [
  { label: 'Rang E · facile', xp: 10, gold: 5 },
  { label: 'Rang D', xp: 15, gold: 8 },
  { label: 'Rang C · moyen', xp: 25, gold: 12 },
  { label: 'Rang B', xp: 40, gold: 20 },
  { label: 'Rang A · difficile', xp: 60, gold: 30 },
];

const DUNGEON_DIFFICULTIES = DIFFICULTIES.map((d) => ({ label: d.label, xp: d.xp * 2, gold: d.gold * 2 }));

const DURATIONS = [
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
];

const DEFAULT_QUESTS = [
  { id: 'q1', title: '30 pompes', stat: 'force', xp: 20, gold: 10, completed: false },
  { id: 'q2', title: 'Lire 20 minutes', stat: 'intelligence', xp: 20, gold: 10, completed: false },
  { id: 'q3', title: '15 min de marche ou course', stat: 'agilite', xp: 20, gold: 10, completed: false },
  { id: 'q4', title: "Boire 2L d'eau", stat: 'vitalite', xp: 15, gold: 5, completed: false },
  { id: 'q5', title: '10 min de planification', stat: 'perception', xp: 20, gold: 10, completed: false },
];

const DEFAULT_DUNGEONS = [
  { id: 'd1', name: 'Gobelin des pompes', desc: 'Enchaîne les répétitions avant la fin du chrono', stat: 'force', seconds: 180, xp: 50, gold: 25 },
  { id: 'd2', name: 'Ogre de la course', desc: "Cours ou marche vite sans t'arrêter", stat: 'agilite', seconds: 600, xp: 90, gold: 45 },
  { id: 'd3', name: 'Golem des squats', desc: "Résiste jusqu'au bout", stat: 'vitalite', seconds: 240, xp: 60, gold: 30 },
];

const DEFAULT_SHOP = [
  { id: 's1', title: 'Un épisode de série', cost: 40 },
  { id: 's2', title: '30 min de jeu vidéo', cost: 40 },
  { id: 's3', title: 'Une envie sucrée', cost: 30 },
  { id: 's4', title: 'Petit achat plaisir', cost: 120 },
];

function getRank(level) {
  let cur = 'E';
  for (const r of RANK_TABLE) if (level >= r.min) cur = r.label;
  return cur;
}

function xpForLevel(level) {
  return 100 + (level - 1) * 45;
}

function defaultState() {
  return {
    character: {
      name: 'Chasseur',
      level: 1,
      xp: 0,
      gold: 0,
      streak: 0,
      statPoints: 0,
      stats: { force: 10, intelligence: 10, agilite: 10, vitalite: 10, perception: 10 },
    },
    quests: DEFAULT_QUESTS.map((q) => ({ ...q })),
    dungeons: DEFAULT_DUNGEONS.map((d) => ({ ...d })),
    shop: DEFAULT_SHOP.map((s) => ({ ...s })),
    guildName: null,
    settings: { reminderHour: null, reminderShownDate: null },
    lastReset: new Date().toDateString(),
  };
}

function migrate(state) {
  return {
    ...state,
    dungeons: state.dungeons && state.dungeons.length ? state.dungeons : DEFAULT_DUNGEONS.map((d) => ({ ...d })),
    guildName: state.guildName || null,
    settings: { reminderHour: null, reminderShownDate: null, ...(state.settings || {}) },
  };
}

function applyDailyReset(state) {
  const today = new Date().toDateString();
  if (state.lastReset === today) return state;
  const allDone = state.quests.length > 0 && state.quests.every((q) => q.completed);
  const streak = allDone ? state.character.streak + 1 : 0;
  return {
    ...state,
    character: { ...state.character, streak },
    quests: state.quests.map((q) => ({ ...q, completed: false })),
    lastReset: today,
  };
}

function computeReward(character, xp, gold, statKey) {
  let { level, xp: curXp, gold: curGold, statPoints, stats } = character;
  curXp += xp;
  curGold += gold;
  let leveledUp = false;
  let needed = xpForLevel(level);
  while (curXp >= needed) {
    curXp -= needed;
    level += 1;
    statPoints += 3;
    leveledUp = true;
    needed = xpForLevel(level);
  }
  const stats2 = statKey ? { ...stats, [statKey]: stats[statKey] + 1 } : stats;
  return { character: { ...character, level, xp: curXp, gold: curGold, statPoints, stats: stats2 }, leveledUp };
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

const hudPanel = (glow) => ({
  clipPath:
    'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
  background: `linear-gradient(160deg, ${C.panelAlt}, ${C.panel})`,
  border: `1px solid ${glow ? C.accent : C.border}`,
  boxShadow: glow ? `0 0 24px -6px ${C.accent}aa` : `0 0 20px -10px ${C.accent}66`,
});

const fieldStyle = {
  border: `1px solid ${C.border}`,
  color: C.text,
  background: 'transparent',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('status');
  const [toasts, setToasts] = useState([]);
  const [flash, setFlash] = useState(false);
  const [addQuestOpen, setAddQuestOpen] = useState(false);
  const [addRewardOpen, setAddRewardOpen] = useState(false);
  const [addDungeonOpen, setAddDungeonOpen] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qStat, setQStat] = useState('force');
  const [qDiff, setQDiff] = useState(2);
  const [rTitle, setRTitle] = useState('');
  const [rCost, setRCost] = useState(30);
  const [dTitle, setDTitle] = useState('');
  const [dStat, setDStat] = useState('force');
  const [dDiff, setDDiff] = useState(2);
  const [dDuration, setDDuration] = useState(1);
  const [activeDungeon, setActiveDungeon] = useState(null);
  const [guildInput, setGuildInput] = useState('');
  const [guildMembers, setGuildMembers] = useState([]);
  const [guildLoading, setGuildLoading] = useState(false);
  const [reminderBanner, setReminderBanner] = useState(null);
  const dataRef = useRef(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // suivi de la session Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // chargement du profil une fois connecté
  useEffect(() => {
    if (!session) {
      setData(null);
      return;
    }
    (async () => {
      setLoading(true);
      let loaded = defaultState();
      try {
        const { data: row } = await supabase
          .from('profiles')
          .select('data')
          .eq('id', session.user.id)
          .maybeSingle();
        if (row && row.data) {
          loaded = migrate(row.data);
        } else {
          await supabase.from('profiles').upsert({ id: session.user.id, data: loaded });
        }
      } catch (e) {
        // pas de profil trouvé, on part des valeurs par défaut
      }
      loaded = applyDailyReset(loaded);
      setData(loaded);
      setLoading(false);
    })();
  }, [session]);

  const persist = useCallback(
    async (next) => {
      setData(next);
      if (!session) return;
      try {
        await supabase.from('profiles').upsert({ id: session.user.id, data: next, updated_at: new Date().toISOString() });
      } catch (e) {
        // sauvegarde indisponible
      }
      if (next.guildName) {
        try {
          await supabase.from('guild_members').upsert({
            user_id: session.user.id,
            guild_name: next.guildName,
            name: next.character.name,
            level: next.character.level,
            rank: getRank(next.character.level),
            streak: next.character.streak,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          // publication guilde indisponible
        }
      }
    },
    [session]
  );

  // rappel quotidien : vérifie toutes les 30s si l'heure de rappel est passée
  useEffect(() => {
    const check = () => {
      const cur = dataRef.current;
      if (!cur || cur.settings.reminderHour === null) return;
      const now = new Date();
      const todayStr = now.toDateString();
      const remaining = cur.quests.filter((q) => !q.completed).length;
      if (
        now.getHours() >= cur.settings.reminderHour &&
        remaining > 0 &&
        cur.settings.reminderShownDate !== todayStr
      ) {
        setReminderBanner(remaining);
        persist({ ...cur, settings: { ...cur.settings, reminderShownDate: todayStr } });
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Hunter System', { body: `${remaining} quête(s) t'attendent encore aujourd'hui` });
          }
        } catch (e) {
          // notifications indisponibles
        }
      }
    };
    const id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  }, [persist]);

  function pushToast(text, kind) {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }

  function announceReward(leveledUp, level) {
    if (leveledUp) {
      pushToast(`Niveau ${level} atteint`, 'level');
      setFlash(true);
      setTimeout(() => setFlash(false), 1300);
    }
  }

  async function handleAuth() {
    setAuthError('');
    setAuthInfo('');
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Renseigne un email et un mot de passe.');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        if (!signUpData.session) {
          setAuthInfo('Compte créé — vérifie ta boîte mail pour confirmer avant de te connecter.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (e) {
      setAuthError(e.message || 'Une erreur est survenue.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setActiveDungeon(null);
    setTab('status');
  }

  function completeQuest(id) {
    if (!data) return;
    const quest = data.quests.find((q) => q.id === id);
    if (!quest || quest.completed) return;
    const { character, leveledUp } = computeReward(data.character, quest.xp, quest.gold, quest.stat);
    persist({
      ...data,
      character,
      quests: data.quests.map((q) => (q.id === id ? { ...q, completed: true } : q)),
    });
    pushToast(`+${quest.xp} XP · +${quest.gold} or`, 'xp');
    announceReward(leveledUp, character.level);
  }

  function deleteQuest(id) {
    if (!data) return;
    persist({ ...data, quests: data.quests.filter((q) => q.id !== id) });
  }

  function addQuest() {
    if (!data || !qTitle.trim()) return;
    const diff = DIFFICULTIES[qDiff];
    const quest = {
      id: 'c' + Date.now(),
      title: qTitle.trim(),
      stat: qStat,
      xp: diff.xp,
      gold: diff.gold,
      completed: false,
    };
    persist({ ...data, quests: [...data.quests, quest] });
    setQTitle('');
    setAddQuestOpen(false);
  }

  function allocateStat(statKey) {
    if (!data || data.character.statPoints <= 0) return;
    const c = data.character;
    persist({
      ...data,
      character: {
        ...c,
        statPoints: c.statPoints - 1,
        stats: { ...c.stats, [statKey]: c.stats[statKey] + 1 },
      },
    });
  }

  function updateName(name) {
    if (!data) return;
    persist({ ...data, character: { ...data.character, name } });
  }

  function buyReward(item) {
    if (!data || data.character.gold < item.cost) return;
    persist({ ...data, character: { ...data.character, gold: data.character.gold - item.cost } });
    pushToast(`Débloqué : ${item.title}`, 'reward');
  }

  function addReward() {
    if (!data || !rTitle.trim()) return;
    const item = { id: 'r' + Date.now(), title: rTitle.trim(), cost: Math.max(1, Number(rCost) || 1) };
    persist({ ...data, shop: [...data.shop, item] });
    setRTitle('');
    setAddRewardOpen(false);
  }

  function deleteReward(id) {
    if (!data) return;
    persist({ ...data, shop: data.shop.filter((s) => s.id !== id) });
  }

  function setReminderHour(val) {
    if (!data) return;
    const hour = val === '' ? null : Number(val);
    persist({ ...data, settings: { ...data.settings, reminderHour: hour } });
    if (hour !== null) {
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (e) {
        // notifications indisponibles
      }
    }
  }

  function handleDungeonCleared(d) {
    setActiveDungeon(null);
    if (!data) return;
    const { character, leveledUp } = computeReward(data.character, d.xp, d.gold, d.stat);
    persist({ ...data, character });
    pushToast(`Donjon nettoyé : +${d.xp} XP · +${d.gold} or`, 'xp');
    announceReward(leveledUp, character.level);
  }

  useEffect(() => {
    if (!activeDungeon || activeDungeon.status !== 'running') return;
    if (activeDungeon.secondsLeft <= 0) {
      handleDungeonCleared(activeDungeon);
      return;
    }
    const t = setTimeout(() => {
      setActiveDungeon((cur) => (cur ? { ...cur, secondsLeft: cur.secondsLeft - 1 } : cur));
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDungeon]);

  function startDungeon(d) {
    if (activeDungeon) return;
    setActiveDungeon({
      id: d.id,
      name: d.name,
      desc: d.desc,
      stat: d.stat,
      xp: d.xp,
      gold: d.gold,
      totalSeconds: d.seconds,
      secondsLeft: d.seconds,
      status: 'running',
    });
  }
  function pauseDungeon() {
    setActiveDungeon((cur) => (cur ? { ...cur, status: 'paused' } : cur));
  }
  function resumeDungeon() {
    setActiveDungeon((cur) => (cur ? { ...cur, status: 'running' } : cur));
  }
  function abandonDungeon() {
    setActiveDungeon(null);
  }
  function finishDungeonNow() {
    if (activeDungeon) handleDungeonCleared(activeDungeon);
  }
  function addDungeon() {
    if (!data || !dTitle.trim()) return;
    const diff = DUNGEON_DIFFICULTIES[dDiff];
    const dur = DURATIONS[dDuration];
    const dungeon = {
      id: 'cd' + Date.now(),
      name: dTitle.trim(),
      desc: `${dur.label} sans lâcher`,
      stat: dStat,
      seconds: dur.seconds,
      xp: diff.xp,
      gold: diff.gold,
    };
    persist({ ...data, dungeons: [...data.dungeons, dungeon] });
    setDTitle('');
    setAddDungeonOpen(false);
  }
  function deleteDungeon(id) {
    if (!data) return;
    persist({ ...data, dungeons: data.dungeons.filter((d) => d.id !== id) });
  }

  function joinGuild(name) {
    const trimmed = (name || '').trim();
    if (!trimmed || !data) return;
    persist({ ...data, guildName: trimmed });
    setGuildInput('');
    refreshGuild(trimmed);
  }
  async function leaveGuild() {
    if (!data || !data.guildName || !session) return;
    try {
      await supabase.from('guild_members').delete().eq('user_id', session.user.id);
    } catch (e) {
      // suppression indisponible
    }
    persist({ ...data, guildName: null });
    setGuildMembers([]);
  }
  async function refreshGuild(name) {
    setGuildLoading(true);
    try {
      const { data: rows } = await supabase
        .from('guild_members')
        .select('name, level, rank, streak')
        .eq('guild_name', name);
      setGuildMembers(rows || []);
    } catch (e) {
      setGuildMembers([]);
    } finally {
      setGuildLoading(false);
    }
  }

  const globalStyle = (
    <style>{`
      @keyframes hs-fade-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes hs-flash { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
      .hs-toast { animation: hs-fade-in 0.25s ease-out; }
      .hs-bar-fill { background-image: linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent); background-size: 16px 16px; }
      .hs-tab-btn { transition: color 0.15s ease, border-color 0.15s ease; }
      .hs-quest-row { transition: opacity 0.2s ease; }
      * { font-family: 'Rajdhani', sans-serif; box-sizing: border-box; }
      input::placeholder { color: ${C.textFaint}; }
    `}</style>
  );

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center w-full" style={{ background: C.bg, color: C.textMuted, minHeight: '100vh' }}>
        {globalStyle}
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center w-full px-4" style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
        {globalStyle}
        <div className="w-full max-w-sm p-5" style={hudPanel(true)}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} style={{ color: C.accent }} />
            <span className="text-xs" style={{ fontFamily: "'Orbitron', sans-serif", color: C.textMuted, letterSpacing: '0.2em' }}>
              SYSTEM
            </span>
          </div>
          <div className="text-lg font-bold mb-4">
            {authMode === 'login' ? 'Connexion' : 'Créer un compte'}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              className="px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Mot de passe"
              className="px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            {authError && <div className="text-xs" style={{ color: C.danger }}>{authError}</div>}
            {authInfo && <div className="text-xs" style={{ color: C.success }}>{authInfo}</div>}
            <button
              onClick={handleAuth}
              disabled={authLoading}
              className="py-2 text-sm font-semibold mt-1 flex items-center justify-center gap-2"
              style={{ background: C.accent, color: '#0A0E1A' }}
            >
              {authLoading && <Loader2 className="animate-spin" size={14} />}
              {authMode === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
                setAuthInfo('');
              }}
              className="text-xs mt-1"
              style={{ color: C.textMuted }}
            >
              {authMode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center w-full" style={{ background: C.bg, color: C.textMuted, minHeight: '100vh' }}>
        {globalStyle}
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const { character, quests, shop, dungeons, settings } = data;
  const rank = getRank(character.level);
  const needed = xpForLevel(character.level);
  const xpPct = Math.min(100, Math.round((character.xp / needed) * 100));
  const doneCount = quests.filter((q) => q.completed).length;

  const TABS = [
    { id: 'status', label: 'Statut', icon: UserRound },
    { id: 'quests', label: 'Quêtes', icon: ListChecks },
    { id: 'dungeon', label: 'Donjon', icon: Swords },
    { id: 'shop', label: 'Boutique', icon: ShoppingBag },
    { id: 'guild', label: 'Guilde', icon: Users },
  ];

  return (
    <div className="w-full flex flex-col" style={{ background: C.bg, color: C.text, minHeight: '100vh' }}>
      {globalStyle}

      {flash && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center" style={{ animation: 'hs-flash 1.3s ease-out forwards' }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at center, ${C.accent}33, transparent 70%)` }} />
          <div className="relative text-2xl tracking-wide" style={{ fontFamily: "'Orbitron', sans-serif", color: C.accent, textShadow: `0 0 20px ${C.accent}` }}>
            NIVEAU SUPÉRIEUR
          </div>
        </div>
      )}

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center max-w-sm" style={{ width: '92%' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="hs-toast px-4 py-2 text-sm font-semibold rounded-sm w-full text-center"
            style={{
              background: C.panel,
              border: `1px solid ${t.kind === 'level' ? C.gold : t.kind === 'reward' ? C.success : C.accent}`,
              color: t.kind === 'level' ? C.gold : t.kind === 'reward' ? C.success : C.text,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>

      <div className="px-4 pt-5 pb-3 max-w-xl w-full mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: C.accent }} />
          <span className="text-xs" style={{ fontFamily: "'Orbitron', sans-serif", color: C.textMuted, letterSpacing: '0.2em' }}>
            SYSTEM
          </span>
          <button onClick={handleSignOut} className="ml-auto flex items-center gap-1 text-xs" style={{ color: C.textMuted }}>
            <LogOut size={13} /> Déconnexion
          </button>
        </div>

        <div className="p-4" style={hudPanel(false)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <input
                value={character.name}
                onChange={(e) => updateName(e.target.value)}
                className="bg-transparent outline-none text-lg font-bold w-full"
                style={{ color: C.text, borderBottom: '1px solid transparent' }}
                onFocus={(e) => (e.target.style.borderBottom = `1px solid ${C.border}`)}
                onBlur={(e) => (e.target.style.borderBottom = '1px solid transparent')}
                maxLength={20}
              />
              <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                Niveau {character.level}
              </div>
            </div>
            <div
              className="flex items-center justify-center shrink-0 w-11 h-11 font-bold text-lg"
              style={{ ...hudPanel(true), fontFamily: "'Orbitron', sans-serif", color: C.accent }}
            >
              {rank}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: C.textMuted }}>
              <span>XP</span>
              <span>{character.xp} / {needed}</span>
            </div>
            <div className="h-2.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full hs-bar-fill" style={{ width: `${xpPct}%`, background: C.accent, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5" style={{ color: C.gold }}>
              <Coins size={15} />
              <span className="font-semibold">{character.gold}</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: character.streak > 0 ? '#F0824C' : C.textFaint }}>
              <Flame size={15} />
              <span className="font-semibold">{character.streak}j</span>
            </div>
            <div className="text-xs ml-auto" style={{ color: C.textMuted }}>
              {doneCount}/{quests.length} quêtes aujourd'hui
            </div>
          </div>
        </div>
      </div>

      {reminderBanner !== null && (
        <div className="mx-4 mb-3 max-w-xl w-full self-center px-3 py-2 flex items-center gap-2 text-sm" style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}`, color: C.gold }}>
          <Bell size={14} />
          <span className="flex-1">{reminderBanner} quête{reminderBanner > 1 ? 's' : ''} t'attendent encore aujourd'hui</span>
          <button onClick={() => setReminderBanner(null)}><X size={14} /></button>
        </div>
      )}

      <div className="px-4 mb-3 overflow-x-auto max-w-xl w-full mx-auto">
        <div className="flex gap-1 w-max">
          {TABS.map((tItem) => {
            const Icon = tItem.icon;
            const active = tab === tItem.id;
            return (
              <button
                key={tItem.id}
                onClick={() => setTab(tItem.id)}
                className="hs-tab-btn flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-semibold border-b-2 whitespace-nowrap"
                style={{ color: active ? C.accent : C.textMuted, borderColor: active ? C.accent : 'transparent' }}
              >
                <Icon size={15} />
                {tItem.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-8 flex-1 max-w-xl w-full mx-auto">
        {tab === 'status' && (
          <div className="flex flex-col gap-3">
            {character.statPoints > 0 && (
              <div className="px-3 py-2 text-sm text-center font-semibold" style={{ background: C.accentSoft, border: `1px solid ${C.border}`, color: C.accent }}>
                {character.statPoints} point{character.statPoints > 1 ? 's' : ''} de stat à distribuer
              </div>
            )}
            {Object.entries(STAT_META).map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <div key={key} className="p-3 flex items-center gap-3" style={hudPanel(false)}>
                  <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: `${meta.color}22`, color: meta.color, borderRadius: 2 }}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1"><div className="text-sm font-semibold">{meta.label}</div></div>
                  <div className="text-lg font-bold w-8 text-right" style={{ fontFamily: "'Orbitron', sans-serif", color: C.text }}>
                    {character.stats[key]}
                  </div>
                  {character.statPoints > 0 && (
                    <button onClick={() => allocateStat(key)} className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}` }}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="p-3 flex items-center gap-3" style={hudPanel(false)}>
              <Bell size={16} style={{ color: C.accent }} />
              <div className="flex-1 text-sm font-semibold">Rappel quotidien</div>
              <select
                value={settings.reminderHour === null ? '' : settings.reminderHour}
                onChange={(e) => setReminderHour(e.target.value)}
                className="px-2 py-1 text-sm outline-none"
                style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}
              >
                <option value="">Désactivé</option>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tab === 'quests' && (
          <div className="flex flex-col gap-2">
            {quests.length === 0 && (
              <div className="text-sm text-center py-6" style={{ color: C.textMuted }}>Aucune quête. Ajoute-en une pour commencer.</div>
            )}
            {quests.map((q) => {
              const meta = STAT_META[q.stat];
              const Icon = meta.icon;
              return (
                <div key={q.id} className="hs-quest-row p-3 flex items-center gap-3" style={{ ...hudPanel(false), opacity: q.completed ? 0.5 : 1 }}>
                  <button
                    onClick={() => completeQuest(q.id)}
                    disabled={q.completed}
                    className="w-8 h-8 flex items-center justify-center shrink-0"
                    style={{ background: q.completed ? `${C.success}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${q.completed ? C.success : C.border}`, color: q.completed ? C.success : C.textMuted }}
                  >
                    <Check size={15} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ textDecoration: q.completed ? 'line-through' : 'none' }}>{q.title}</div>
                    <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: C.textMuted }}>
                      <Icon size={11} style={{ color: meta.color }} />
                      <span>{meta.label}</span><span>· +{q.xp} XP</span><span>· +{q.gold} or</span>
                    </div>
                  </div>
                  <button onClick={() => deleteQuest(q.id)} className="w-6 h-6 flex items-center justify-center shrink-0" style={{ color: C.textFaint }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}

            {addQuestOpen ? (
              <div className="p-3 flex flex-col gap-2 mt-1" style={hudPanel(true)}>
                <input value={qTitle} onChange={(e) => setQTitle(e.target.value)} placeholder="Nom de la quête" className="px-2 py-1.5 text-sm bg-transparent outline-none" style={fieldStyle} maxLength={40} autoFocus />
                <div className="flex gap-2">
                  <select value={qStat} onChange={(e) => setQStat(e.target.value)} className="flex-1 px-2 py-1.5 text-sm outline-none" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                    {Object.entries(STAT_META).map(([key, meta]) => (<option key={key} value={key}>{meta.label}</option>))}
                  </select>
                  <select value={qDiff} onChange={(e) => setQDiff(Number(e.target.value))} className="flex-1 px-2 py-1.5 text-sm outline-none" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                    {DIFFICULTIES.map((d, i) => (<option key={i} value={i}>{d.label}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 mt-1">
                  <button onClick={addQuest} className="flex-1 py-1.5 text-sm font-semibold" style={{ background: C.accent, color: '#0A0E1A' }}>Ajouter</button>
                  <button onClick={() => setAddQuestOpen(false)} className="px-3 py-1.5 text-sm" style={{ color: C.textMuted, border: `1px solid ${C.border}` }}>Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddQuestOpen(true)} className="mt-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
                <Plus size={15} /> Ajouter une quête
              </button>
            )}
          </div>
        )}

        {tab === 'dungeon' && (
          <div className="flex flex-col gap-2">
            {activeDungeon && (
              <div className="p-4 mb-1" style={hudPanel(true)}>
                <div className="text-xs" style={{ color: C.textMuted }}>{activeDungeon.desc}</div>
                <div className="text-base font-bold mt-0.5">{activeDungeon.name}</div>
                <div className="text-3xl font-bold text-center my-3" style={{ fontFamily: "'Orbitron', sans-serif", color: C.accent }}>
                  {formatTime(activeDungeon.secondsLeft)}
                </div>
                <div className="h-2.5 w-full mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full" style={{ width: `${(activeDungeon.secondsLeft / activeDungeon.totalSeconds) * 100}%`, background: C.danger, transition: 'width 1s linear' }} />
                </div>
                <div className="flex gap-2">
                  {activeDungeon.status === 'running' ? (
                    <button onClick={pauseDungeon} className="flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}` }}>
                      <Pause size={14} /> Pause
                    </button>
                  ) : (
                    <button onClick={resumeDungeon} className="flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}` }}>
                      <Play size={14} /> Reprendre
                    </button>
                  )}
                  <button onClick={finishDungeonNow} className="flex-1 py-2 text-sm font-semibold" style={{ background: C.success, color: '#0A0E1A' }}>J'ai terminé</button>
                  <button onClick={abandonDungeon} className="px-3 py-2" style={{ color: C.danger, border: `1px solid ${C.danger}` }}><Ban size={15} /></button>
                </div>
              </div>
            )}

            {dungeons.map((d) => {
              const meta = STAT_META[d.stat];
              const Icon = meta.icon;
              return (
                <div key={d.id} className="p-3 flex items-center gap-3" style={{ ...hudPanel(false), opacity: activeDungeon ? 0.5 : 1 }}>
                  <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: `${meta.color}22`, color: meta.color, borderRadius: 2 }}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.name}</div>
                    <div className="text-xs" style={{ color: C.textMuted }}>{d.desc} · {formatTime(d.seconds)} · +{d.xp} XP · +{d.gold} or</div>
                  </div>
                  <button onClick={() => startDungeon(d)} disabled={!!activeDungeon} className="px-3 py-1.5 text-xs font-semibold shrink-0" style={{ background: activeDungeon ? 'rgba(255,255,255,0.05)' : C.accent, color: activeDungeon ? C.textFaint : '#0A0E1A' }}>
                    Entrer
                  </button>
                  <button onClick={() => deleteDungeon(d.id)} className="w-6 h-6 flex items-center justify-center shrink-0" style={{ color: C.textFaint }}><X size={14} /></button>
                </div>
              );
            })}

            {addDungeonOpen ? (
              <div className="p-3 flex flex-col gap-2 mt-1" style={hudPanel(true)}>
                <input value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="Nom du donjon" className="px-2 py-1.5 text-sm bg-transparent outline-none" style={fieldStyle} maxLength={40} autoFocus />
                <div className="flex gap-2">
                  <select value={dStat} onChange={(e) => setDStat(e.target.value)} className="flex-1 px-2 py-1.5 text-sm outline-none" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                    {Object.entries(STAT_META).map(([key, meta]) => (<option key={key} value={key}>{meta.label}</option>))}
                  </select>
                  <select value={dDuration} onChange={(e) => setDDuration(Number(e.target.value))} className="flex-1 px-2 py-1.5 text-sm outline-none" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                    {DURATIONS.map((du, i) => (<option key={i} value={i}>{du.label}</option>))}
                  </select>
                </div>
                <select value={dDiff} onChange={(e) => setDDiff(Number(e.target.value))} className="px-2 py-1.5 text-sm outline-none" style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                  {DUNGEON_DIFFICULTIES.map((d, i) => (<option key={i} value={i}>{d.label} · +{d.xp} XP</option>))}
                </select>
                <div className="flex gap-2 mt-1">
                  <button onClick={addDungeon} className="flex-1 py-1.5 text-sm font-semibold" style={{ background: C.accent, color: '#0A0E1A' }}>Ajouter</button>
                  <button onClick={() => setAddDungeonOpen(false)} className="px-3 py-1.5 text-sm" style={{ color: C.textMuted, border: `1px solid ${C.border}` }}>Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddDungeonOpen(true)} className="mt-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
                <Plus size={15} /> Ajouter un donjon
              </button>
            )}
          </div>
        )}
        
        {tab === 'shop' && (
          <div className="flex flex-col gap-2">
            {shop.map((item) => {
              const affordable = character.gold >= item.cost;
              return (
                <div key={item.id} className="p-3 flex items-center gap-3" style={hudPanel(false)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{item.title}</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: C.gold }}><Coins size={11} /> {item.cost}</div>
                  </div>
                  <button onClick={() => buyReward(item)} disabled={!affordable} className="px-3 py-1.5 text-xs font-semibold shrink-0" style={{ background: affordable ? C.accent : 'rgba(255,255,255,0.05)', color: affordable ? '#0A0E1A' : C.textFaint }}>
                    Échanger
                  </button>
                  <button onClick={() => deleteReward(item.id)} className="w-6 h-6 flex items-center justify-center shrink-0" style={{ color: C.textFaint }}><X size={14} /></button>
                </div>
              );
            })}

            {addRewardOpen ? (
              <div className="p-3 flex flex-col gap-2 mt-1" style={hudPanel(true)}>
                <input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="Nom de la récompense" className="px-2 py-1.5 text-sm bg-transparent outline-none" style={fieldStyle} maxLength={40} autoFocus />
                <input type="number" value={rCost} onChange={(e) => setRCost(e.target.value)} placeholder="Coût en or" min={1} className="px-2 py-1.5 text-sm bg-transparent outline-none" style={fieldStyle} />
                <div className="flex gap-2 mt-1">
                  <button onClick={addReward} className="flex-1 py-1.5 text-sm font-semibold" style={{ background: C.accent, color: '#0A0E1A' }}>Ajouter</button>
                  <button onClick={() => setAddRewardOpen(false)} className="px-3 py-1.5 text-sm" style={{ color: C.textMuted, border: `1px solid ${C.border}` }}>Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddRewardOpen(true)} className="mt-1 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px dashed ${C.border}`, color: C.textMuted }}>
                <Plus size={15} /> Ajouter une récompense
              </button>
            )}
          </div>
        )}

        {tab === 'guild' && (
          <div className="flex flex-col gap-3">
            <div className="text-xs" style={{ color: C.textMuted }}>
              En rejoignant une guilde, ton pseudo, ton niveau, ton rang et ta série deviennent visibles par toute personne utilisant le même nom de guilde.
            </div>
            {!data.guildName ? (
              <div className="p-3 flex flex-col gap-2" style={hudPanel(false)}>
                <input value={guildInput} onChange={(e) => setGuildInput(e.target.value)} placeholder="Nom de la guilde" className="px-2 py-1.5 text-sm bg-transparent outline-none" style={fieldStyle} maxLength={24} />
                <button onClick={() => joinGuild(guildInput)} className="py-1.5 text-sm font-semibold" style={{ background: C.accent, color: '#0A0E1A' }}>Rejoindre / créer</button>
              </div>
            ) : (
              <>
                <div className="p-3 flex items-center justify-between" style={hudPanel(true)}>
                  <div>
                    <div className="text-xs" style={{ color: C.textMuted }}>Guilde</div>
                    <div className="text-sm font-bold">{data.guildName}</div>
                  </div>
                  <button onClick={leaveGuild} className="px-3 py-1.5 text-xs" style={{ color: C.danger, border: `1px solid ${C.danger}` }}>Quitter</button>
                </div>
                <button onClick={() => refreshGuild(data.guildName)} className="text-xs self-start" style={{ color: C.accent }}>Actualiser le classement</button>
                {guildLoading && <div className="text-xs text-center py-4" style={{ color: C.textMuted }}>Chargement…</div>}
                {!guildLoading && guildMembers.length === 0 && (
                  <div className="text-xs text-center py-4" style={{ color: C.textMuted }}>Personne d'autre pour l'instant. Partage le nom de la guilde !</div>
                )}
                {!guildLoading && guildMembers.slice().sort((a, b) => b.level - a.level).map((m, i) => (
                  <div key={i} className="p-3 flex items-center gap-3" style={hudPanel(false)}>
                    <div className="w-8 h-8 flex items-center justify-center font-bold text-sm shrink-0" style={{ ...hudPanel(false), fontFamily: "'Orbitron', sans-serif", color: C.accent }}>{m.rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{m.name}</div>
                      <div className="text-xs" style={{ color: C.textMuted }}>Niveau {m.level}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: m.streak > 0 ? '#F0824C' : C.textFaint }}><Flame size={12} /> {m.streak}j</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
                }
