// グローバル変数
let currentView = 'list';
let editingId = null;
let deleteId = null;
let currentPeriod = 'thisMonth';
let currentImageData = null; // 現在選択されている画像データ
let betData = []; // すべての馬券データを保存する配列
let betInputCounter = 0; // 買い目入力行のカウンター
let currentUser = null; // Supabase 認証済みユーザー
let currentProfile = null; // Supabase profiles 拡張情報
let authStateSubscription = null;
let betDataLoaded = false;
let authMode = 'sign-in';

let currentSourceFilter = 'all';
let currentTrackFilter = 'all';
let currentGroupMode = 'monthly';
let currentComparisonMode = 'source';

// 券種のリスト
const betTypes = [
    '単勝', '複勝', '枠連', '枠単', '枠複', '馬連', '馬単', 'ワイド', 
    '3連複', '3連単', 'その他'
];

const trackOptions = [
    '札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉',
    '門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋',
    '園田', '姫路', '高知', '佐賀', '帯広'
];

const PLAN_FEATURES = {
    free: {
        label: 'フリープラン',
        maxBets: null,
        ocrEnabled: false,
        aiAssistEnabled: false
    },
    premium: {
        label: 'プレミアムプラン',
        maxBets: null,
        ocrEnabled: true,
        aiAssistEnabled: true
    },
    admin: {
        label: '管理者',
        maxBets: null,
        ocrEnabled: true,
        aiAssistEnabled: true
    },
    local: {
        label: 'ローカルモード',
        maxBets: null,
        ocrEnabled: true,
        aiAssistEnabled: true
    }
};

const FEATURE_MESSAGES = {
    ocrEnabled: '画像のOCR解析はプレミアムプラン限定の機能です。',
    aiAssistEnabled: 'AIによる買い目補助はプレミアムプラン限定の機能です。',
    maxBets: (limit) => `保存できる馬券データはフリープランでは${limit}件までです。`
};

const VISION_API_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

function formatDebugValue(value) {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch (error) {
        return String(value);
    }
}

function debugLog(...parts) {
    console.log(...parts);
    const message = parts.map(formatDebugValue).join(' ');
    const logContainer = document.getElementById('ocr-debug-log');
    if (!logContainer) {
        return;
    }
    const entry = document.createElement('div');
    entry.className = 'debug-line';
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearDebugLog() {
    const logContainer = document.getElementById('ocr-debug-log');
    if (logContainer) {
        logContainer.innerHTML = '';
    }
}

function resolvePlan(role) {
    if (!window.supabaseClient) {
        return PLAN_FEATURES.local;
    }
    const normalizedRole = role && PLAN_FEATURES[role] ? role : 'free';
    return PLAN_FEATURES[normalizedRole] || PLAN_FEATURES.free;
}

function getCurrentPlan() {
    if (currentProfile && currentProfile.plan) {
        return currentProfile.plan;
    }
    if (!window.supabaseClient) {
        return PLAN_FEATURES.local;
    }
    return PLAN_FEATURES.free;
}

function isPlanEnforced() {
    return Boolean(window.supabaseClient && currentUser);
}

function normalizeProfile(profileInput) {
    if (!window.supabaseClient) {
        return {
            id: profileInput?.id || null,
            displayName: profileInput?.display_name || profileInput?.displayName || '',
            userRole: 'local',
            plan: PLAN_FEATURES.local
        };
    }

    if (!profileInput) {
        return {
            id: currentUser?.id || null,
            displayName: '',
            userRole: 'free',
            plan: PLAN_FEATURES.free
        };
    }

    const rawRole = profileInput.user_role ?? profileInput.userRole ?? 'free';
    const normalizedRole = PLAN_FEATURES[rawRole] ? rawRole : 'free';
    const displayName = profileInput.display_name
        ?? profileInput.displayName
        ?? profileInput.full_name
        ?? '';

    return {
        id: profileInput.id ?? currentUser?.id ?? null,
        displayName,
        userRole: normalizedRole,
        plan: resolvePlan(normalizedRole)
    };
}

function createDefaultProfile(user) {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email || '',
        user_role: 'free'
    };
}

function getFeatureMessage(featureKey, context) {
    const message = FEATURE_MESSAGES[featureKey];
    if (typeof message === 'function') {
        return message(context);
    }
    return message;
}

function setCurrentProfile(profileInput) {
    currentProfile = normalizeProfile(profileInput);
    renderPlanStatus();
}

function renderPlanStatus() {
    const planBadge = document.getElementById('auth-user-plan');
    const upgradeButton = document.getElementById('upgrade-plan-button');
    const plan = getCurrentPlan();
    const isAuthenticated = Boolean(currentUser);

    if (planBadge) {
        if (!isAuthenticated && window.supabaseClient) {
            planBadge.style.display = 'none';
        } else {
            planBadge.textContent = plan.label;
            planBadge.style.display = 'inline-flex';
            planBadge.dataset.plan = currentProfile?.userRole || (window.supabaseClient ? 'free' : 'local');
        }
    }

    if (upgradeButton) {
        const shouldShowUpgrade = Boolean(currentUser) && currentProfile?.userRole === 'free';
        upgradeButton.style.display = shouldShowUpgrade ? 'inline-flex' : 'none';
    }

    updateFeatureAccessUI();
}

function updateFeatureAccessUI() {
    const dropZone = document.getElementById('image-drop-zone');
    const fileInput = document.getElementById('image-file-input');
    const ocrNotice = document.getElementById('ocr-plan-notice');
    const shouldDisableOcr = isPlanEnforced() && !isFeatureEnabled('ocrEnabled');

    if (dropZone) {
        dropZone.classList.toggle('feature-disabled', shouldDisableOcr);
        dropZone.setAttribute('aria-disabled', shouldDisableOcr ? 'true' : 'false');
    }

    if (fileInput) {
        fileInput.disabled = shouldDisableOcr;
    }

    if (ocrNotice) {
        ocrNotice.style.display = shouldDisableOcr ? 'block' : 'none';
    }
}

function isFeatureEnabled(featureKey) {
    if (!isPlanEnforced()) {
        return true;
    }
    const plan = getCurrentPlan();
    if (!plan || !(featureKey in plan)) {
        return true;
    }
    const value = plan[featureKey];
    return value === null || value === undefined ? true : Boolean(value);
}

function showPlanUpsell(featureKey) {
    if (!currentUser) {
        return;
    }

    const upgradeButton = document.getElementById('upgrade-plan-button');
    if (upgradeButton && currentProfile?.userRole === 'free') {
        upgradeButton.style.display = 'inline-flex';
        upgradeButton.classList.add('highlight');
        setTimeout(() => upgradeButton.classList.remove('highlight'), 1500);
    }

    if (featureKey === 'ocrEnabled') {
        const ocrNotice = document.getElementById('ocr-plan-notice');
        if (ocrNotice) {
            ocrNotice.style.display = 'block';
        }
    }
}

function isSupabaseReady() {
    return Boolean(window.supabaseClient && currentUser);
}

function mapRowToBet(row) {
    const betsArray = Array.isArray(row?.bets) ? row.bets : [];
    const totalPurchase = typeof row?.amount_bet === 'number' ? row.amount_bet : 0;
    const payout = typeof row?.amount_returned === 'number' ? row.amount_returned : 0;
    const raceDate = row?.race_date ? String(row.race_date) : null;
    const createdAt = row?.created_at ? new Date(row.created_at).getTime() : Date.now();

    return {
        id: row?.id,
        date: raceDate,
        source: row?.source || '不明',
        raceName: row?.race_name || '',
        track: row?.track || '',
        bets: betsArray,
        totalPurchase,
        payout,
        recoveryRate: totalPurchase > 0 ? (payout / totalPurchase) * 100 : 0,
        memo: row?.memo || '',
        imageData: row?.image_data || null,
        createdAt
    };
}

function buildBetPayload(bet) {
    const totalPurchase = bet.totalPurchase || 0;
    const payout = bet.payout || 0;
    const track = bet.track || null;

    return {
        user_id: currentUser?.id,
        race_date: bet.date || null,
        source: bet.source || 'unknown',
        race_name: bet.raceName || null,
        track,
        ticket_type: Array.isArray(bet.bets) && bet.bets.length === 1 ? bet.bets[0].type : 'multiple',
        amount_bet: totalPurchase,
        amount_returned: payout,
        memo: bet.memo || null,
        bets: Array.isArray(bet.bets) ? bet.bets : [],
        image_data: bet.imageData || null,
        recovery_rate: bet.recoveryRate ?? (totalPurchase > 0 ? (payout / totalPurchase) * 100 : 0)
    };
}

function sortBetData() {
    betData.sort((a, b) => {
        const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
        if (dateDiff !== 0) {
            return dateDiff;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function resetAuthForm() {
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.reset();
    }
    const displayNameGroup = document.getElementById('auth-display-name-group');
    const confirmPasswordGroup = document.getElementById('auth-confirm-password-group');
    if (displayNameGroup) displayNameGroup.style.display = 'none';
    if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
}

function resetPasswordForm() {
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.reset();
    }
}

function showResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) {
        modal.style.display = 'flex';
        const emailInput = document.getElementById('reset-email');
        if (emailInput) {
            setTimeout(() => emailInput.focus(), 0);
        }
    }
}

function hideResetModal(showLogin = false) {
    const modal = document.getElementById('reset-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    resetPasswordForm();
    if (showLogin) {
        setAuthMode('sign-in');
        showAuthModal();
    }
}

// 認証UI制御 ---------------------------------------------------------------
function setAuthMode(mode) {
    authMode = mode;
    const title = document.getElementById('auth-modal-title');
    const submitButton = document.getElementById('auth-submit-button');
    const hint = document.getElementById('auth-hint');
    const switchButton = document.getElementById('auth-switch-button');
    const displayNameGroup = document.getElementById('auth-display-name-group');
    const confirmPasswordGroup = document.getElementById('auth-confirm-password-group');
    const passwordInput = document.getElementById('auth-password');
    const confirmPasswordInput = document.getElementById('auth-password-confirm');
    const resetLink = document.getElementById('auth-reset-link');
    const note = document.getElementById('auth-note');

    if (mode === 'sign-up') {
        if (title) title.textContent = '新規登録';
        if (submitButton) submitButton.textContent = '登録する';
        if (hint) hint.textContent = '登録に使用するメールアドレスとパスワードを入力してください。';
        if (note) note.textContent = '登録後、確認メールが送信されます。リンクからアカウントを有効化してください。';
        if (switchButton) switchButton.textContent = 'ログインはこちら';
        if (displayNameGroup) displayNameGroup.style.display = 'block';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'block';
        if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
        if (confirmPasswordInput) confirmPasswordInput.setAttribute('required', 'required');
        if (resetLink) resetLink.style.display = 'none';
    } else {
        if (title) title.textContent = 'ログイン';
        if (submitButton) submitButton.textContent = 'ログイン';
        if (hint) hint.textContent = '登録済みのメールアドレスとパスワードを入力してください。';
        if (note) note.textContent = 'パスワードをお忘れの場合は再設定リンクをご利用ください。';
        if (switchButton) switchButton.textContent = '新規登録はこちら';
        if (displayNameGroup) displayNameGroup.style.display = 'none';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
        if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
        if (confirmPasswordInput) confirmPasswordInput.removeAttribute('required');
        if (resetLink) resetLink.style.display = 'inline';
    }
}

function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        setAuthMode(authMode);
        modal.style.display = 'flex';
        const targetInputId = authMode === 'sign-up' ? 'auth-display-name' : 'auth-email';
        const targetInput = document.getElementById(targetInputId) || document.getElementById('auth-email');
        if (targetInput) {
            setTimeout(() => targetInput.focus(), 0);
        }
    }
}

function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    resetAuthForm();
    setAuthMode('sign-in');
}

function setAppAccess(isAuthenticated) {
    const guard = document.getElementById('auth-guard');
    const content = document.getElementById('app-content');
    if (guard) {
        guard.style.display = isAuthenticated ? 'none' : 'flex';
    }
    if (content) {
        content.style.display = isAuthenticated ? 'block' : 'none';
    }
}

function updateAuthUI(user) {
    const emailDisplay = document.getElementById('auth-user-email');
    const signInButton = document.getElementById('sign-in-button');
    const signOutButton = document.getElementById('sign-out-button');
    const signUpButton = document.getElementById('sign-up-button');

    if (emailDisplay) {
        const emailText = user?.email || '未ログイン';
        emailDisplay.textContent = emailText;
        emailDisplay.classList.toggle('is-authenticated', Boolean(user));
    }

    if (signInButton) {
        signInButton.style.display = user ? 'none' : 'inline-flex';
    }

    if (signOutButton) {
        signOutButton.style.display = user ? 'inline-flex' : 'none';
    }

    if (signUpButton) {
        signUpButton.style.display = user ? 'none' : 'inline-flex';
    }

    renderPlanStatus();
    setAppAccess(Boolean(user));
}

function setCurrentUser(user) {
    currentUser = user;
    if (user) {
        setCurrentProfile(createDefaultProfile(user));
    } else {
        setCurrentProfile(null);
    }
    updateAuthUI(user);
    if (user) {
        hideAuthModal();
        betDataLoaded = false;
        refreshCurrentProfile(user).catch((error) => {
            console.error('プロフィール情報の取得に失敗しました:', error);
        });
        loadDataList()
            .then(() => loadStats())
            .catch((error) => {
                console.error('初期データ読み込み中にエラーが発生しました:', error);
            });
    } else {
        betData = [];
        betDataLoaded = true;
        currentImageData = null;
        loadDataList()
            .then(() => loadStats())
            .catch(() => {});
    }
}

async function refreshCurrentProfile(user) {
    if (!window.supabaseClient || !user) {
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, user_role')
            .eq('id', user.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (data) {
            setCurrentProfile(data);
        }
    } catch (error) {
        throw error;
    }
}

async function handleAuthFormSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const submitButton = document.getElementById('auth-submit-button');
    const displayNameInput = document.getElementById('auth-display-name');
    const confirmPasswordInput = document.getElementById('auth-password-confirm');

    if (!emailInput || !passwordInput || !submitButton) {
        console.error('認証フォームの要素が見つかりません');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const displayName = displayNameInput ? displayNameInput.value.trim() : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    if (!email || !password) {
        showToast('メールアドレスとパスワードを入力してください', 'error');
        return;
    }

    if (!window.supabaseClient) {
        console.error('Supabase クライアントが初期化されていません');
        showToast('ログイン処理を実行できませんでした', 'error');
        return;
    }

    if (authMode === 'sign-up') {
        if (password.length < 6) {
            showToast('パスワードは6文字以上にしてください', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showToast('パスワードが一致しません', 'error');
            return;
        }
    }

    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = '処理中...';

    try {
        if (authMode === 'sign-up') {
            const redirectOrigin = typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')
                ? window.location.origin
                : undefined;

            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName || null
                    },
                    emailRedirectTo: redirectOrigin
                }
            });

            if (error) {
                console.error('サインアップエラー:', error);
                showToast(error.message || '登録に失敗しました', 'error');
                return;
            }

            if (data?.session?.user) {
                showToast('登録が完了しました', 'success');
            } else {
                showToast('確認メールを送信しました。メールをご確認ください。', 'info');
            }

            hideAuthModal();
            return;
        } else {
            const { error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('ログインエラー:', error);
                showToast(error.message || 'ログインに失敗しました', 'error');
                return;
            }

            emailInput.value = '';
            passwordInput.value = '';
            hideAuthModal();
        }
    } catch (err) {
        console.error('ログイン処理中にエラーが発生しました:', err);
        showToast('処理中に問題が発生しました', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

async function handleResetFormSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('reset-email');
    const submitButton = document.getElementById('reset-submit-button');

    if (!emailInput || !submitButton) {
        console.error('パスワード再設定フォームの要素が見つかりません');
        return;
    }

    const email = emailInput.value.trim();
    if (!email) {
        showToast('メールアドレスを入力してください', 'error');
        return;
    }

    if (!window.supabaseClient) {
        console.error('Supabase クライアントが初期化されていません');
        showToast('再設定処理を実行できませんでした', 'error');
        return;
    }

    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = '送信中...';

    try {
        const redirectOrigin = (typeof window !== 'undefined' &&
            window.location &&
            window.location.origin &&
            window.location.origin.startsWith('http'))
            ? window.location.origin
            : undefined;

        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: redirectOrigin
        });

        if (error) {
            console.error('パスワード再設定エラー:', error);
            showToast(error.message || '再設定メールの送信に失敗しました', 'error');
            return;
        }

        showToast('再設定メールを送信しました。メールをご確認ください。', 'info');
        hideResetModal();
    } catch (err) {
        console.error('パスワード再設定中にエラーが発生しました:', err);
        showToast('再設定手続き中に問題が発生しました', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

function initializeAuthUI() {
    const signInButton = document.getElementById('sign-in-button');
    const signOutButton = document.getElementById('sign-out-button');
    const signUpButton = document.getElementById('sign-up-button');
    const cancelButton = document.getElementById('auth-cancel-button');
    const authForm = document.getElementById('auth-form');
    const authModal = document.getElementById('auth-modal');
    const switchButton = document.getElementById('auth-switch-button');
    const guardLoginButton = document.getElementById('auth-guard-login-button');
    const resetLink = document.getElementById('auth-reset-link');
    const resetModal = document.getElementById('reset-modal');
    const resetCancelButton = document.getElementById('reset-cancel-button');
    const resetForm = document.getElementById('reset-form');

    setAppAccess(Boolean(currentUser));

    if (signInButton) {
        signInButton.addEventListener('click', (event) => {
            event.preventDefault();
            setAuthMode('sign-in');
            showAuthModal();
        });
    }

    if (signUpButton) {
        signUpButton.addEventListener('click', (event) => {
            event.preventDefault();
            setAuthMode('sign-up');
            showAuthModal();
        });
    }

    if (signOutButton) {
        signOutButton.addEventListener('click', async (event) => {
            event.preventDefault();
            if (!window.supabaseClient) {
                showToast('Supabaseクライアントが準備できていません', 'error');
                return;
            }
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) {
                console.error('ログアウトエラー:', error);
                showToast('ログアウトに失敗しました', 'error');
            }
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            hideAuthModal();
        });
    }

    if (authModal) {
        authModal.addEventListener('click', (event) => {
            if (event.target === authModal) {
                hideAuthModal();
            }
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', handleAuthFormSubmit);
    }

    if (switchButton) {
        switchButton.addEventListener('click', (event) => {
            event.preventDefault();
            const nextMode = authMode === 'sign-in' ? 'sign-up' : 'sign-in';
            setAuthMode(nextMode);
            const nextFocusId = nextMode === 'sign-up' ? 'auth-display-name' : 'auth-email';
            const nextFocus = document.getElementById(nextFocusId);
            if (nextFocus) {
                setTimeout(() => nextFocus.focus(), 0);
            }
        });
    }

    if (guardLoginButton) {
        guardLoginButton.addEventListener('click', (event) => {
            event.preventDefault();
            setAuthMode('sign-in');
            showAuthModal();
        });
    }

    if (resetLink) {
        resetLink.addEventListener('click', (event) => {
            event.preventDefault();
            hideAuthModal();
            showResetModal();
        });
    }

    if (resetCancelButton) {
        resetCancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            hideResetModal(true);
        });
    }

    if (resetModal) {
        resetModal.addEventListener('click', (event) => {
            if (event.target === resetModal) {
                hideResetModal(true);
            }
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', handleResetFormSubmit);
    }
}

async function initializeAuth() {
    setAuthMode('sign-in');
    initializeAuthUI();

    if (!window.supabaseClient) {
        console.warn('Supabase クライアントが利用できません。config.js を確認してください。');
        updateAuthUI(null);
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error) {
            console.error('セッション取得エラー:', error);
        }
        setCurrentUser(data?.session?.user || null);
    } catch (err) {
        console.error('セッション確認中にエラーが発生しました:', err);
    }

    if (authStateSubscription) {
        authStateSubscription.unsubscribe();
        authStateSubscription = null;
    }

    const { data: listener } = window.supabaseClient.auth.onAuthStateChange(
        (event, session) => {
            const previousUserId = currentUser ? currentUser.id : null;
            const nextUser = session?.user || null;
            setCurrentUser(nextUser);

            if (event === 'SIGNED_IN' && nextUser && nextUser.id !== previousUserId) {
                showToast('ログインしました', 'success');
            } else if (event === 'SIGNED_OUT' && previousUserId) {
                showToast('ログアウトしました', 'info');
            } else if (event === 'USER_UPDATED') {
                showToast('プロフィールを更新しました', 'success');
            }
        }
    );

    authStateSubscription = listener?.subscription || null;

    if (authStateSubscription) {
        window.addEventListener('beforeunload', () => {
            authStateSubscription?.unsubscribe();
        }, { once: true });
    }
}


function normalizeOcrText(rawText) {
    if (!rawText) {
        return '';
    }
    let normalized = rawText;

    const replacements = [
        [/三較/g, '三連'],
        [/三練/g, '三連'],
        [/三鎌/g, '三連'],
        [/三絵/g, '三連'],
        [/馬ノ/g, '馬の'],
        [/￥/g, '円']
    ];
    replacements.forEach(([pattern, value]) => {
        normalized = normalized.replace(pattern, value);
    });

    normalized = normalized.replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFF10 + 48));
    normalized = normalized.replace(/[Ａ-Ｚ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFF21 + 65));
    normalized = normalized.replace(/[ａ-ｚ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFF41 + 97));
    normalized = normalized.replace(/[／⁄]/g, '/');

    // 3連単・3連複の馬番で区切りが落ちた場合に補う（例: 2っ56 -> 2っ5っ6）
    normalized = normalized.replace(/(\d)[っつづッﾂ](\d)(?=\d)/g, '$1っ$2っ');
    normalized = normalized.replace(/\|(?=\d)/g, ' ');
    normalized = normalized.replace(/\|(?!\s)/g, ' | ');

    normalized = normalized.replace(/ＳＰＡＴ/g, 'SPAT');
    normalized = normalized.replace(/ｓｐａｔ/g, 'spat');

    return normalized;
}

// 買い目入力行を追加する関数
function addBetInputRow(selectedType = '', numbers = '', amount = 100) {
    betInputCounter++;
    const container = document.getElementById('bet-inputs-container');
    
    const row = document.createElement('div');
    row.className = 'bet-input-row';
    row.setAttribute('data-bet-id', betInputCounter);
    
    const typeOptions = betTypes.map(type => 
        `<option value="${type}" ${type === selectedType ? 'selected' : ''}>${type}</option>`
    ).join('');
    
    row.innerHTML = `
        <div class="bet-input-group">
            <label>券種</label>
            <select class="bet-type" required>
                <option value="">選択してください</option>
                ${typeOptions}
            </select>
        </div>
        <div class="bet-input-group">
            <label>馬番号</label>
            <input type="text" class="bet-numbers" placeholder="例: 1-2-3" value="${numbers}" required>
        </div>
        <div class="bet-input-group">
            <label>購入金額</label>
            <input type="number" class="bet-amount" min="100" step="100" value="${amount}" required>
        </div>
        <div class="bet-input-group">
            <button type="button" class="bet-remove-btn" title="この買い目を削除">削除</button>
        </div>
    `;
    
    container.appendChild(row);
    
    // 各入力フィールドにイベントリスナーを追加
    const amountInput = row.querySelector('.bet-amount');
    amountInput.addEventListener('input', updateTotalAmount);
    
    // 削除ボタンのイベントリスナー
    const deleteBtn = row.querySelector('.bet-remove-btn');
    deleteBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const rows = document.querySelectorAll('.bet-input-row');
        if (rows.length > 1) {
            row.remove();
            updateTotalAmount();
        } else {
            showToast('最低1つの買い目が必要です', 'error');
        }
    });
    
    updateTotalAmount();
    return row;
}

// 買い目行を作成する関数（OCR用）
function createBetRow() {
    return addBetInputRow();
}

// 買い目データを取得する関数
function getBetInputsData() {
    const rows = document.querySelectorAll('.bet-input-row');
    const betsData = [];
    
    rows.forEach(row => {
        const type = row.querySelector('.bet-type').value;
        const numbers = row.querySelector('.bet-numbers').value.trim();
        const amount = parseInt(row.querySelector('.bet-amount').value) || 0;
        
        if (type && numbers && amount > 0) {
            betsData.push({
                type: type,
                numbers: numbers,
                amount: amount
            });
        }
    });
    
    return betsData;
}

// サンプルデータで初期化
function initSampleData() {
    if (betData.length === 0) {
        betData = [
            {
                id: '1',
                date: '2025-10-20',
                source: '即pat',
                raceName: '東京11R 天皇賞',
                bets: [
                    { type: '単勝', numbers: '1', amount: 500 },
                    { type: '馬連', numbers: '1-2', amount: 200 },
                    { type: 'ワイド', numbers: '1-3', amount: 100 },
                    { type: 'ワイド', numbers: '1-4', amount: 100 }
                ],
                totalPurchase: 900,
                payout: 1500,
                recoveryRate: 166.7,
                memo: '本命1番が1着',
                createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000
            },
            {
                id: 2,
                date: '2025-10-21',
                source: 'Spat4',
                raceName: '川崎9R',
                bets: [
                    { type: '3連単', numbers: '2-5-7', amount: 100 },
                    { type: '3連複', numbers: '2-5-7', amount: 200 }
                ],
                totalPurchase: 300,
                payout: 0,
                recoveryRate: 0.0,
                memo: '外れ',
                createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000
            }
        ];
    }
}

// データ操作関数
async function ensureBetQuotaAllowsNewEntry() {
    if (!isPlanEnforced()) {
        return true;
    }

    const plan = getCurrentPlan();
    if (!plan || plan.maxBets === null || plan.maxBets === undefined) {
        return true;
    }

    if (!betDataLoaded) {
        await getAllBets();
    }

    const currentCount = Array.isArray(betData) ? betData.length : 0;
    if (currentCount >= plan.maxBets) {
        const message = getFeatureMessage('maxBets', plan.maxBets);
        if (message) {
            showToast(message, 'warning');
        }
        showPlanUpsell('maxBets');
        return false;
    }

    return true;
}

async function addBet(newBetData) {
    if (!(await ensureBetQuotaAllowsNewEntry())) {
        const plan = getCurrentPlan();
        const limit = plan?.maxBets;
        const message = getFeatureMessage('maxBets', limit) || '保存上限に達しました。';
        const error = new Error(message);
        error.code = 'plan_quota_reached';
        throw error;
    }

    if (!isSupabaseReady()) {
        const localId = Date.now().toString();
        newBetData.id = localId;
        newBetData.createdAt = Date.now();
        betData.push(newBetData);
        sortBetData();
        betDataLoaded = true;
        return localId;
    }

    try {
        const payload = buildBetPayload(newBetData);
        const { data, error } = await window.supabaseClient
            .from('bets')
            .insert(payload)
            .select()
            .single();

        if (error) {
            throw error;
        }

        const inserted = mapRowToBet(data);
        betData.push(inserted);
        sortBetData();
        betDataLoaded = true;
        return inserted.id;
    } catch (error) {
        console.error('Bet insert error:', error);
        showToast('データの保存に失敗しました', 'error');
        throw error;
    }
}

async function updateBet(id, updatedBetData) {
    if (!isSupabaseReady()) {
        const index = betData.findIndex(bet => String(bet.id) === String(id));
        if (index !== -1) {
            updatedBetData.id = id;
            betData[index] = updatedBetData;
            sortBetData();
        }
        betDataLoaded = true;
        return id;
    }

    try {
        const payload = buildBetPayload(updatedBetData);
        delete payload.user_id;

        const { data, error } = await window.supabaseClient
            .from('bets')
            .update(payload)
            .eq('id', id)
            .eq('user_id', currentUser.id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        const mapped = mapRowToBet(data);
        const index = betData.findIndex(bet => String(bet.id) === String(id));
        if (index !== -1) {
            betData[index] = mapped;
            sortBetData();
        }
        betDataLoaded = true;
        return id;
    } catch (error) {
        console.error('Bet update error:', error);
        showToast('データの更新に失敗しました', 'error');
        throw error;
    }
}

async function deleteBet(id) {
    if (!isSupabaseReady()) {
        betData = betData.filter(bet => String(bet.id) !== String(id));
        betDataLoaded = true;
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('bets')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (error) {
            throw error;
        }

        betData = betData.filter(bet => String(bet.id) !== String(id));
        betDataLoaded = true;
    } catch (error) {
        console.error('Bet delete error:', error);
        showToast('データの削除に失敗しました', 'error');
        throw error;
    }
}

async function getAllBets(forceRefresh = false) {
    if (isSupabaseReady()) {
        if (!betDataLoaded || forceRefresh) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('bets')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('race_date', { ascending: false })
                    .order('created_at', { ascending: false });

                if (error) {
                    throw error;
                }

                betData = (data || []).map(mapRowToBet);
                sortBetData();
                betDataLoaded = true;
            } catch (error) {
                console.error('Bet fetch error:', error);
                showToast('データの取得に失敗しました', 'error');
                betData = [];
                betDataLoaded = true;
            }
        }
        return [...betData];
    }

    // Supabase クライアント自体が利用できない場合のみサンプルデータを使用
    if (!window.supabaseClient) {
        if (!betDataLoaded) {
            initSampleData();
            betDataLoaded = true;
        }
    } else {
        betData = [];
        betDataLoaded = true;
    }
    return [...betData];
}

function extractTrackName(raceName) {
    if (!raceName) return null;
    const trimmed = raceName.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([^\s(（]+)/);
    return match ? match[1] : null;
}

function populateTrackFilter(bets) {
    const trackSelect = document.getElementById('track-filter');
    if (!trackSelect) return;

    const tracks = new Set();
    bets.forEach(bet => {
        const track = bet.track || extractTrackName(bet.raceName);
        if (track) {
            tracks.add(track);
        }
    });

    const previousValue = currentTrackFilter;
    const options = ['<option value="all">すべて</option>'];
    Array.from(tracks).sort().forEach(track => {
        options.push(`<option value="${track}">${track}</option>`);
    });

    trackSelect.innerHTML = options.join('');

    if (previousValue !== 'all' && tracks.has(previousValue)) {
        trackSelect.value = previousValue;
        currentTrackFilter = previousValue;
    } else {
        trackSelect.value = 'all';
        currentTrackFilter = 'all';
    }
}

// ナビゲーション機能
function showView(viewName) {
    // アクティブなビューとタブを変更
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    } else {
        console.warn('showView: 対象ビューが見つかりません', viewName);
    }

    const targetTab = document.querySelector(`[data-view="${viewName}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    currentView = viewName;
    
    // ビュー切り替え時のデータ更新
    if (viewName === 'list') {
        loadDataList();
    } else if (viewName === 'stats') {
        loadStats();
    }
}

window.showView = showView;

// データ一覧の表示
async function loadDataList(forceRefresh = false) {
    try {
        const bets = await getAllBets(forceRefresh);
        const tableBody = document.getElementById('data-table-body');
        const noDataMessage = document.getElementById('no-data-message');
        const dataTable = document.getElementById('data-table');
        
        if (bets.length === 0) {
            dataTable.style.display = 'none';
            noDataMessage.style.display = 'block';
            return;
        }
        
        dataTable.style.display = 'table';
        noDataMessage.style.display = 'none';
        
        // 日付順でソート（新しい順）
        bets.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        tableBody.innerHTML = bets.map(bet => {
            const recoveryClass = bet.recoveryRate >= 100 ? 'positive' : 'negative';
            const thumbnailHtml = bet.imageData 
                ? `<img src="${bet.imageData}" alt="サムネイル" class="thumbnail" onclick="showImageModal('${bet.imageData}')">`
                : `<div class="no-image-placeholder">画像なし</div>`;
            const escapedId = String(bet.id ?? '').replace(/'/g, "\\'");
            
            return `
                <tr>
                    <td>${thumbnailHtml}</td>
                    <td>${bet.date ? formatDate(bet.date) : '-'}</td>
                    <td><span class="source-badge">${bet.source}</span></td>
                    <td>¥${bet.totalPurchase.toLocaleString()}</td>
                    <td>${bet.bets ? bet.bets.length : 1}点</td>
                    <td>¥${bet.payout.toLocaleString()}</td>
                    <td><span class="recovery-rate ${recoveryClass}">${bet.recoveryRate.toFixed(1)}%</span></td>
                    <td class="action-buttons">
                        <button class="btn btn-sm btn-secondary" onclick="editBet('${escapedId}')">編集</button>
                        <button class="btn btn-sm btn-danger" onclick="showDeleteModal('${escapedId}')">削除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        showToast('データの読み込みに失敗しました', 'error');
    }
}

// フォーム関連
function setupForm() {
    const form = document.getElementById('bet-form');
    const payoutInput = document.getElementById('payout');
    const recoveryRateDisplay = document.getElementById('recovery-rate');
    const addBetBtn = document.getElementById('add-bet-button');
    
    // 回収率計算関数
    window.updateRecoveryRate = function() {
        const totalAmountText = document.getElementById('total-amount').textContent;
        const totalAmount = parseInt(totalAmountText.replace(/[^0-9]/g, '')) || 0;
        const payout = parseFloat(payoutInput.value) || 0;
        
        if (totalAmount > 0) {
            const rate = (payout / totalAmount * 100);
            recoveryRateDisplay.textContent = `${rate.toFixed(1)}%`;
            recoveryRateDisplay.className = 'rate-value ' + (rate >= 100 ? 'positive' : 'negative');
        } else {
            recoveryRateDisplay.textContent = '0.0%';
            recoveryRateDisplay.className = 'rate-value';
        }
    }
    
    // 合計金額計算関数
    window.updateTotalAmount = function() {
        const betRows = document.querySelectorAll('.bet-input-row');
        let total = 0;
        betRows.forEach(row => {
            const amountInput = row.querySelector('input[type="number"]');
            if (amountInput) {
                total += parseInt(amountInput.value) || 0;
            }
        });
        document.getElementById('total-amount').textContent = `¥${total.toLocaleString()}`;
        updateRecoveryRate();
    }
    
    // 払戻金入力時の回収率更新
    payoutInput.addEventListener('input', updateRecoveryRate);
    
    // 買い目追加ボタン
    if (addBetBtn) {
        addBetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addBetInputRow();
        });
    }
    
    // 初期買い目行を追加
    addBetInputRow();
    
    // 合計金額の初期計算
    updateTotalAmount();
    
    // フォーム送信
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const betsData = getBetInputsData();
        
        if (betsData.length === 0) {
            showToast('最低1つの買い目を入力してください', 'error');
            return;
        }
        
        const totalPurchase = betsData.reduce((sum, bet) => sum + bet.amount, 0);
        
        const formData = {
            date: document.getElementById('bet-date').value,
            source: document.getElementById('bet-source').value,
            raceName: document.getElementById('race-name').value.trim() || null,
            track: document.getElementById('track-select').value || null,
            bets: betsData,
            totalPurchase: totalPurchase,
            payout: parseInt(document.getElementById('payout').value) || 0,
            memo: document.getElementById('memo').value.trim() || null
        };
        
        // 回収率計算
        formData.recoveryRate = totalPurchase > 0 ? (formData.payout / totalPurchase * 100) : 0;
        
        // 画像データを追加（ある場合）
        if (currentImageData) {
            formData.imageData = currentImageData;
        }
        
        try {
            if (editingId) {
                await updateBet(editingId, formData);
                showToast('データを更新しました', 'success');
            } else {
                await addBet(formData);
                showToast('データを追加しました', 'success');
            }

            resetForm();
            showView('list');
            await loadStats();
        } catch (error) {
            if (error?.code === 'plan_quota_reached') {
                console.warn('保存上限に達しました:', error.message);
                return;
            }
            console.error('保存エラー:', error);
            showToast('保存に失敗しました', 'error');
        }
    });
}

function resetForm() {
    document.getElementById('bet-form').reset();
    document.getElementById('recovery-rate').textContent = '0.0%';
    document.getElementById('recovery-rate').className = 'rate-value';
    document.getElementById('total-amount').textContent = '¥0';
    document.getElementById('input-title').textContent = '新規データ追加';
    editingId = null;
    const trackSelect = document.getElementById('track-select');
    if (trackSelect) {
        trackSelect.value = '';
    }
    
    // 買い目入力をリセット
    const container = document.getElementById('bet-inputs-container');
    container.innerHTML = '';
    betInputCounter = 0;
    addBetInputRow();
    
    // 画像プレビューをリセット
    hideImagePreview();
    
    // 今日の日付をセット
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bet-date').value = today;
}

function editBet(id) {
    getAllBets().then(bets => {
        const bet = bets.find(b => String(b.id) === String(id));
        if (bet) {
            // フォームに値をセット
            document.getElementById('bet-date').value = bet.date;
            document.getElementById('bet-source').value = bet.source;
            document.getElementById('race-name').value = bet.raceName || '';
            const trackSelect = document.getElementById('track-select');
            if (trackSelect) {
                trackSelect.value = bet.track || '';
            }
            document.getElementById('payout').value = bet.payout;
            document.getElementById('memo').value = bet.memo || '';
            
            // 既存の買い目をクリア
            const container = document.getElementById('bet-inputs-container');
            container.innerHTML = '';
            betInputCounter = 0;
            
            // 買い目データを設定
            if (bet.bets && bet.bets.length > 0) {
                bet.bets.forEach(betItem => {
                    addBetInputRow(betItem.type, betItem.numbers, betItem.amount);
                });
            } else {
                // レガシーデータ対応
                addBetInputRow('', '', bet.totalPurchase || 100);
            }
            
            // 画像データを設定
            if (bet.imageData) {
                currentImageData = bet.imageData;
                showImagePreview(bet.imageData);
            }
            
            // 回収率表示更新
            updateRecoveryRate();
            
            document.getElementById('input-title').textContent = 'データ編集';
            editingId = id;
            showView('input');
        }
    });
}

function cancelEdit() {
    resetForm();
    showView('list');
}

// 削除機能
function showDeleteModal(id) {
    deleteId = String(id);
    document.getElementById('delete-modal').style.display = 'flex';
}

function hideDeleteModal() {
    deleteId = null;
    document.getElementById('delete-modal').style.display = 'none';
}

// 画像モーダル関数
function showImageModal(imageData) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    
    modalImage.src = imageData;
    modal.style.display = 'flex';
}

function hideImageModal() {
    document.getElementById('image-modal').style.display = 'none';
}

// レガシー画像入力機能（削除済み - 新しい実装で置き換え）
function setupImageInput() {
    // モーダルクリックで閉じる
    const imageModal = document.getElementById('image-modal');
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'image-modal') {
                hideImageModal();
            }
        });
    }
}

async function confirmDelete() {
    if (deleteId) {
        try {
            await deleteBet(deleteId);
            showToast('データを削除しました', 'success');
            await loadDataList(true);
            await loadStats();
        } catch (error) {
            console.error('削除エラー:', error);
            showToast('削除に失敗しました', 'error');
        }
    }
    hideDeleteModal();
}

// 統計機能
async function loadStats() {
    try {
        const bets = await getAllBets();
        populateTrackFilter(bets);
        const filteredBets = filterBets(bets);

        updateStatsSummary(filteredBets);
        drawRecoveryChart(filteredBets, currentGroupMode);
        drawComparisonChart(filteredBets, currentComparisonMode);
    } catch (error) {
        console.error('統計データ読み込みエラー:', error);
        showToast('統計データの読み込みに失敗しました', 'error');
    }
}

function filterBets(bets) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return bets.filter(bet => {
        const betDate = new Date(bet.date);
        switch (currentPeriod) {
            case 'thisMonth':
                if (betDate.getFullYear() !== currentYear || betDate.getMonth() !== currentMonth) {
                    return false;
                }
                break;
            case 'thisYear':
                if (betDate.getFullYear() !== currentYear) {
                    return false;
                }
                break;
            case 'all':
            default:
                break;
        }

        if (currentSourceFilter !== 'all' && bet.source !== currentSourceFilter) {
            return false;
        }

        if (currentTrackFilter !== 'all') {
            const track = bet.track || extractTrackName(bet.raceName);
            if (track !== currentTrackFilter) {
                return false;
            }
        }

        return true;
    });
}

function updateToggleButtons(containerSelector, dataAttr, activeValue) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.querySelectorAll('.btn').forEach(btn => {
        if (btn.dataset[dataAttr] === activeValue) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setupStatsFilters() {
    const sourceSelect = document.getElementById('source-filter');
    if (sourceSelect) {
        sourceSelect.value = currentSourceFilter;
        sourceSelect.addEventListener('change', () => {
            currentSourceFilter = sourceSelect.value;
            loadStats();
        });
    }

    const trackSelect = document.getElementById('track-filter');
    if (trackSelect) {
        trackSelect.value = currentTrackFilter;
        trackSelect.addEventListener('change', () => {
            currentTrackFilter = trackSelect.value;
            loadStats();
        });
    }

    const groupButtons = document.querySelectorAll('#group-toggle .btn');
    groupButtons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            const value = btn.dataset.group;
            if (!value || value === currentGroupMode) return;
            currentGroupMode = value;
            updateToggleButtons('#group-toggle', 'group', currentGroupMode);
            loadStats();
        });
    });
    updateToggleButtons('#group-toggle', 'group', currentGroupMode);

    const comparisonButtons = document.querySelectorAll('#comparison-toggle .btn');
    comparisonButtons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            const value = btn.dataset.comparison;
            if (!value || value === currentComparisonMode) return;
            currentComparisonMode = value;
            updateToggleButtons('#comparison-toggle', 'comparison', currentComparisonMode);
            loadStats();
        });
    });
    updateToggleButtons('#comparison-toggle', 'comparison', currentComparisonMode);
}

function updateStatsSummary(bets) {
    const totalPurchase = bets.reduce((sum, bet) => sum + bet.totalPurchase, 0);
    const totalPayout = bets.reduce((sum, bet) => sum + bet.payout, 0);
    const avgRecoveryRate = totalPurchase > 0 ? totalPayout / totalPurchase * 100 : 0;
    const raceCount = bets.length;
    const hitCount = bets.filter(bet => bet.payout > 0).length;
    const hitRate = raceCount > 0 ? hitCount / raceCount * 100 : 0;
    
    document.getElementById('total-purchase').textContent = `¥${totalPurchase.toLocaleString()}`;
    document.getElementById('total-payout').textContent = `¥${totalPayout.toLocaleString()}`;
    document.getElementById('avg-recovery-rate').textContent = `${avgRecoveryRate.toFixed(1)}%`;
    document.getElementById('race-count').textContent = raceCount;
    document.getElementById('hit-count').textContent = hitCount;
    document.getElementById('hit-rate').textContent = `${hitRate.toFixed(1)}%`;
}

function drawRecoveryChart(bets, groupMode) {
    const canvas = document.getElementById('recovery-chart');
    if (!canvas) return;
    const title = document.getElementById('recovery-chart-title');
    if (title) {
        title.textContent = groupMode === 'yearly' ? '年別回収率推移' : '月別回収率推移';
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grouped = {};
    bets.forEach(bet => {
        if (!bet.date) return;
        const key = groupMode === 'yearly' ? bet.date.substring(0, 4) : bet.date.substring(0, 7);
        if (!grouped[key]) {
            grouped[key] = { purchase: 0, payout: 0 };
        }
        grouped[key].purchase += bet.totalPurchase;
        grouped[key].payout += bet.payout;
    });

    const labels = Object.keys(grouped).sort();
    if (labels.length === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('データがありません', canvas.width / 2, canvas.height / 2);
        return;
    }

    const rates = labels.map(label => {
        const data = grouped[label];
        return data.purchase > 0 ? (data.payout / data.purchase) * 100 : 0;
    });

    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxRate = Math.max(120, ...rates.map(rate => (Number.isFinite(rate) ? rate : 0)));
    const stepWidth = labels.length > 0 ? chartWidth / labels.length : chartWidth;
    const barWidth = Math.min(stepWidth * 0.6, 80);
    const offsetX = (stepWidth - barWidth) / 2;

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(padding, padding, chartWidth, chartHeight);

    const baselineY = padding + chartHeight - (100 / maxRate) * chartHeight;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, baselineY);
    ctx.lineTo(padding + chartWidth, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    labels.forEach((label, index) => {
        const rate = rates[index];
        const barHeight = maxRate === 0 ? 0 : (rate / maxRate) * chartHeight;
        const x = padding + (
            labels.length === 1
                ? (chartWidth - barWidth) / 2
                : index * stepWidth + offsetX
        );
        const y = padding + chartHeight - barHeight;

        ctx.fillStyle = rate >= 100 ? '#22c55e' : '#ef4444';
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, canvas.height - 20);

        ctx.fillStyle = '#1f2937';
        ctx.font = '10px Arial';
        ctx.fillText(`${rate.toFixed(1)}%`, x + barWidth / 2, y - 5);
    });

    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const rate = (maxRate / 5) * i;
        const y = padding + chartHeight - (i / 5) * chartHeight;
        ctx.fillText(`${rate.toFixed(0)}%`, padding - 10, y + 4);
    }
}

function drawComparisonChart(bets, mode) {
    const canvas = document.getElementById('comparison-chart');
    if (!canvas) return;
    const title = document.getElementById('comparison-chart-title');
    if (title) {
        title.textContent = mode === 'track' ? '競馬場別回収率比較' : '購入元別回収率比較';
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grouped = {};
    bets.forEach(bet => {
        const key = mode === 'track'
            ? (extractTrackName(bet.raceName) || '不明')
            : (bet.source || '不明');
        if (!grouped[key]) {
            grouped[key] = { purchase: 0, payout: 0 };
        }
        grouped[key].purchase += bet.totalPurchase;
        grouped[key].payout += bet.payout;
    });

    const labels = Object.keys(grouped).sort();
    if (labels.length === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('データがありません', canvas.width / 2, canvas.height / 2);
        return;
    }

    const rates = labels.map(label => {
        const data = grouped[label];
        return data.purchase > 0 ? (data.payout / data.purchase) * 100 : 0;
    });

    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxRate = Math.max(120, ...rates.map(rate => (Number.isFinite(rate) ? rate : 0)));
    const barWidth = labels.length === 1 ? chartWidth * 0.3 : Math.min(80, chartWidth / (labels.length * 1.6));
    const totalBarsWidth = barWidth * labels.length;
    const remainingSpace = Math.max(chartWidth - totalBarsWidth, 0);
    const spacing = labels.length > 1 ? remainingSpace / (labels.length - 1) : remainingSpace / 2;

    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(padding, padding, chartWidth, chartHeight);

    const baselineY = padding + chartHeight - (100 / maxRate) * chartHeight;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, baselineY);
    ctx.lineTo(padding + chartWidth, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    labels.forEach((label, index) => {
        const rate = rates[index];
        const barHeight = maxRate === 0 ? 0 : (rate / maxRate) * chartHeight;
        const x = padding + (
            labels.length === 1
                ? (chartWidth - barWidth) / 2
                : index * (barWidth + spacing)
        );
        const y = padding + chartHeight - barHeight;

        ctx.fillStyle = rate >= 100 ? '#22c55e' : '#ef4444';
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, canvas.height - 20);

        ctx.fillStyle = '#1f2937';
        ctx.font = '10px Arial';
        ctx.fillText(`${rate.toFixed(1)}%`, x + barWidth / 2, y - 5);
    });

    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const rate = (maxRate / 5) * i;
        const y = padding + chartHeight - (i / 5) * chartHeight;
        ctx.fillText(`${rate.toFixed(0)}%`, padding - 10, y + 4);
    }
}

// 画像処理関数
function convertToBase64(file, maxSizeKB = 2048) {
    return new Promise((resolve, reject) => {
        // ファイルサイズチェック
        if (file.size > maxSizeKB * 1024) {
            // 画像を縮小
            compressImage(file, maxSizeKB).then(resolve).catch(reject);
        } else {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsDataURL(file);
        }
    });
}

function compressImage(file, maxSizeKB) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // 画像のアスペクト比を保持したままサイズを減らす
            let { width, height } = img;
            const maxDimension = 1200; // 最大解像度
            
            if (width > height && width > maxDimension) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else if (height > maxDimension) {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // 品質を調整してサイズを制限
            let quality = 0.9;
            let dataUrl;
            
            const tryCompress = () => {
                dataUrl = canvas.toDataURL('image/jpeg', quality);
                const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
                
                if (sizeKB <= maxSizeKB || quality <= 0.1) {
                    resolve(dataUrl);
                } else {
                    quality -= 0.1;
                    setTimeout(tryCompress, 0);
                }
            };
            
            tryCompress();
        };
        
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
        img.src = URL.createObjectURL(file);
    });
}

function processImageFile(file) {
    debugLog('processImageFile呼び出し', file?.name);
    if (!file || !file.type.startsWith('image/')) {
        showToast('有効な画像ファイルを選択してください', 'error');
        return;
    }
    
    showToast('画像を処理中...', 'info');
    
    convertToBase64(file)
        .then(base64Data => {
            currentImageData = base64Data;
            showImagePreview(base64Data);
            showToast('画像を読み込みました', 'success');
        })
        .catch(error => {
            console.error('画像処理エラー:', error);
            showToast('画像の読み込みに失敗しました', 'error');
        });
}

function showImagePreview(base64Data) {
    debugLog('showImagePreview呼び出し');
    const dropZone = document.getElementById('image-drop-zone');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImage = document.getElementById('preview-image');
    
    if (dropZone && previewContainer && previewImage) {
        dropZone.style.display = 'none';
        previewContainer.style.display = 'block';
        previewImage.src = base64Data;
        debugLog('画像プレビュー表示完了');
    } else {
        console.error('プレビュー要素が見つかりません');
    }
}

function hideImagePreview() {
    debugLog('hideImagePreview呼び出し');
    const dropZone = document.getElementById('image-drop-zone');
    const previewContainer = document.getElementById('image-preview-container');
    const fileInput = document.getElementById('image-file-input');
    
    if (dropZone && previewContainer) {
        dropZone.style.display = 'flex';
        previewContainer.style.display = 'none';
        currentImageData = null;
        if (fileInput) {
            fileInput.value = '';
        }
        debugLog('画像プレビュー非表示完了');
    } else {
        console.error('プレビュー要素が見つかりません');
    }
}

// ユーティリティ関数
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// イベントリスナー設定
function setupEventListeners() {
    // ナビゲーションタブ
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            showView(e.target.dataset.view);
        });
    });
    
    // 期間選択ボタン
    document.querySelectorAll('[data-period]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPeriod = e.target.dataset.period;
            loadStats();
        });
    });
}

// アプリ初期化
async function initApp() {
    try {
        // Supabase が利用できない場合のみサンプルデータを初期化
        if (!window.supabaseClient) {
            initSampleData();
            betDataLoaded = true;
        }
        
        // イベントリスナーとフォーム設定
        setupEventListeners();
        setupForm();
        setupImageInput();
        setupStatsFilters();
        
        // 初期データ読み込み
        await loadDataList();
        
        debugLog('アプリが正常に初期化されました');
    } catch (error) {
        console.error('アプリの初期化に失敗しました:', error);
        showToast('アプリの初期化に失敗しました', 'error');
    }
}

function requestVisionText(imageDataUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!window.GCV_API_KEY) {
        throw new Error('Google Cloud Vision APIキーが設定されていません。config.js を更新してください。');
      }

      const base64Content = imageDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Content
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION'
              }
            ],
            imageContext: {
              languageHints: ['ja']
            }
          }
        ]
      };

      debugLog('Vision API へリクエスト送信', {
        endpoint: VISION_API_ENDPOINT,
        bodySize: `${(base64Content.length / 1024).toFixed(1)}KB`
      });

      const response = await fetch(`${VISION_API_ENDPOINT}?key=${encodeURIComponent(window.GCV_API_KEY)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vision API リクエストが失敗しました: ${response.status} ${response.statusText} ${errorText}`);
      }

      const data = await response.json();
      debugLog('Vision API 応答', data);

      const visionResponse = data.responses && data.responses[0];
      if (!visionResponse) {
        throw new Error('Vision API から応答が得られませんでした。');
      }

      if (visionResponse.error) {
        throw new Error(visionResponse.error.message || 'Vision API がエラーを返しました');
      }

      const text = visionResponse.fullTextAnnotation?.text
        || (Array.isArray(visionResponse.textAnnotations) && visionResponse.textAnnotations[0]?.description)
        || '';

      resolve(text);
    } catch (error) {
      reject(error);
    }
  });
}

async function requestPerplexityTickets(ocrText) {
  if (!window.PERPLEXITY_API_KEY) {
    throw new Error('Perplexity APIキーが設定されていません');
  }

  const prompt = `以下の馬券明細テキストから、券種ごとの買い目を抽出してください。` +
    `JSON でのみ回答し、形式は {"tickets": [{"type": "枠連", "numbers": ["7","8"], "amount": 400, "payout": 1600}]} としてください。` +
    `金額は円単位の整数、numbers は文字列配列、券種は「単勝」「複勝」「枠連」「枠単」「枠複」「馬連」「馬単」「ワイド」「3連複」「3連単」のいずれかに正規化してください。` +
    `払戻金が不明な場合は 0 を設定し、抽出できないときは tickets を空配列にしてください。`;

  const body = {
    model: 'sonar',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: 'You are a precise data extraction assistant that only returns valid JSON.'
      },
      {
        role: 'user',
        content: `${prompt}\n\nテキスト:\n${ocrText}`
      }
    ]
  };

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${window.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API リクエストが失敗しました: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json();
  debugLog('Perplexity API 応答', data);

  const content = data?.choices?.[0]?.message?.content || '';
  return parsePerplexityTickets(content);
}

function parsePerplexityTickets(content) {
  if (!content) return [];

  let jsonText = content.trim();
  const jsonBlock = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/i);
  if (jsonBlock) {
    jsonText = jsonBlock[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.tickets)) {
      return parsed.tickets;
    }
  } catch (error) {
    debugLog('AIレスポンスJSON解析失敗', error?.message || error, jsonText);
  }

  return [];
}

function normaliseBetType(rawType) {
  if (!rawType) return null;
  const type = rawType.replace(/\s+/g, '').replace(/３/g, '3');
  if (/枠単/i.test(type)) return '枠単';
  if (/枠複/i.test(type)) return '枠複';
  if (/枠連/i.test(type)) return '枠連';
  if (/三連単|3連単/i.test(type)) return '3連単';
  if (/三連複|3連複/i.test(type)) return '3連複';
  if (/馬連/i.test(type)) return '馬連';
  if (/馬単/i.test(type)) return '馬単';
  if (/ワイド/i.test(type)) return 'ワイド';
  if (/単勝/i.test(type)) return '単勝';
  if (/複勝/i.test(type)) return '複勝';
  return rawType;
}

function reconcileTickets(localTickets, aiTickets) {
  if (!Array.isArray(aiTickets) || aiTickets.length === 0) {
    return localTickets;
  }

  const mapKey = (type, numbers) => `${type}|${numbers.replace(/\s+/g, '')}`;

  const resultMap = new Map();

  (localTickets || []).forEach(ticket => {
    const key = mapKey(ticket.type, ticket.numbers);
    resultMap.set(key, { ...ticket });
  });

  aiTickets.forEach(ticket => {
    const type = normaliseBetType(ticket.type) || '不明';
    const numbersArray = Array.isArray(ticket.numbers) ? ticket.numbers : String(ticket.numbers || '').split(/[,\s]/).filter(Boolean);
    const numbers = numbersArray.length === 1
      ? numbersArray[0]
      : numbersArray.join(type === '3連単' || type === '3連複' ? '→' : '-');
    const amount = Number(ticket.amount) || 0;
    const payout = Number(ticket.payout) || 0;

    const key = mapKey(type, numbers);
    if (resultMap.has(key)) {
      const existing = resultMap.get(key);
      if (!existing.amount && amount) existing.amount = amount;
      if (!existing.payout && payout) existing.payout = payout;
      existing.source = existing.source ? `${existing.source}+ai` : 'ai';
      resultMap.set(key, existing);
    } else {
      resultMap.set(key, {
        type,
        numbers,
        amount,
        payout,
        source: 'ai'
      });
    }
  });

  return Array.from(resultMap.values());
}

// OCR処理関数
async function performOCR(imageData) {
  debugLog('OCR処理開始 (Google Cloud Vision API)');
  showToast('画像を解析中...（数秒かかります）', 'info');
  console.time('ocr-recognize');
  const ocrStart = performance.now();

  try {
    const text = await requestVisionText(imageData);
    debugLog('抽出テキスト', text);

    await extractDataFromText(text);
    showToast('画像の解析が完了しました', 'success');
  } catch (error) {
    console.error('OCRエラー:', error);
    debugLog('OCRエラー', error?.message || error);
    showToast('画像の解析に失敗しました', 'error');
    showToast(`OCRエラー: ${error.message || error}`, 'error');
  }
  console.timeEnd('ocr-recognize');
  const duration = ((performance.now() - ocrStart) / 1000).toFixed(2);
  debugLog('OCR処理完了', `${duration}s`);
}

// テキストから情報を抽出
async function extractDataFromText(text) {
  const normalizedText = normalizeOcrText(text);
  debugLog('=== データ抽出開始 ===');
  debugLog('抽出対象テキスト長', normalizedText.length);
  debugLog('原文プレビュー', text.slice(0, 200));
  if (normalizedText !== text) {
    debugLog('正規化後テキスト', normalizedText.slice(0, 200));
  }

  const workText = normalizedText;
  const separatorClass = '[→ー\-\u30FC\uFF0D\u2212\u2014\u2013っつづッﾂ]';
  const separatorPattern = `\\s*${separatorClass}\\s*`;
  const separatorRegex = new RegExp(separatorPattern, 'g');
  const separatorGroup = `(?:${separatorPattern})`;

  // 1. 日付の抽出
  const datePatterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/
  ];

  for (const pattern of datePatterns) {
    const match = workText.match(pattern);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      const dateValue = `${year}-${month}-${day}`;
      document.getElementById('bet-date').value = dateValue;
      debugLog('✓ 日付抽出', dateValue);
      break;
    }
  }

  // 2. 競馬場とレース番号の抽出
  const raceCourses = ['大井', '川崎', '船橋', '浦和', '東京', '中山', '阪神', '京都',
                       '中京', '新潟', '福島', '小倉', '札幌', '函館', '園田', '姫路'];
  const racePattern = new RegExp(`(${raceCourses.join('|')})\\s*(\\d{1,2})R`);
  const raceMatch = workText.match(racePattern);

  if (raceMatch) {
    const raceName = `${raceMatch[1]} ${raceMatch[2]}R`;
    document.getElementById('race-name').value = raceName;
    debugLog('✓ レース名抽出', raceName);
  }

  // 3. 購入元の判定
  if (workText.includes('紙馬券')) {
    const paperTicketRadio = document.querySelector('input[value="紙馬券"]');
    if (paperTicketRadio) paperTicketRadio.checked = true;
    else document.getElementById('bet-source').value = '紙馬券';
    debugLog('✓ 購入元: 紙馬券');
  } else if (workText.includes('SPAT4') || workText.includes('Spat4')) {
    const spat4Radio = document.querySelector('input[value="Spat4"]');
    if (spat4Radio) spat4Radio.checked = true;
    else document.getElementById('bet-source').value = 'Spat4';
    debugLog('✓ 購入元: Spat4');
  } else if (workText.includes('即pat') || workText.includes('即PAT') || workText.includes('iPAT')) {
    const ipatRadio = document.querySelector('input[value="即pat"]');
    if (ipatRadio) ipatRadio.checked = true;
    else document.getElementById('bet-source').value = '即pat';
    debugLog('✓ 購入元: 即pat');
  }

  // 4. 券種の抽出
  const betTypes = ['三連単', '三連複', '馬連', '馬単', 'ワイド', '単勝', '複勝', '枠連', '枠単'];
  let detectedBetType = null;

  for (const betType of betTypes) {
    if (workText.includes(betType)) {
      detectedBetType = betType;
      debugLog('✓ 券種検出', betType);
      break;
    }
  }

  // 5. 馬番号と金額の抽出（複数買い目対応）
  const rowRegex = /\d+\s+\d{4}年\d{1,2}月\d{1,2}日/g;
  const rowMatches = [...workText.matchAll(rowRegex)];
  const tickets = [];

  rowMatches.forEach((match, index) => {
    const startIndex = match.index;
    const endIndex = index + 1 < rowMatches.length ? rowMatches[index + 1].index : workText.length;
    const rawRow = workText.slice(startIndex, endIndex).trim();
    if (!rawRow) return;

    debugLog('解析対象行', rawRow);

    let rowText = rawRow.replace(/^\s*\d+\s*/, '');
    const dateMatchRow = rowText.match(/^(\d{4}年\d{1,2}月\d{1,2}日)/);
    if (!dateMatchRow) return;
    rowText = rowText.slice(dateMatchRow[0].length).trim();

    const trackPattern = new RegExp(`(${raceCourses.join('|')})\\s*(\\d{1,2}R)`);
    const trackMatch = rowText.match(trackPattern);
    if (trackMatch) {
      rowText = rowText.replace(trackMatch[0], '').trim();
    }

    const typeMatchRow = rowText.match(/(枠連|枠複|枠単|三連単|三連複|馬連|馬単|ワイド|単勝|複勝)/);
    if (!typeMatchRow) return;
    const ticketTypeRaw = typeMatchRow[1];

    let ticketType;
    switch (ticketTypeRaw) {
      case '枠連':
        ticketType = '枠連';
        break;
      case '枠複':
        ticketType = '枠複';
        break;
      case '枠単':
        ticketType = '枠単';
        break;
      case '三連単':
        ticketType = '3連単';
        break;
      case '三連複':
        ticketType = '3連複';
        break;
      case '馬連':
        ticketType = '馬連';
        break;
      case '馬単':
        ticketType = '馬単';
        break;
      case 'ワイド':
        ticketType = 'ワイド';
        break;
      case '単勝':
        ticketType = '単勝';
        break;
      case '複勝':
        ticketType = '複勝';
        break;
      default:
        ticketType = ticketTypeRaw;
    }

    rowText = rowText.replace(ticketTypeRaw, '').trim();
    rowText = rowText.replace(/通常/g, ' ').trim();
    rowText = rowText.replace(/\|+/g, ' ').trim();
    debugLog('券種処理後テキスト', rowText);

    const tokens = rowText.split(/\s+/).filter(Boolean);
    debugLog('行トークン', tokens);

    const formationMatches = [...rowText.matchAll(/馬([1-3])[:：]([^馬]+)/g)];

    const addTicket = (numbersParts, amount, payout) => {
      const minimumLength = (ticketType === '単勝' || ticketType === '複勝') ? 1 : 2;
      if (numbersParts.length < minimumLength) return;
      const formattedNumbers = numbersParts.length === 1
        ? numbersParts[0]
        : numbersParts.join(ticketType === '3連単' || ticketType === '3連複' ? '→' : '-');

      tickets.push({
        type: ticketType,
        numbers: formattedNumbers,
        amount,
        payout: payout || 0,
        source: 'local'
      });
    };

    const collectAmounts = () => {
      let amount = null;
      let payout = null;
      tokens.forEach((tok, idx) => {
        const sanitized = tok.replace(/[^0-9,円]/g, '');
        if (!sanitized) return;
        const moneyMatch = sanitized.match(/^(\d{1,3}(?:,\d{3})*)円$/);
        if (!moneyMatch) return;
        const value = parseInt(moneyMatch[1].replace(/,/g, ''), 10);
        const prevToken = tokens[idx - 1] || '';
        if (amount === null && !/(的中|払戻)/.test(prevToken)) {
          amount = value;
        } else if (payout === null) {
          payout = value;
        }
      });
      return { amount, payout };
    };

    const { amount, payout } = collectAmounts();
    if (!amount) return;

    if (formationMatches.length >= 2) {
      const formationMap = new Map();
      formationMatches.forEach(match => {
        const indexKey = Number(match[1]);
        const values = (match[2] || '')
          .replace(/[()（）]/g, ' ')
          .replace(/[各計\[\]［］]/g, ' ')
          .split(/[、,\s]+/)
          .map(v => v.trim())
          .filter(Boolean)
          .map(v => v.replace(/[^0-9]/g, ''))
          .filter(Boolean);
        if (values.length) {
          formationMap.set(indexKey, values);
        }
      });

      const list1 = formationMap.get(1) || [];
      const list2 = formationMap.get(2) || [];
      const list3 = formationMap.get(3) || [];

      const comboSet = new Set();

      if (list1.length && list2.length && list3.length) {
        list1.forEach(a => {
          list2.forEach(b => {
            list3.forEach(c => {
              const combo = [a, b, c];
              if ((ticketType === '3連単' || ticketType === '3連複') && new Set(combo).size < 3) {
                return;
              }
              const key = combo.join('-');
              if (!comboSet.has(key)) {
                comboSet.add(key);
                addTicket(combo, amount, payout);
              }
            });
          });
        });
        return;
      }

      if (list1.length && list2.length) {
        list1.forEach(a => {
          list2.forEach(b => {
            const combo = [a, b];
            if (new Set(combo).size < 2) return;
            const key = combo.join('-');
            if (!comboSet.has(key)) {
              comboSet.add(key);
              addTicket(combo, amount, payout);
            }
          });
        });
        return;
      }
    }

    let numbersToken = tokens.find(tok => /\d+(?:[→\-]\d+){1,2}/.test(tok));
    if (!numbersToken && (ticketType === '単勝' || ticketType === '複勝')) {
      numbersToken = tokens.find(tok => /^\d+$/.test(tok));
    }
    if (!numbersToken) return;
    const numbersParts = numbersToken.split(/[→\-]/).filter(Boolean);
    addTicket(numbersParts, amount, payout);
  });
  let aiTickets = [];
  if (window.PERPLEXITY_API_KEY) {
    if (isPlanEnforced() && !isFeatureEnabled('aiAssistEnabled')) {
      debugLog('AI補助は現在のプランでは利用できません');
      showToast(getFeatureMessage('aiAssistEnabled'), 'info');
      showPlanUpsell('aiAssistEnabled');
    } else {
      try {
        aiTickets = await requestPerplexityTickets(workText);
        debugLog('AI抽出結果', aiTickets);
      } catch (error) {
        debugLog('AI抽出エラー', error?.message || error);
      }
    }
  } else {
    debugLog('Perplexity APIキーが設定されていません');
  }

  if (aiTickets.length > 0) {
    const mergedTickets = reconcileTickets([...tickets], aiTickets);
    tickets.splice(0, tickets.length, ...mergedTickets);
  }
  const payoutInput = document.getElementById('payout');
  const totalPayoutFromTickets = tickets.reduce((sum, t) => sum + (t.payout || 0), 0);
  if (payoutInput) {
    payoutInput.value = totalPayoutFromTickets;
    updateRecoveryRate();
  }

  let horseCombos = tickets.map(t => t.numbers);
  let amounts = tickets.map(t => t.amount);

  if (horseCombos.length === 0) {
    const fallbackCombos = [];
    let match;

    const fallbackSanrentanPattern = new RegExp(`(\\d{1,2})(?:${separatorGroup})(\\d{1,2})(?:${separatorGroup})(\\d{1,2})`, 'g');
    while ((match = fallbackSanrentanPattern.exec(workText)) !== null) {
      fallbackCombos.push([match[1], match[2], match[3]].join('→'));
    }

    if (fallbackCombos.length === 0) {
      const fallbackPairPattern = new RegExp(`(\\d{1,2})(?:${separatorGroup})(\\d{1,2})`, 'g');
      while ((match = fallbackPairPattern.exec(workText)) !== null) {
        fallbackCombos.push(`${match[1]}-${match[2]}`);
      }
    }

    if (fallbackCombos.length === 0 && (detectedBetType === '単勝' || detectedBetType === '複勝')) {
      const tanPattern = /(?:^|\s)(\d{1,2})(?:\s|$)/g;
      while ((match = tanPattern.exec(workText)) !== null) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 18) {
          fallbackCombos.push(match[1]);
        }
      }
    }

    const fallbackAmounts = [];
    const amountPattern = /(\d{1,3}(?:,\d{3})*)円/g;
    let amountMatch;
    while ((amountMatch = amountPattern.exec(workText)) !== null) {
      const amountValue = parseInt(amountMatch[1].replace(/,/g, ''), 10);
      const context = workText.slice(Math.max(0, amountMatch.index - 5), amountMatch.index + amountMatch[0].length + 5);
      if (/(的中|払戻)/.test(context)) {
        continue;
      }
      if (amountValue >= 100 && amountValue <= 100000) {
        fallbackAmounts.push(amountValue);
      }
    }

    if (fallbackCombos.length > 0) {
      horseCombos = fallbackCombos;
    }

    if (fallbackAmounts.length > 0) {
      amounts = fallbackAmounts;
    }
  }

  debugLog('✓ 馬番組合せ', horseCombos);
  debugLog('✓ 金額', amounts);

  const betInputsContainer = document.getElementById('bet-inputs-container');
  if (betInputsContainer) {
    betInputsContainer.innerHTML = '';
    betInputCounter = 0;

    if (tickets.length > 0) {
      tickets.forEach(ticket => {
        const betRow = createBetRow();
        betInputsContainer.appendChild(betRow);

        const typeSelect = betRow.querySelector('.bet-type');
        if (typeSelect) {
          typeSelect.value = ticket.type;
        }

        const numbersInput = betRow.querySelector('.bet-numbers');
        if (numbersInput) numbersInput.value = ticket.numbers;

        const amountInput = betRow.querySelector('.bet-amount');
        if (amountInput) amountInput.value = ticket.amount;
      });

      updateTotalAmount();
      debugLog(`✓ ${tickets.length}個の買い目を追加しました`);
    } else if (horseCombos.length > 0 || amounts.length > 0) {
      const fallbackCount = Math.max(horseCombos.length, amounts.length);
      for (let i = 0; i < fallbackCount; i++) {
        const betRow = createBetRow();
        betInputsContainer.appendChild(betRow);

        const typeSelect = betRow.querySelector('.bet-type');
        if (typeSelect && detectedBetType) {
          let mappedType = detectedBetType;
          if (detectedBetType === '三連単') mappedType = '3連単';
          else if (detectedBetType === '三連複') mappedType = '3連複';
          typeSelect.value = mappedType;
        }

        if (horseCombos[i]) {
          const numbersInput = betRow.querySelector('.bet-numbers');
          if (numbersInput) numbersInput.value = horseCombos[i];
        }

        if (amounts[i]) {
          const amountInput = betRow.querySelector('.bet-amount');
          if (amountInput) amountInput.value = amounts[i];
        }
      }

      updateTotalAmount();
      debugLog(`✓ ${fallbackCount}個の買い目を追加しました (fallback)`);
    } else {
      debugLog('買い目抽出に失敗しました。必要項目が揃った行が見つかりません。');
    }
  }

  const payoutPattern = /払戻.*?(\d{1,3}(?:,\d{3})*)円/;
  const payoutMatch = workText.match(payoutPattern);

  if (payoutMatch) {
    const payout = parseInt(payoutMatch[1].replace(/,/g, ''), 10);
    const payoutInput = document.getElementById('payout');
    if (payoutInput) {
      payoutInput.value = payout;
      updateRecoveryRate();
      debugLog('✓ 払戻金', payout);
    }
  }

  debugLog('=== データ抽出完了 ===');
}

// アプリ初期化関数
function initImageHandling() {
  debugLog('画像処理機能を初期化中...');
  
  const dropZone = document.getElementById('image-drop-zone');
  const fileInput = document.getElementById('image-file-input');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImage = document.getElementById('preview-image');
  
  if (!dropZone || !fileInput) {
    console.error('必要な画像入力要素が見つかりません');
    debugLog('必要な画像入力要素が見つかりません');
    return false;
  }
  
  return { dropZone, fileInput, previewContainer, previewImage };
}

// DOMContentLoaded時にアプリを初期化
document.addEventListener('DOMContentLoaded', function() {
  debugLog('アプリ初期化開始');
  
  // 画像処理機能の初期化
  const imageElements = initImageHandling();
  if (!imageElements) {
    console.error('画像処理機能の初期化に失敗しました');
    debugLog('画像処理機能の初期化に失敗しました');
    return;
  }

  const { dropZone, fileInput, previewContainer, previewImage } = imageElements;
  debugLog('画像入力要素を検出しました');
  
  // 1. ドロップゾーンのクリックイベント（確実な実装）
  dropZone.addEventListener('click', function(e) {
    debugLog('ドロップゾーンがクリックされました');
    
    // すでにファイル入力自体がクリックされた場合は処理済み
    if (e.target === fileInput) {
      return;
    }
    
    // 同じファイルを選択し直せるよう一旦リセット
    fileInput.value = '';
    fileInput.click();
  });
  
  // 2. ファイル選択のchangeイベント
  fileInput.addEventListener('change', function(e) {
    debugLog('ファイルが選択されました', this.files.length);

    if (this.files && this.files.length > 0) {
      const file = this.files[0];
      debugLog('選択されたファイル', { name: file.name, type: file.type });
      handleImageFile(file);
    }
  });
  
  // 3. クリップボード貼り付け（Ctrl+V / Cmd+V）
  document.addEventListener('paste', function(e) {
    debugLog('貼り付けイベント発火');
    if (currentView !== 'input') {
      debugLog('入力画面ではないためスキップ');
      return;
    }

    const items = e.clipboardData.items;
    debugLog('クリップボードアイテム数', items.length);

    for (let i = 0; i < items.length; i++) {
      debugLog(`アイテム${i}`, items[i].type);
      if (items[i].type.indexOf('image') !== -1) {
        debugLog('クリップボードから画像を検出');
        const blob = items[i].getAsFile();
        if (blob) {
          handleImageFile(blob);
          e.preventDefault();
          break;
        }
      }
    }
  });
  
  // 4. ドラッグオーバー
  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });
  
  // 5. ドラッグリーブ
  dropZone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });
  
  // 6. ドロップ
  dropZone.addEventListener('drop', function(e) {
    debugLog('ファイルがドロップされました');
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      debugLog('ドロップされた画像', files[0].name);
      handleImageFile(files[0]);
    }
  });

  // 画像ファイルの処理関数（OCR対応版）
  async function handleImageFile(file) {
    clearDebugLog();
    debugLog('=== 新しい画像を処理します ===');
    debugLog('画像処理開始', { name: file.name, type: file.type, sizeKB: (file.size / 1024).toFixed(1) });

    if (isPlanEnforced() && !isFeatureEnabled('ocrEnabled')) {
      showToast(getFeatureMessage('ocrEnabled'), 'warning');
      showPlanUpsell('ocrEnabled');
      return;
    }

    // ファイルタイプチェック
    if (!file.type.startsWith('image/')) {
      debugLog('画像ファイルではありません', file.type);
      showToast('有効な画像ファイルを選択してください', 'error');
      return;
    }

    const reader = new FileReader();
    debugLog('FileReader を初期化');

    reader.onload = async function(e) {
      debugLog('画像読み込み完了');
      const base64 = e.target.result;
      debugLog('Base64データ冒頭', base64.slice(0, 100));

      // プレビュー表示
      previewImage.src = base64;
      dropZone.style.display = 'none';
      previewContainer.style.display = 'block';
      
      // グローバル変数に保存
      window.currentImageData = base64;
      currentImageData = base64;
      
      showToast('画像を読み込みました', 'success');

      // OCR実行
      try {
        await performOCR(base64);
      } catch (error) {
        console.error('OCR処理エラー:', error);
        debugLog('OCR処理エラー', error?.message || error);
        showToast('OCR処理中にエラーが発生しました', 'error');
      }
    };

    reader.onerror = function() {
      console.error('画像読み込みエラー');
      debugLog('画像読み込みエラー');
      showToast('画像の読み込みに失敗しました', 'error');
    };
    
    reader.readAsDataURL(file);
  }
  
  // 画像アクションボタンの設定
  const changeImageBtn = document.getElementById('change-image-btn');
  if (changeImageBtn) {
    changeImageBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      debugLog('画像変更ボタンがクリックされました');
      fileInput.value = ''; // ファイル入力をリセット
      fileInput.click();
    });
  }

  updateFeatureAccessUI();
  debugLog('画像入力機能の初期化完了');

  // 画像削除ボタン
  const removeImageBtn = document.getElementById('remove-image-btn');
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      debugLog('画像削除ボタンがクリックされました');

      previewImage.src = '';
      previewContainer.style.display = 'none';
      dropZone.style.display = 'flex';
      window.currentImageData = null;
      currentImageData = null;
      fileInput.value = '';
      clearDebugLog();
      debugLog('画像を削除しました');

      showToast('画像を削除しました', 'success');
    });
  }
  
  // 他の初期化処理
  initApp();
  initializeAuth();
});
