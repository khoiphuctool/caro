(function(global){
    const listenerRegistry = new Map();
    const timerRegistry = new Map();
    const callbackRegistry = new Map();

    function makeKey(scope, key) {
        return `${scope}:${String(key || 'default')}`;
    }

    function registerListener(scope, key, ref, event, callback) {
        const registryKey = `${makeKey(scope, key)}:${event || 'default'}`;
        const existing = listenerRegistry.get(registryKey);
        if (existing && existing.callback === callback) {
            console.warn(`[RuntimeGuard] Duplicate listener ignored for ${registryKey}`);
            return existing;
        }
        if (existing) {
            console.warn(`[RuntimeGuard] Duplicate listener replaced for ${registryKey}`);
            try { existing.ref.off(existing.event, existing.callback); } catch (err) {}
        }
        listenerRegistry.set(registryKey, { ref, event, callback });
        return { ref, event, callback };
    }

    function unregisterListener(scope, key, ref, event, callback) {
        const registryKey = `${makeKey(scope, key)}:${event || 'default'}`;
        const existing = listenerRegistry.get(registryKey);
        if (existing && existing.callback === callback) {
            try { existing.ref.off(existing.event, existing.callback); } catch (err) {}
            listenerRegistry.delete(registryKey);
            return true;
        }
        if (ref && callback) {
            try { ref.off(event, callback); } catch (err) {}
        }
        return false;
    }

    function markCallback(scope, key) {
        const registryKey = makeKey(scope, key);
        const count = (callbackRegistry.get(registryKey) || 0) + 1;
        callbackRegistry.set(registryKey, count);
        if (count > 1) {
            console.warn(`[RuntimeGuard] Duplicate callback for ${registryKey}`);
        }
        return count;
    }

    function registerTimer(scope, key, timerId, description) {
        const registryKey = makeKey(scope, key);
        const existing = timerRegistry.get(registryKey);
        if (existing) {
            console.warn(`[RuntimeGuard] Timer leak detected for ${registryKey}${description ? ' [' + description + ']' : ''}`);
            try { clearTimeout(existing); } catch (err) {}
            try { clearInterval(existing); } catch (err) {}
        }
        timerRegistry.set(registryKey, timerId);
        return timerId;
    }

    function clearTimer(scope, key) {
        const registryKey = makeKey(scope, key);
        const timerId = timerRegistry.get(registryKey);
        if (timerId) {
            try { clearTimeout(timerId); } catch (err) {}
            try { clearInterval(timerId); } catch (err) {}
            timerRegistry.delete(registryKey);
        }
    }

    function clearAll(scope) {
        for (const [registryKey, timerId] of timerRegistry.entries()) {
            if (!scope || registryKey.startsWith(scope + ':')) {
                try { clearTimeout(timerId); } catch (err) {}
                try { clearInterval(timerId); } catch (err) {}
            }
        }
        if (!scope) {
            timerRegistry.clear();
        } else {
            for (const registryKey of Array.from(timerRegistry.keys())) {
                if (registryKey.startsWith(scope + ':')) timerRegistry.delete(registryKey);
            }
        }
    }

    global.runtimeGuard = {
        registerListener,
        unregisterListener,
        markCallback,
        registerTimer,
        clearTimer,
        clearAll
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
