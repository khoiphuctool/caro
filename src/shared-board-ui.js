// shared-board-ui.js
// Unified UI layer for Bot Room, Normal Room, and VIP Room
// Refactors duplicate canvas initialization, resize, viewport, and zoom logic

const SharedBoardUI = (function() {
    // ================================================================
    // LIFECYCLE STATE
    // ================================================================
    const Lifecycle = {
        state: 'idle', // idle, initializing, running, destroying
        currentMode: null,
        
        setState(newState) {
            // console.log('[SharedBoardUI] Lifecycle state:', this.state, '->', newState);
            this.state = newState;
        },
        
        isRunning() {
            return this.state === 'running';
        },
        
        canInit() {
            return this.state === 'idle' || this.state === 'destroying';
        }
    };
    
    // ================================================================
    // CONFIG - Mode-specific settings
    // ================================================================
    const Config = {
        modes: {
            'bot': {
                canvasId: 'inf-canvas-bot',
                containerId: 'shared-board-bot',
                boardContainerId: 'bot-room-board-container',
                zoomStorageKey: null, // Use constant zoom
                defaultCellSize: 32,
                autoResize: true,
                useFullscreenLayout: true
            },
            'online': {
                canvasId: 'inf-canvas-online',
                containerId: 'shared-board-online',
                boardContainerId: 'battle-board-container',
                zoomStorageKey: 'caro_zoom_online',
                defaultCellSize: 28,
                autoResize: true,
                useFullscreenLayout: true // Now uses fullscreen layout like Bot Room
            }
        },
        currentMode: null,
        
        setMode(mode) {
            if (this.modes[mode]) {
                this.currentMode = mode;
                Lifecycle.currentMode = mode;
                // console.log('[SharedBoardUI] Mode set to:', mode);
            }
        },
        
        getConfig() {
            return this.modes[this.currentMode];
        }
    };
 
    // ================================================================
    // LAYOUT MANAGER - Responsive breakpoint detection
    // ================================================================
    const LayoutManager = {
        breakpoints: {
            mobile: 768,
            tablet: 1024,
            desktop: 1440
        },
        currentBreakpoint: null,
        resizeObserver: null,
        
        init(mode) {
            this.destroy(); // Cleanup existing observer
            
            const config = Config.modes[mode];
            const container = document.getElementById(config.containerId);
            
            if (!container) return;
            
            // Initial breakpoint detection
            this.updateBreakpoint();
            
            // Setup ResizeObserver for efficient layout changes
            this.resizeObserver = new ResizeObserver(() => {
                this.updateBreakpoint();
                this.onContainerResize();
            });
            
            this.resizeObserver.observe(container);
            // console.log('[SharedBoardUI] LayoutManager initialized for mode:', mode);
        },
        
        updateBreakpoint() {
            const width = window.innerWidth;
            let newBreakpoint;
            
            if (width < this.breakpoints.mobile) {
                newBreakpoint = 'mobile';
            } else if (width < this.breakpoints.tablet) {
                newBreakpoint = 'mobile';
            } else if (width < this.breakpoints.desktop) {
                newBreakpoint = 'tablet';
            } else {
                newBreakpoint = 'desktop';
            }
            
            if (newBreakpoint !== this.currentBreakpoint) {
                // console.log('[SharedBoardUI] Breakpoint changed:', this.currentBreakpoint, '->', newBreakpoint);
                this.currentBreakpoint = newBreakpoint;
                this.applyLayout();
            }
        },

        onContainerResize() {
            if (!CanvasManager.canvas) return;
            CanvasManager.resizeToContainer();
            if (typeof renderInfiniteBoard === 'function') {
                renderInfiniteBoard();
            }
        },
        
        applyLayout() {
            const mode = Lifecycle.currentMode;
            const config = Config.modes[mode];
            
            // Both bot and online now use fullscreen layout
            this.applyFullscreenLayout();
        },
        
        applyFullscreenLayout() {
            // Fullscreen overlay for both bot and online
            const boardContainer = document.getElementById(Config.modes[Lifecycle.currentMode].boardContainerId);
            if (boardContainer) {
                boardContainer.style.position = 'fixed';
                boardContainer.style.inset = '0';
                boardContainer.style.width = '100vw';
                boardContainer.style.height = '100dvh';
                boardContainer.style.zIndex = '1';
            }
            // console.log('[SharedBoardUI] Applied fullscreen layout for mode:', Lifecycle.currentMode);
        },
        
        destroy() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            this.currentBreakpoint = null;
        },
        
        getCurrentBreakpoint() {
            return this.currentBreakpoint;
        }
    };
 
    // ================================================================
    // CANVAS MANAGER - Canvas initialization and lifecycle
    // ================================================================
    const CanvasManager = {
        canvas: null,
        container: null,
        initialized: false,
        needsViewportResetAfterResize: false,
        
        init(mode) {
            // Prevent re-initialization if already running for same mode
            if (this.initialized && Lifecycle.currentMode === mode) {
                // console.log('[SharedBoardUI] Canvas already initialized for mode:', mode);
                return true;
            }
            
            const config = Config.modes[mode];
            if (!config) {
                console.error('[SharedBoardUI] Invalid mode:', mode);
                return false;
            }
            
            this.canvas = document.getElementById(config.canvasId);
            this.container = document.getElementById(config.containerId);
            
            if (!this.canvas || !this.container) {
                console.error('[SharedBoardUI] Canvas or container not found:', {
                    canvasId: config.canvasId,
                    containerId: config.containerId
                });
                return false;
            }
            
            // Set canvas dimensions to match container
            const hasContainerSize = this.resizeToContainer();
            if (!hasContainerSize) {
                // console.warn('[SharedBoardUI] Canvas container has no measurable size yet; continuing init and waiting for resize events');
                this.needsViewportResetAfterResize = true;
            }
            
            // YC.TXT FIX: Do not fail initialization when the canvas is initially hidden.
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                // console.warn('[SharedBoardUI] Canvas has zero dimensions after resize, continuing initialization');
            }
            
            // Update global variables for renderer
            if (typeof infCanvasW !== 'undefined') infCanvasW = this.canvas.width;
            if (typeof infCanvasH !== 'undefined') infCanvasH = this.canvas.height;
            
            this.initialized = true;
            // console.log('[SharedBoardUI] Canvas initialized:', {
                // mode,
                // canvasId: this.canvas.id,
                // width: this.canvas.width,
                // height: this.canvas.height
            // });
            
            return true;
        },
        
        resizeToContainer() {
            if (!this.canvas || !this.container) return false;
            
            const containerRect = this.container.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;
            
            if (containerWidth <= 0 || containerHeight <= 0) {
                // console.warn('[SharedBoardUI] resizeToContainer skipped because container has no size yet:', {
                    // containerId: this.container.id,
                    // width: containerWidth,
                    // height: containerHeight
                // });
                return false;
            }
            
            // Only resize if dimensions actually changed (prevent flicker)
            if (this.canvas.width !== containerWidth || this.canvas.height !== containerHeight) {
                this.canvas.width = containerWidth;
                this.canvas.height = containerHeight;
                this.canvas.style.width = containerWidth + 'px';
                this.canvas.style.height = containerHeight + 'px';
                
                // Update global variables
                if (typeof infCanvasW !== 'undefined') infCanvasW = this.canvas.width;
                if (typeof infCanvasH !== 'undefined') infCanvasH = this.canvas.height;
                
                // console.log('[SharedBoardUI] Canvas resized:', { width: containerWidth, height: containerHeight });

                if (this.needsViewportResetAfterResize && typeof ViewportManager !== 'undefined' && typeof ViewportManager.resetToCenter === 'function') {
                    // console.log('[SharedBoardUI] Resetting viewport after late canvas resize');
                    ViewportManager.resetToCenter();
                    this.needsViewportResetAfterResize = false;
                }
            }
            return true;
        },
        
        getCanvas() {
            return this.canvas;
        },
        
        getContainer() {
            return this.container;
        }
    };
 
    // ================================================================
    // VIEWPORT MANAGER - Viewport offset and camera
    // ================================================================
    const ViewportManager = {
        resetToCenter() {
            if (typeof vRowF !== 'undefined' && typeof vColF !== 'undefined' &&
                typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined' &&
                typeof INF_CS !== 'undefined') {
                vRowF = -Math.floor(infCanvasH / INF_CS / 2);
                vColF = -Math.floor(infCanvasW / INF_CS / 2);
                // console.log('[SharedBoardUI] Viewport reset to center:', { vRowF, vColF, infCanvasW, infCanvasH, INF_CS });
                
                // YC.TXT FIX: Trigger render after viewport reset to ensure canvas renders immediately
                if (typeof renderInfiniteBoard === 'function') {
                    requestAnimationFrame(() => {
                        renderInfiniteBoard();
                        // console.log('[SharedBoardUI] renderInfiniteBoard called after viewport reset');
                    });
                }
            }
        },
        
        getViewport() {
            return {
                vRowF: typeof vRowF !== 'undefined' ? vRowF : 0,
                vColF: typeof vColF !== 'undefined' ? vColF : 0
            };
        }
    };
 
    // ================================================================
    // ZOOM MANAGER - Zoom level and persistence
    // ================================================================
    const ZoomManager = {
        init(mode) {
            const config = Config.modes[mode];
            
            if (mode === 'online') {
                const savedZoom = parseFloat(localStorage.getItem(config.zoomStorageKey));
                const INF_CS_MIN = 16;
                const INF_CS_MAX = 60;
                INF_CS = (savedZoom >= INF_CS_MIN && savedZoom <= INF_CS_MAX) ? savedZoom : config.defaultCellSize;
            } else if (mode === 'bot') {
                INF_CS = config.defaultCellSize;
            }
            
            // console.log('[SharedBoardUI] Zoom initialized:', { mode, INF_CS });
        },
        
        saveZoom(mode) {
            const config = Config.modes[mode];
            if (config.zoomStorageKey && typeof INF_CS !== 'undefined') {
                localStorage.setItem(config.zoomStorageKey, INF_CS);
            }
        }
    };
 
    // ================================================================
    // RESIZE MANAGER - Responsive layout
    // ================================================================
    const ResizeManager = {
        handler: null,
        timeout: null,
        lastWidth: 0,
        lastHeight: 0,
        
        init(mode) {
            // Remove existing handler first (prevent duplicates)
            this.destroy();
            
            // Store initial dimensions
            this.lastWidth = window.innerWidth;
            this.lastHeight = window.innerHeight;
            
            this.handler = () => {
                const currentWidth = window.innerWidth;
                const currentHeight = window.innerHeight;
                
                // Only process if dimensions actually changed
                if (currentWidth === this.lastWidth && currentHeight === this.lastHeight) {
                    return;
                }
                
                this.lastWidth = currentWidth;
                this.lastHeight = currentHeight;
                
                clearTimeout(this.timeout);
                this.timeout = setTimeout(() => {
                    CanvasManager.resizeToContainer();
                    
                    // Re-render board
                    if (typeof renderInfiniteBoard === 'function') {
                        renderInfiniteBoard();
                    }
                }, 100);
            };
            
            window.addEventListener('resize', this.handler);
            // console.log('[SharedBoardUI] Resize listener added for mode:', mode);
        },
        
        destroy() {
            if (this.handler) {
                window.removeEventListener('resize', this.handler);
                this.handler = null;
            }
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
        },
        
        // For online mode: fit to container with debounce
        fitToContainer() {
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                if (typeof fitCanvasToContainer === 'function') {
                    fitCanvasToContainer();
                }
            }, 100);
        },
        
        // For online mode: auto-resize
        autoResize() {
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                if (typeof autoResizeInfCanvas === 'function') {
                    autoResizeInfCanvas();
                }
            }, 100);
        }
    };
 
    // ================================================================
    // EVENT MANAGER - Mouse/Touch/Keyboard events
    // ================================================================
    const EventManager = {
        bound: false,
        
        bind(canvas) {
            if (!canvas || this.bound) return;
            
            // Mouse events
            canvas.onmousedown = infOnMouseDown;
            canvas.onmousemove = infOnMouseMove;
            canvas.onmouseup = infOnMouseUp;
            canvas.onmouseleave = infOnMouseLeave;
            canvas.onclick = infOnClick;
            canvas.oncontextmenu = e => e.preventDefault();
            
            // Touch events
            canvas.ontouchstart = infOnTouchStart;
            canvas.ontouchmove = infOnTouchMove;
            canvas.ontouchend = infOnTouchEnd;
            
            // Wheel event
            canvas.addEventListener('wheel', infOnWheel, { passive: false });
            
            // Keyboard events
            document.removeEventListener('keydown', infOnKeyDown);
            document.addEventListener('keydown', infOnKeyDown);
            
            this.bound = true;
            // console.log('[SharedBoardUI] Events bound to canvas:', canvas.id);
        },
        
        unbind(canvas) {
            if (!canvas) return;
            
            canvas.onmousedown = null;
            canvas.onmousemove = null;
            canvas.onmouseup = null;
            canvas.onmouseleave = null;
            canvas.onclick = null;
            canvas.oncontextmenu = null;
            canvas.ontouchstart = null;
            canvas.ontouchmove = null;
            canvas.ontouchend = null;
            canvas.removeEventListener('wheel', infOnWheel);
            
            this.bound = false;
            // console.log('[SharedBoardUI] Events unbound from canvas:', canvas.id);
        }
    };
 
    // ================================================================
    // UI CONTROLS - D-pad, resize handles
    // ================================================================
    const UIControls = {
        setup() {
            if (typeof setupResizeHandles === 'function') {
                setupResizeHandles();
            }
            if (typeof setupDpadControls === 'function') {
                setupDpadControls();
            }
            // console.log('[SharedBoardUI] UI controls setup');
        }
    };
 
    // ================================================================
    // PUBLIC API
    // ================================================================
    return {
        Config,
        CanvasManager,
        ViewportManager,
        ZoomManager,
        ResizeManager,
        LayoutManager,
        EventManager,
        UIControls,
        Lifecycle,
        
        // Main initialization function
        init(mode) {
            // console.log('[SharedBoardUI] init() called for mode:', mode, 'current state:', Lifecycle.state, 'currentMode:', Lifecycle.currentMode);
            
            // Prevent multiple initialization
            if (!Lifecycle.canInit()) {
                // console.warn('[SharedBoardUI] Cannot init - current state:', Lifecycle.state, 'requested mode:', mode);
                return false;
            }
            
            // If already running for same mode, skip
            if (Lifecycle.isRunning() && Lifecycle.currentMode === mode) {
                // console.log('[SharedBoardUI] Already initialized for mode:', mode);
                return true;
            }
            
            Lifecycle.setState('initializing');
            // console.log('[SharedBoardUI] Initializing for mode:', mode);
            
            Config.setMode(mode);
            
            // Initialize canvas
            if (!CanvasManager.init(mode)) {
                Lifecycle.setState('idle');
                return false;
            }
            
            // Initialize layout manager
            LayoutManager.init(mode);
            
            // Initialize zoom
            ZoomManager.init(mode);
            
            // Reset viewport to center
            ViewportManager.resetToCenter();
            
            // Bind events
            EventManager.bind(CanvasManager.getCanvas());
            
            // Setup UI controls
            UIControls.setup();
            
            // Initialize resize listener
            ResizeManager.init(mode);

            // Schedule a second sizing pass after layout stabilizes
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    CanvasManager.resizeToContainer();
                    if (typeof renderInfiniteBoard === 'function') {
                        renderInfiniteBoard();
                    }
                });
            });
            
            // Update global infCanvas for renderer
            if (typeof infCanvas !== 'undefined') {
                infCanvas = CanvasManager.getCanvas();
            }
            if (typeof infCtx !== 'undefined') {
                infCtx = CanvasManager.getCanvas().getContext('2d');
            }
            
            Lifecycle.setState('running');
            // console.log('[SharedBoardUI] Initialization complete for mode:', mode);
            return true;
        },
        
        // Cleanup function
        destroy() {
            // console.log('[SharedBoardUI] destroy() called, current state:', Lifecycle.state, 'currentMode:', Lifecycle.currentMode);
            
            // Prevent double destroy
            if (Lifecycle.state === 'idle') {
                // console.log('[SharedBoardUI] Already idle, skipping destroy');
                return;
            }
            
            Lifecycle.setState('destroying');
            // console.log('[SharedBoardUI] Destroying...');
            
            ResizeManager.destroy();
            LayoutManager.destroy();
            EventManager.unbind(CanvasManager.getCanvas());
            CanvasManager.initialized = false;
            
            Lifecycle.setState('idle');
            Lifecycle.currentMode = null;
            // console.log('[SharedBoardUI] Destroyed, state:', Lifecycle.state);
        },
        
        // Get current canvas
        getCanvas() {
            return CanvasManager.getCanvas();
        }
    };
})();
