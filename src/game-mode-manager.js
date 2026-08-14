// ══════════════════════════════════════════════════════════════════
// GAME MODE MANAGER - Centralized Mode Management (YC.TXT FIX)
// ══════════════════════════════════════════════════════════════════
// This file provides a SINGLE source of truth for game mode state
// Prevents "Phòng Ma" and mode conflicts

(function() {
    'use strict';

    // ══════════════════════════════════════════════════════════════════
    // MODE ENUMERATIONS
    // ══════════════════════════════════════════════════════════════════
    const GameModes = {
        NONE: 'none',
        BOT_ROOM: 'bot_room',
        TRAINING: 'training',
        SOLO: 'solo',
        ONLINE: 'online',
        REPLAY: 'replay'
    };

    // ══════════════════════════════════════════════════════════════════
    // STATE
    // ══════════════════════════════════════════════════════════════════
    let currentMode = GameModes.NONE;
    let modeContext = null; // Stores mode-specific data (bot config, room id, etc.)
    let modeChangeCallbacks = []; // Callbacks when mode changes

    // ══════════════════════════════════════════════════════════════════
    // PRIVATE FUNCTIONS
    // ══════════════════════════════════════════════════════════════════
    
    function saveModeToStorage() {
        localStorage.setItem('game_mode_current', currentMode);
        if (modeContext) {
            localStorage.setItem('game_mode_context', JSON.stringify(modeContext));
        } else {
            localStorage.removeItem('game_mode_context');
        }
    }

    function loadModeFromStorage() {
        const savedMode = localStorage.getItem('game_mode_current');
        const savedContext = localStorage.getItem('game_mode_context');
        
        if (savedMode && Object.values(GameModes).includes(savedMode)) {
            currentMode = savedMode;
            if (savedContext) {
                try {
                    modeContext = JSON.parse(savedContext);
                } catch(e) {
                    console.error('[GameModeManager] Failed to parse context:', e);
                    modeContext = null;
                }
            }
            return true;
        }
        return false;
    }

    function clearModeFromStorage() {
        localStorage.removeItem('game_mode_current');
        localStorage.removeItem('game_mode_context');
    }

    // ══════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════
    
    const GameModeManager = {
        // Get current mode
        getCurrentMode: function() {
            return currentMode;
        },

        // Check if in specific mode
        isMode: function(mode) {
            return currentMode === mode;
        },

        // Check if in any active mode
        isActive: function() {
            return currentMode !== GameModes.NONE;
        },

        // Set mode (with context)
        setMode: function(mode, context = null) {
            // Validate mode
            if (!Object.values(GameModes).includes(mode)) {
                console.error('[GameModeManager] Invalid mode:', mode);
                return false;
            }

            const previousMode = currentMode;
            
            // If switching from one mode to another, cleanup first
            if (currentMode !== GameModes.NONE && currentMode !== mode) {
                // console.warn('[GameModeManager] Switching from', currentMode, 'to', mode, '- cleanup required');
            }

            currentMode = mode;
            modeContext = context;
            saveModeToStorage();
            
            // console.log('[GameModeManager] Mode set to:', mode, 'with context:', context);
            
            // Trigger mode change callbacks
            modeChangeCallbacks.forEach(callback => {
                try {
                    callback(mode, previousMode, context);
                } catch (e) {
                    console.error('[GameModeManager] Mode change callback error:', e);
                }
            });
            
            return true;
        },

        // Clear mode (return to NONE)
        clearMode: function() {
            const previousMode = currentMode;
            currentMode = GameModes.NONE;
            modeContext = null;
            clearModeFromStorage();
            
            // Trigger mode change callbacks
            modeChangeCallbacks.forEach(callback => {
                try {
                    callback(GameModes.NONE, previousMode, null);
                } catch (e) {
                    console.error('[GameModeManager] Mode change callback error:', e);
                }
            });
            
            return previousMode;
        },
        
        // Register callback for mode changes
        onModeChange: function(callback) {
            if (typeof callback === 'function') {
                modeChangeCallbacks.push(callback);
                // console.log('[GameModeManager] Mode change callback registered');
            }
        },

        // Get mode context
        getContext: function() {
            return modeContext;
        },

        // Restore mode from storage (called on page load)
        restoreMode: function() {
            if (loadModeFromStorage()) {
                // YC.TXT FIX: Skip BOT mode restore to prevent "Phòng Ma" and mode conflicts
                if (currentMode === GameModes.BOT_ROOM) {
                    clearMode();
                    return GameModes.NONE;
                }
                return currentMode;
            }
            return GameModes.NONE;
        },

        // Mode helpers
        isBotRoom: function() { return currentMode === GameModes.BOT_ROOM; },
        isTraining: function() { return currentMode === GameModes.TRAINING; },
        isSolo: function() { return currentMode === GameModes.SOLO; },
        isOnline: function() { return currentMode === GameModes.ONLINE; },
        isReplay: function() { return currentMode === GameModes.REPLAY; },

        // Get mode enum for reference
        getModes: function() {
            return GameModes;
        }
    };

    // ══════════════════════════════════════════════════════════════════
    // EXPOSE GLOBAL
    // ══════════════════════════════════════════════════════════════════
    window.GameModeManager = GameModeManager;
    window.GameModes = GameModes;

    // console.log('[GameModeManager] Initialized');

})();
