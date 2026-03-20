/**
 * KL WiFi Auto-Login — Application Logic
 * Handles auto-login to KL University Sophos captive portal
 */

(function () {
    'use strict';

    // ─── Configuration ───
    const CONFIG = {
        PORTAL_URL: 'https://captiveportal.kluniversity.in:8090/login.xml',
        CHECK_INTERVAL: 45000,      // 45 seconds between connectivity checks
        LOGIN_RETRY_DELAY: 5000,    // 5 seconds before retry on failure
        MAX_RETRIES: 3,
        CONNECTIVITY_TEST_URLS: [
            'https://www.google.com/generate_204',
            'https://connectivitycheck.gstatic.com/generate_204',
            'https://clients3.google.com/generate_204'
        ],
        STORAGE_KEYS: {
            USERNAME: 'kl_wifi_username',
            PASSWORD: 'kl_wifi_password',
            AUTO_LOGIN_STATE: 'kl_wifi_active',
            LOGS: 'kl_wifi_logs'
        }
    };

    // ─── State ───
    let state = {
        isActive: false,
        isConnecting: false,
        checkInterval: null,
        uptimeInterval: null,
        startTime: null,
        retryCount: 0,
    };

    // ─── DOM Elements ───
    const $ = (id) => document.getElementById(id);
    const el = {
        powerButton: $('powerButton'),
        powerRing: $('powerRing'),
        pulseRing: $('pulseRing'),
        statusCard: $('statusCard'),
        statusDot: $('statusDot'),
        statusText: $('statusText'),
        lastLoginTime: $('lastLoginTime'),
        uptimeDisplay: $('uptimeDisplay'),
        uptimeValue: $('uptimeValue'),
        usernameInput: $('usernameInput'),
        passwordInput: $('passwordInput'),
        saveCredBtn: $('saveCredBtn'),
        clearCredBtn: $('clearCredBtn'),
        togglePasswordBtn: $('togglePasswordBtn'),
        credToggle: $('credToggle'),
        credBody: $('credBody'),
        toggleCredBtn: $('toggleCredBtn'),
        logToggle: $('logToggle'),
        logBody: $('logBody'),
        toggleLogBtn: $('toggleLogBtn'),
        logEntries: $('logEntries'),
        clearLogBtn: $('clearLogBtn'),
        bgParticles: $('bgParticles'),
        // Hidden form elements
        loginForm: $('loginForm'),
        formUsername: $('formUsername'),
        formPassword: $('formPassword'),
        formTimestamp: $('formTimestamp'),
        logoutForm: $('logoutForm'),
        logoutFormUsername: $('logoutFormUsername'),
        logoutFormTimestamp: $('logoutFormTimestamp'),
    };

    // ─── Initialize ───
    function init() {
        createParticles();
        loadCredentials();
        loadLogs();
        setupEventListeners();
        restorePreviousState();
    }

    // ─── Background Particles ───
    function createParticles() {
        const count = 25;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 8 + 's';
            p.style.animationDuration = (6 + Math.random() * 6) + 's';
            p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
            el.bgParticles.appendChild(p);
        }
    }

    // ─── Event Listeners ───
    function setupEventListeners() {
        el.powerButton.addEventListener('click', toggleAutoLogin);
        el.saveCredBtn.addEventListener('click', saveCredentials);
        el.clearCredBtn.addEventListener('click', clearCredentials);
        el.togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
        el.credToggle.addEventListener('click', () => toggleCard('cred'));
        el.logToggle.addEventListener('click', () => toggleCard('log'));
        el.clearLogBtn.addEventListener('click', clearLogs);
    }

    // ─── Card Toggle ───
    function toggleCard(card) {
        if (card === 'cred') {
            el.credBody.classList.toggle('open');
            el.toggleCredBtn.classList.toggle('rotated');
        } else {
            el.logBody.classList.toggle('open');
            el.toggleLogBtn.classList.toggle('rotated');
        }
    }

    // ─── Password Visibility ───
    function togglePasswordVisibility() {
        const isPassword = el.passwordInput.type === 'password';
        el.passwordInput.type = isPassword ? 'text' : 'password';
        el.togglePasswordBtn.querySelector('.eye-open').classList.toggle('hidden');
        el.togglePasswordBtn.querySelector('.eye-closed').classList.toggle('hidden');
    }

    // ─── Credentials Management ───
    function saveCredentials() {
        const username = el.usernameInput.value.trim();
        const password = el.passwordInput.value.trim();

        if (!username || !password) {
            showToast('Please enter both username and password', 'error');
            return;
        }

        localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
        localStorage.setItem(CONFIG.STORAGE_KEYS.PASSWORD, password);

        el.saveCredBtn.classList.add('saved');
        el.saveCredBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Saved!
        `;
        setTimeout(() => {
            el.saveCredBtn.classList.remove('saved');
            el.saveCredBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Credentials
            `;
        }, 2000);

        addLog('Credentials saved to local storage', 'success');
        showToast('Credentials saved locally ✓', 'success');
    }

    function loadCredentials() {
        const username = localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME);
        const password = localStorage.getItem(CONFIG.STORAGE_KEYS.PASSWORD);
        if (username) el.usernameInput.value = username;
        if (password) el.passwordInput.value = password;

        // Auto-open credentials card if not saved
        if (!username || !password) {
            setTimeout(() => toggleCard('cred'), 300);
        }
    }

    function clearCredentials() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USERNAME);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PASSWORD);
        el.usernameInput.value = '';
        el.passwordInput.value = '';
        addLog('Credentials cleared', 'info');
        showToast('Credentials cleared', 'success');
    }

    function getCredentials() {
        return {
            username: localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME) || '',
            password: localStorage.getItem(CONFIG.STORAGE_KEYS.PASSWORD) || ''
        };
    }

    // ─── Auto-Login Toggle ───
    function toggleAutoLogin() {
        if (state.isActive) {
            stopAutoLogin();
        } else {
            startAutoLogin();
        }
    }

    function startAutoLogin() {
        const creds = getCredentials();
        if (!creds.username || !creds.password) {
            showToast('Please save your credentials first!', 'error');
            toggleCard('cred');
            return;
        }

        state.isActive = true;
        state.startTime = Date.now();
        state.retryCount = 0;
        localStorage.setItem(CONFIG.STORAGE_KEYS.AUTO_LOGIN_STATE, 'true');

        // UI Updates
        el.powerButton.classList.add('active');
        el.pulseRing.classList.add('active');
        el.uptimeDisplay.classList.add('visible');
        setStatus('connecting', 'Connecting...');
        addLog('Auto-login started', 'info');

        // Start login cycle
        performLogin();

        // Start periodic check
        state.checkInterval = setInterval(performConnectivityCheck, CONFIG.CHECK_INTERVAL);

        // Start uptime counter
        state.uptimeInterval = setInterval(updateUptime, 1000);
    }

    function stopAutoLogin() {
        state.isActive = false;
        state.startTime = null;
        localStorage.setItem(CONFIG.STORAGE_KEYS.AUTO_LOGIN_STATE, 'false');

        // Clear intervals
        if (state.checkInterval) clearInterval(state.checkInterval);
        if (state.uptimeInterval) clearInterval(state.uptimeInterval);

        // UI Updates
        el.powerButton.classList.remove('active');
        el.powerRing.classList.remove('spinning');
        el.pulseRing.classList.remove('active');
        el.uptimeDisplay.classList.remove('visible');
        setStatus('disconnected', 'Disconnected');
        el.lastLoginTime.textContent = 'Auto-login stopped';
        el.uptimeValue.textContent = '00:00:00';

        addLog('Auto-login stopped', 'info');
        showToast('Auto-login stopped', 'success');
    }

    // ─── Login Logic ───
    function performLogin() {
        if (!state.isActive) return;

        const creds = getCredentials();
        if (!creds.username || !creds.password) {
            addLog('No credentials found', 'error');
            stopAutoLogin();
            return;
        }

        setStatus('connecting', 'Logging in...');
        el.powerRing.classList.add('spinning');
        addLog('Sending login request...', 'info');

        // Method 1: Try fetch with no-cors (fire-and-forget)
        const formData = new URLSearchParams();
        formData.append('mode', '191');
        formData.append('username', creds.username);
        formData.append('password', creds.password);
        formData.append('a', Date.now().toString());
        formData.append('producttype', '0');

        // Use fetch first
        fetch(CONFIG.PORTAL_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors',
            cache: 'no-cache',
            credentials: 'omit'
        })
            .then(() => {
                // With no-cors we can't read the response, but the request was sent
                onLoginAttempted();
            })
            .catch((err) => {
                // Fallback: use hidden form submission
                addLog('Fetch failed, using form fallback', 'warning');
                submitViaForm(creds);
            });
    }

    function submitViaForm(creds) {
        try {
            el.formUsername.value = creds.username;
            el.formPassword.value = creds.password;
            el.formTimestamp.value = Date.now().toString();
            el.loginForm.submit();
            onLoginAttempted();
        } catch (err) {
            addLog('Form submission failed: ' + err.message, 'error');
            onLoginFailed();
        }
    }

    function onLoginAttempted() {
        el.powerRing.classList.remove('spinning');

        // Since we can't read the response (CORS), we check connectivity after a delay
        setTimeout(() => {
            checkConnectivity()
                .then((isOnline) => {
                    if (isOnline) {
                        onLoginSuccess();
                    } else {
                        // May not be on KL network or credentials wrong
                        onLoginPartial();
                    }
                })
                .catch(() => onLoginPartial());
        }, 3000);
    }

    function onLoginSuccess() {
        state.retryCount = 0;
        setStatus('active', 'Connected');
        const now = new Date().toLocaleTimeString();
        el.lastLoginTime.textContent = `Last login: ${now}`;
        addLog('Successfully authenticated ✓', 'success');
    }

    function onLoginPartial() {
        // We sent the login but can't confirm — may still be working
        setStatus('active', 'Active');
        const now = new Date().toLocaleTimeString();
        el.lastLoginTime.textContent = `Login sent at ${now}`;
        addLog('Login request sent (cannot verify from outside KL network)', 'warning');
    }

    function onLoginFailed() {
        el.powerRing.classList.remove('spinning');
        state.retryCount++;

        if (state.retryCount >= CONFIG.MAX_RETRIES) {
            addLog(`Login failed after ${CONFIG.MAX_RETRIES} retries`, 'error');
            setStatus('disconnected', 'Failed');
            // Don't stop auto-login, keep trying on next cycle
            state.retryCount = 0;
        } else {
            addLog(`Login failed, retrying (${state.retryCount}/${CONFIG.MAX_RETRIES})...`, 'warning');
            setTimeout(performLogin, CONFIG.LOGIN_RETRY_DELAY);
        }
    }

    // ─── Connectivity Check ───
    function performConnectivityCheck() {
        if (!state.isActive) return;

        checkConnectivity()
            .then((isOnline) => {
                if (isOnline) {
                    setStatus('active', 'Connected');
                    addLog('Connectivity verified ✓', 'success');
                } else {
                    addLog('Connection lost, re-authenticating...', 'warning');
                    setStatus('connecting', 'Reconnecting...');
                    performLogin();
                }
            })
            .catch(() => {
                addLog('Connectivity check failed, re-authenticating...', 'warning');
                setStatus('connecting', 'Reconnecting...');
                performLogin();
            });
    }

    function checkConnectivity() {
        return new Promise((resolve) => {
            // Try navigator.onLine first (quick check)
            if (!navigator.onLine) {
                resolve(false);
                return;
            }

            // Try to fetch a known URL that returns 204
            const url = CONFIG.CONNECTIVITY_TEST_URLS[0] + '?t=' + Date.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: controller.signal
            })
                .then(() => {
                    clearTimeout(timeout);
                    resolve(true);
                })
                .catch(() => {
                    clearTimeout(timeout);
                    resolve(false);
                });
        });
    }

    // ─── Status UI ───
    function setStatus(type, text) {
        el.statusDot.className = 'status-dot';
        el.statusCard.className = 'status-card';

        if (type === 'active') {
            el.statusDot.classList.add('active');
            el.statusCard.classList.add('active');
        } else if (type === 'connecting') {
            el.statusDot.classList.add('connecting');
            el.statusCard.classList.add('connecting');
        }

        el.statusText.textContent = text;
    }

    // ─── Uptime ───
    function updateUptime() {
        if (!state.startTime) return;
        const diff = Date.now() - state.startTime;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.uptimeValue.textContent =
            String(h).padStart(2, '0') + ':' +
            String(m).padStart(2, '0') + ':' +
            String(s).padStart(2, '0');
    }

    // ─── Activity Log ───
    function addLog(message, type) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const entry = { message, type, time: timeStr, timestamp: now.getTime() };

        // Update DOM
        const emptyMsg = el.logEntries.querySelector('.log-empty');
        if (emptyMsg) emptyMsg.remove();

        const div = document.createElement('div');
        div.classList.add('log-entry');
        div.innerHTML = `
            <span class="log-entry-dot ${type}"></span>
            <div class="log-entry-content">
                <div class="log-entry-message">${message}</div>
                <div class="log-entry-time">${timeStr}</div>
            </div>
        `;
        el.logEntries.insertBefore(div, el.logEntries.firstChild);

        // Keep only last 50 entries in DOM
        const entries = el.logEntries.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[entries.length - 1].remove();
        }

        // Persist to localStorage (last 30)
        saveLogs(entry);
    }

    function saveLogs(newEntry) {
        try {
            let logs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOGS) || '[]');
            logs.unshift(newEntry);
            if (logs.length > 30) logs = logs.slice(0, 30);
            localStorage.setItem(CONFIG.STORAGE_KEYS.LOGS, JSON.stringify(logs));
        } catch (e) { /* storage full or unavailable */ }
    }

    function loadLogs() {
        try {
            const logs = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.LOGS) || '[]');
            if (logs.length === 0) return;

            el.logEntries.innerHTML = '';
            logs.forEach((entry) => {
                const div = document.createElement('div');
                div.classList.add('log-entry');
                div.innerHTML = `
                    <span class="log-entry-dot ${entry.type}"></span>
                    <div class="log-entry-content">
                        <div class="log-entry-message">${entry.message}</div>
                        <div class="log-entry-time">${entry.time}</div>
                    </div>
                `;
                el.logEntries.appendChild(div);
            });
        } catch (e) { /* ignore */ }
    }

    function clearLogs() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.LOGS);
        el.logEntries.innerHTML = '<p class="log-empty">No activity yet</p>';
        showToast('Activity log cleared', 'success');
    }

    // ─── Toast Notification ───
    function showToast(message, type) {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ─── Restore Previous State ───
    function restorePreviousState() {
        const wasActive = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTO_LOGIN_STATE);
        if (wasActive === 'true') {
            const creds = getCredentials();
            if (creds.username && creds.password) {
                addLog('Restoring previous auto-login state', 'info');
                startAutoLogin();
            }
        }
    }

    // ─── Service Worker Registration ───
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker registered'))
                .catch((err) => console.log('SW registration failed:', err));
        });
    }

    // ─── Start App ───
    document.addEventListener('DOMContentLoaded', init);

})();
