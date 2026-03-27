(function() {
    const EXPIRY_KEY = 'icegate_disposable_expiry';
    const STATUS_KEY = 'icegate_disposable_status';
    const DURATION_MS = 5 * 60 * 1000; // 5 minutes

    function checkExpiry() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const status = localStorage.getItem(STATUS_KEY);

        // If already expired, block immediately
        if (status === 'expired') {
            document.documentElement.innerHTML = `
                <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; background:#f8fafc; color:#1e293b; text-align:center; padding:20px;">
                    <div style="font-size:4rem; margin-bottom:20px;">🔒</div>
                    <h1 style="font-size:1.5rem;">Link Expired</h1>
                    <p style="color:#64748b; max-width:400px;">This disposable view session has ended for security reasons. Access is no longer available.</p>
                </div>
            `;
            return true;
        }

        // Only start timer if mode=disposable is present
        if (mode === 'disposable') {
            let expiryTime = localStorage.getItem(EXPIRY_KEY);
            
            if (!expiryTime) {
                expiryTime = Date.now() + DURATION_MS;
                localStorage.setItem(EXPIRY_KEY, expiryTime);
            }

            const interval = setInterval(() => {
                const now = Date.now();
                const remaining = expiryTime - now;

                if (remaining <= 0) {
                    clearInterval(interval);
                    localStorage.setItem(STATUS_KEY, 'expired');
                    location.reload(); // Reload to trigger the "expired" view
                } else {
                    updateTimerUI(remaining);
                }
            }, 1000);

            injectTimerUI();
            return false;
        }
        return false;
    }

    function injectTimerUI() {
        if (document.getElementById('disposable-timer')) return;
        const timerDiv = document.createElement('div');
        timerDiv.id = 'disposable-timer';
        timerDiv.style.position = 'fixed';
        timerDiv.style.bottom = '20px';
        timerDiv.style.right = '20px';
        timerDiv.style.background = '#ef4444';
        timerDiv.style.color = 'white';
        timerDiv.style.padding = '10px 15px';
        timerDiv.style.borderRadius = '8px';
        timerDiv.style.fontWeight = 'bold';
        timerDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        timerDiv.style.zIndex = '9999';
        timerDiv.style.fontSize = '14px';
        timerDiv.innerHTML = '🔒 DISPOSABLE VIEW — Expiring in <span id="ds-clock">5:00</span>';
        document.body.appendChild(timerDiv);
    }

    function updateTimerUI(ms) {
        const clock = document.getElementById('ds-clock');
        if (!clock) return;
        const totalSecs = Math.max(0, Math.floor(ms / 1000));
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        clock.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        // Pulse effect when under 30 seconds
        if (totalSecs < 30) {
            document.getElementById('disposable-timer').style.animation = 'ds-pulse 1s infinite';
        }
    }

    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ds-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); background: #b91c1c; }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkExpiry);
    } else {
        checkExpiry();
    }
})();
