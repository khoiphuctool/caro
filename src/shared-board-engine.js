// ===================================================================
// SHARED BOARD ENGINE - Common board system for Online & Practice
// Architecture from DO4.TXT:
// - Infinite world coordinates (not limited to fixed sizes)
// - Camera system (x, y, zoom) independent of board state
// - Coordinate transform (world ↔ screen)
// - Visible region rendering (only render what's visible)
// - Pan/zoom controls (mouse + touch)
// - Responsive layout for Desktop/Tablet/Mobile
// ===================================================================

const SharedBoardEngine = (function() {
    // ================================================================
    // BOARD STATE - Infinite world coordinates
    // ================================================================
    const BoardState = {
        // Map of moves: key = "x,y", value = { x, y, player }
        moves: new Map(),
        
        // Winning cells for highlighting
        winningCells: [],
        
        // Last move for highlighting
        lastMove: null,
        
        // Clear all moves
        clear() {
            // console.log('[BoardState.clear] Clearing board state, moves before:', this.moves.size);
            this.moves.clear();
            this.winningCells = [];
            this.lastMove = null;
        },
        
        // Add a move at world coordinates
        addMove(x, y, player) {
            const key = `${x},${y}`;
            this.moves.set(key, { x, y, player });
            this.lastMove = { x, y, player };
            // console.log('[BoardState.addMove] Added move:', { x, y, player, totalMoves: this.moves.size });
        },
        
        // Get move at world coordinates
        getMove(x, y) {
            return this.moves.get(`${x},${y}`);
        },
        
        // Remove move at world coordinates
        removeMove(x, y) {
            const key = `${x},${y}`;
            this.moves.delete(key);
        },
        
        // Check if cell is occupied
        isOccupied(x, y) {
            return this.moves.has(`${x},${y}`);
        },
        
        // Set winning cells
        setWinningCells(cells) {
            this.winningCells = cells || [];
        },
        
        // Get all moves as array
        getAllMoves() {
            return Array.from(this.moves.values());
        }
    };

    // ================================================================
    // CAMERA SYSTEM - Independent of board state
    // ================================================================
    const Camera = {
        x: 0,           // Camera center X in world coordinates
        y: 0,           // Camera center Y in world coordinates
        zoom: 1,        // Zoom level (affects cell size display)
        minZoom: 0.5,   // Minimum zoom
        maxZoom: 3.0,   // Maximum zoom
        
        // Reset camera to origin
        reset() {
            this.x = 0;
            this.y = 0;
            this.zoom = 1;
        },
        
        // Set camera position
        setPosition(x, y) {
            this.x = x;
            this.y = y;
        },
        
        // Set zoom level (clamped)
        setZoom(zoom) {
            this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        },
        
        // Move camera by delta
        move(dx, dy) {
            this.x += dx;
            this.y += dy;
        },
        
        // Zoom at screen position (keep point under cursor stable)
        zoomAt(screenX, screenY, deltaZoom, viewportWidth, viewportHeight) {
            const oldZoom = this.zoom;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom + deltaZoom));
            
            if (newZoom === oldZoom) return;
            
            // Calculate world position before zoom
            const worldPos = CoordinateTransform.screenToWorld(screenX, screenY, viewportWidth, viewportHeight);
            
            // Apply new zoom
            this.zoom = newZoom;
            
            // Calculate new camera position to keep worldPos at same screen position
            const zoomRatio = newZoom / oldZoom;
            this.x = worldPos.x - (worldPos.x - this.x) / zoomRatio;
            this.y = worldPos.y - (worldPos.y - this.y) / zoomRatio;
        }
    };

    // ================================================================
    // VIEWPORT CONTROL - Separate from zoom (DO8.TXT)
    // ================================================================
    const ViewportControl = {
        // Viewport size presets (percentage of available space)
        presets: {
            'small': 0.5,      // 50% of available space
            'medium': 0.7,     // 70% of available space
            'large': 0.85,     // 85% of available space
            'full': 1.0        // 100% of available space
        },
        currentPreset: 'large',
        autoMode: true,       // Auto-calculate optimal size
        
        // Set viewport size preset
        setPreset(preset) {
            if (this.presets[preset]) {
                this.currentPreset = preset;
                this.autoMode = false;
                this.applySize();
            }
        },
        
        // Enable auto mode
        setAutoMode(enabled) {
            this.autoMode = enabled;
            if (enabled) {
                this.applySize();
            }
        },
        
        // Apply viewport size based on current mode
        applySize() {
            if (!Renderer.canvas) return;
            
            const container = Renderer.canvas.parentElement;
            if (!container) return;
            
            const containerRect = container.getBoundingClientRect();
            const availableWidth = containerRect.width;
            const availableHeight = containerRect.height;
            
            let targetWidth, targetHeight;
            
            if (this.autoMode) {
                // DO8.TXT: Auto-calculate optimal viewport size
                // Use 90% of available space by default
                targetWidth = availableWidth * 0.9;
                targetHeight = availableHeight * 0.9;
            } else {
                const ratio = this.presets[this.currentPreset];
                targetWidth = availableWidth * ratio;
                targetHeight = availableHeight * ratio;
            }
            
            // Apply size to canvas
            Renderer.canvas.style.width = `${targetWidth}px`;
            Renderer.canvas.style.height = `${targetHeight}px`;
            
            // Center canvas in container
            Renderer.canvas.style.marginLeft = 'auto';
            Renderer.canvas.style.marginRight = 'auto';
            Renderer.canvas.style.marginTop = 'auto';
            Renderer.canvas.style.marginBottom = 'auto';
            
            // Update viewport and re-render
            Renderer.updateViewport();
            Renderer.render();
        }
    };

    // ================================================================
    // COORDINATE TRANSFORM - World ↔ Screen
    // ================================================================
    const CoordinateTransform = {
        cellSize: 60,  // DO8.TXT: Increased base cell size for better visibility
        
        // World to Screen coordinate
        worldToScreen(worldX, worldY, viewportWidth, viewportHeight) {
            const zoom = Camera.zoom;
            const cs = this.cellSize * zoom;
            
            const screenX = (viewportWidth / 2) + (worldX - Camera.x) * cs;
            const screenY = (viewportHeight / 2) + (worldY - Camera.y) * cs;
            
            return { x: screenX, y: screenY };
        },
        
        // Screen to World coordinate
        screenToWorld(screenX, screenY, viewportWidth, viewportHeight) {
            const zoom = Camera.zoom;
            const cs = this.cellSize * zoom;
            
            const worldX = Camera.x + (screenX - viewportWidth / 2) / cs;
            const worldY = Camera.y + (screenY - viewportHeight / 2) / cs;
            
            return { x: worldX, y: worldY };
        },
        
        // Screen to Grid coordinate (cell-based - use floor for cell selection)
        // DO8.TXT: Click anywhere in a cell should select that cell
        screenToGrid(screenX, screenY, viewportWidth, viewportHeight) {
            const worldPos = this.screenToWorld(screenX, screenY, viewportWidth, viewportHeight);
            return {
                x: Math.floor(worldPos.x),
                y: Math.floor(worldPos.y)
            };
        },
        
        // Set cell size
        setCellSize(size) {
            this.cellSize = Math.max(18, Math.min(80, size));
        }
    };

    // ================================================================
    // RENDERER - Canvas-based rendering with visible region optimization
    // ================================================================
    const Renderer = {
        canvas: null,
        ctx: null,
        viewportWidth: 0,
        viewportHeight: 0,
        initialized: false, // Prevent duplicate initialization
        
        // Theme colors
        themes: {
            'pure-white':  { bg: '#ffffff', grid: '#94a3b8', x: '#2563eb', o: '#dc2626', lastMove: '#f59e0b', win: '#dbeafe' },
            'pure-black':  { bg: '#242440', grid: '#6b6b90', x: '#818cf8', o: '#f472b6', lastMove: '#f59e0b', win: '#3730a3' },
            'cyber':       { bg: '#1e293b', grid: '#475569', x: '#38bdf8', o: '#f43f5e', lastMove: '#f43f5e', win: '#0284c7' },
            'luxury-wood': { bg: '#c2996b', grid: '#5c3d2e', x: '#ffffff', o: '#111111', lastMove: '#ffd700', win: '#b08556' }
        },
        currentTheme: 'pure-white',
        boardSkin: null,  // Board skin from shop
        
        // Skin support
        skinX: { icon: 'X', color: null },
        skinO: { icon: 'O', color: null },
        
        // Initialize renderer
        init(canvasElement) {
            // Prevent duplicate initialization
            if (this.initialized && this.canvas === canvasElement) {
                // console.warn('Renderer already initialized with this canvas, skipping duplicate init');
                return;
            }
            
            // Clean up previous canvas if different
            if (this.initialized && this.canvas !== canvasElement) {
                this.destroy();
            }
            
            this.canvas = canvasElement;
            this.ctx = canvasElement.getContext('2d');
            
            // Debug: Log canvas dimensions before updateViewport
            const rect = canvasElement.getBoundingClientRect();
            // console.log('[Renderer Init] Canvas dimensions before updateViewport:', {
                // width: rect.width,
                // height: rect.height,
                // display: window.getComputedStyle(canvasElement).display,
                // visibility: window.getComputedStyle(canvasElement).visibility
            // });
            
            this.updateViewport();
            this.initialized = true;
        },
        
        // Destroy renderer
        destroy() {
            this.canvas = null;
            this.ctx = null;
            this.initialized = false;
        },
        
        // Update viewport size
        updateViewport() {
            if (!this.canvas) return;
            const rect = this.canvas.getBoundingClientRect();
            this.viewportWidth = rect.width;
            this.viewportHeight = rect.height;
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        },
        
        // Set theme
        setTheme(themeName) {
            if (this.themes[themeName]) {
                this.currentTheme = themeName;
            }
        },
        
        // Set skins
        setSkins(skinX, skinO) {
            this.skinX = skinX || { icon: 'X', color: null };
            this.skinO = skinO || { icon: 'O', color: null };
        },
        
        // Set board skin from shop
        setBoardSkin(skin) {
            this.boardSkin = skin;
        },
        
        // Main render function
        render() {
            if (!this.ctx || !this.canvas) {
                // console.warn('[SharedBoardEngine.render] Cannot render - ctx or canvas missing', {
                    // hasCtx: !!this.ctx,
                    // hasCanvas: !!this.canvas,
                    // canvasId: this.canvas?.id
                // });
                return;
            }
            
            const ctx = this.ctx;
            const W = this.viewportWidth;
            const H = this.viewportHeight;
            let theme = this.themes[this.currentTheme];
            
            // Override with board skin if equipped
            if (this.boardSkin) {
                theme = {
                    ...theme,
                    bg: this.boardSkin.bg,
                    grid: this.boardSkin.grid,
                    win: this.boardSkin.win,
                    lastMove: this.boardSkin.lastMove
                };
            }
            
            // console.log('[SharedBoardEngine.render] Rendering:', {
                // viewportWidth: W,
                // viewportHeight: H,
                // theme: this.currentTheme,
                // cameraZoom: Camera.zoom,
                // cameraX: Camera.x,
                // cameraY: Camera.y
            // });
            
            // Clear canvas completely before rendering (prevent grid multiplication)
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = theme.bg;
            ctx.fillRect(0, 0, W, H);
            
            // Calculate visible region
            const visibleRegion = this.calculateVisibleRegion();
            
            // console.log('[SharedBoardEngine.render] Visible region:', visibleRegion);
            
            // Render grid
            this.renderGrid(ctx, visibleRegion, theme);
            
            // Render pieces
            this.renderPieces(ctx, visibleRegion, theme);
        },
        
        // Calculate visible world region
        calculateVisibleRegion() {
            const topLeft = CoordinateTransform.screenToWorld(0, 0, this.viewportWidth, this.viewportHeight);
            const bottomRight = CoordinateTransform.screenToWorld(this.viewportWidth, this.viewportHeight, this.viewportWidth, this.viewportHeight);
            
            return {
                minX: Math.floor(topLeft.x) - 1,
                maxX: Math.ceil(bottomRight.x) + 1,
                minY: Math.floor(topLeft.y) - 1,
                maxY: Math.ceil(bottomRight.y) + 1
            };
        },
        
        // Render grid lines (cell-based - lines at cell boundaries)
        // DO8.TXT: Grid lines form cell boundaries, pieces are inside cells
        renderGrid(ctx, region, theme) {
            const zoom = Camera.zoom;
            const cs = CoordinateTransform.cellSize * zoom;
            
            ctx.strokeStyle = theme.grid;
            ctx.lineWidth = 1 / zoom; // Keep line width consistent
            
            // Vertical lines at cell boundaries
            for (let x = region.minX; x <= region.maxX; x++) {
                const screenPos = CoordinateTransform.worldToScreen(x, 0, this.viewportWidth, this.viewportHeight);
                ctx.beginPath();
                ctx.moveTo(screenPos.x, 0);
                ctx.lineTo(screenPos.x, this.viewportHeight);
                ctx.stroke();
            }
            
            // Horizontal lines at cell boundaries
            for (let y = region.minY; y <= region.maxY; y++) {
                const screenPos = CoordinateTransform.worldToScreen(0, y, this.viewportWidth, this.viewportHeight);
                ctx.beginPath();
                ctx.moveTo(0, screenPos.y);
                ctx.lineTo(this.viewportWidth, screenPos.y);
                ctx.stroke();
            }
        },
        
        // Render pieces (cell-based - pieces centered in cells)
        // DO8.TXT: Pieces must be in the center of the cell, not on grid lines
        renderPieces(ctx, region, theme) {
            const zoom = Camera.zoom;
            const cs = CoordinateTransform.cellSize * zoom;
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // DO8.TXT: Piece size should be 55-70% of cell size
            const fontSize = Math.floor(cs * 0.6); // 60% of cell size
            ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;
            
            // console.log('[SharedBoardEngine.renderPieces] Rendering pieces in region:', region);
            // console.log('[SharedBoardEngine.renderPieces] BoardState:', {
                // movesCount: BoardState.moves.size,
                // lastMove: BoardState.lastMove,
                // winningCells: BoardState.winningCells
            // });
            
            let piecesRendered = 0;
            
            // Iterate through visible region
            for (let x = region.minX; x <= region.maxX; x++) {
                for (let y = region.minY; y <= region.maxY; y++) {
                    const move = BoardState.getMove(x, y);
                    if (!move) continue;
                    
                    piecesRendered++;
                    // console.log('[SharedBoardEngine.renderPieces] Rendering piece at:', { x, y, move });
                    
                    // DO8.TXT: Center piece in cell - offset by 0.5 to center in cell
                    const centerX = x + 0.5;
                    const centerY = y + 0.5;
                    const screenPos = CoordinateTransform.worldToScreen(centerX, centerY, this.viewportWidth, this.viewportHeight);
                    
                    // Check if winning cell
                    const isWin = BoardState.winningCells.some(cell => cell.x === x && cell.y === y);
                    if (isWin) {
                        ctx.fillStyle = theme.win;
                        const cellScreenSize = cs;
                        // Highlight the entire cell
                        const cellTopLeft = CoordinateTransform.worldToScreen(x, y, this.viewportWidth, this.viewportHeight);
                        ctx.fillRect(cellTopLeft.x, cellTopLeft.y, cellScreenSize, cellScreenSize);
                    }
                    
                    // Check if last move
                    const isLast = BoardState.lastMove && BoardState.lastMove.x === x && BoardState.lastMove.y === y;
                    if (isLast) {
                        ctx.strokeStyle = theme.lastMove;
                        ctx.lineWidth = 2.5 / zoom;
                        const cellScreenSize = cs;
                        const cellTopLeft = CoordinateTransform.worldToScreen(x, y, this.viewportWidth, this.viewportHeight);
                        ctx.strokeRect(cellTopLeft.x + 1.5, cellTopLeft.y + 1.5, cellScreenSize - 3, cellScreenSize - 3);
                    }
                    
                    // Render piece at cell center
                    const skin = move.player === 'X' ? this.skinX : this.skinO;
                    const defaultColor = move.player === 'X' ? theme.x : theme.o;
                    ctx.fillStyle = skin.color || defaultColor;
                    ctx.fillText(skin.icon, screenPos.x, screenPos.y);
                }
            }
            
            // console.log('[SharedBoardEngine.renderPieces] Total pieces rendered:', piecesRendered);
        }
    };

    // ================================================================
    // INPUT CONTROLLER - Handle mouse/touch input
    // ================================================================
    const InputController = {
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        cameraStartX: 0,
        cameraStartY: 0,
        onMoveCallback: null,
        initialized: false,
        canvasElement: null,
        
        // Initialize input handlers
        init(canvasElement, onMoveCallback) {
            // Prevent duplicate initialization
            if (this.initialized && this.canvasElement === canvasElement) {
                // console.warn('InputController already initialized with this canvas, skipping duplicate init');
                return;
            }
            
            // Clean up previous canvas if different
            if (this.initialized && this.canvasElement !== canvasElement) {
                this.destroy();
            }
            
            this.onMoveCallback = onMoveCallback;
            this.canvasElement = canvasElement;
            
            // Mouse events
            canvasElement.addEventListener('mousedown', this.onMouseDown.bind(this));
            canvasElement.addEventListener('mousemove', this.onMouseMove.bind(this));
            canvasElement.addEventListener('mouseup', this.onMouseUp.bind(this));
            canvasElement.addEventListener('mouseleave', this.onMouseUp.bind(this));
            canvasElement.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
            
            // Touch events
            canvasElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
            canvasElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
            canvasElement.addEventListener('touchend', this.onTouchEnd.bind(this));
            
            // Prevent context menu
            canvasElement.addEventListener('contextmenu', e => e.preventDefault());
            
            this.initialized = true;
        },
        
        // Destroy input controller
        destroy() {
            if (this.canvasElement) {
                // Remove all event listeners
                this.canvasElement.removeEventListener('mousedown', this.onMouseDown);
                this.canvasElement.removeEventListener('mousemove', this.onMouseMove);
                this.canvasElement.removeEventListener('mouseup', this.onMouseUp);
                this.canvasElement.removeEventListener('mouseleave', this.onMouseUp);
                this.canvasElement.removeEventListener('wheel', this.onWheel);
                this.canvasElement.removeEventListener('touchstart', this.onTouchStart);
                this.canvasElement.removeEventListener('touchmove', this.onTouchMove);
                this.canvasElement.removeEventListener('touchend', this.onTouchEnd);
                this.canvasElement.removeEventListener('contextmenu', e => e.preventDefault());
            }
            this.canvasElement = null;
            this.onMoveCallback = null;
            this.initialized = false;
        },
        
        onMouseDown(e) {
            if (e.button === 2) { // Right click - pan
                this.isDragging = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.cameraStartX = Camera.x;
                this.cameraStartY = Camera.y;
                e.preventDefault();
            } else if (e.button === 0) { // Left click - move
                const rect = Renderer.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.handleClick(x, y);
            }
        },
        
        onMouseMove(e) {
            if (this.isDragging) {
                const dx = (e.clientX - this.dragStartX) / (CoordinateTransform.cellSize * Camera.zoom);
                const dy = (e.clientY - this.dragStartY) / (CoordinateTransform.cellSize * Camera.zoom);
                Camera.x = this.cameraStartX - dx;
                Camera.y = this.cameraStartY - dy;
                Renderer.render();
            }
        },
        
        onMouseUp(e) {
            this.isDragging = false;
        },
        
        onWheel(e) {
            e.preventDefault();
            const rect = Renderer.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            Camera.zoomAt(x, y, delta, Renderer.viewportWidth, Renderer.viewportHeight);
            Renderer.render();
        },
        
        onTouchStart(e) {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.dragStartX = touch.clientX;
                this.dragStartY = touch.clientY;
                this.cameraStartX = Camera.x;
                this.cameraStartY = Camera.y;
                this.isDragging = true;
            } else if (e.touches.length === 2) {
                // Pinch zoom - handle in touchmove
                this.isDragging = false;
            }
            e.preventDefault();
        },
        
        onTouchMove(e) {
            e.preventDefault();
            if (e.touches.length === 1 && this.isDragging) {
                const touch = e.touches[0];
                const dx = (touch.clientX - this.dragStartX) / (CoordinateTransform.cellSize * Camera.zoom);
                const dy = (touch.clientY - this.dragStartY) / (CoordinateTransform.cellSize * Camera.zoom);
                Camera.x = this.cameraStartX - dx;
                Camera.y = this.cameraStartY - dy;
                Renderer.render();
            } else if (e.touches.length === 2) {
                // Pinch zoom
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                
                if (!this.lastPinchDist) {
                    this.lastPinchDist = dist;
                    return;
                }
                
                const delta = (dist - this.lastPinchDist) * 0.01;
                const rect = Renderer.canvas.getBoundingClientRect();
                const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
                const centerY = (t1.clientY + t2.clientY) / 2 - rect.top;
                
                Camera.zoomAt(centerX, centerY, delta, Renderer.viewportWidth, Renderer.viewportHeight);
                this.lastPinchDist = dist;
                Renderer.render();
            }
        },
        
        onTouchEnd(e) {
            this.isDragging = false;
            this.lastPinchDist = null;
            
            if (e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const rect = Renderer.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                // Check if this was a tap (not a drag)
                const dist = Math.hypot(touch.clientX - this.dragStartX, touch.clientY - this.dragStartY);
                if (dist < 10) {
                    this.handleClick(x, y);
                }
            }
        },
        
        handleClick(screenX, screenY) {
            const gridPos = CoordinateTransform.screenToGrid(screenX, screenY, Renderer.viewportWidth, Renderer.viewportHeight);
            if (this.onMoveCallback) {
                this.onMoveCallback(gridPos.x, gridPos.y);
            }
        }
    };

    // ================================================================
    // RESPONSIVE LAYOUT - Handle window resize (DO8.TXT)
    // ================================================================
    const ResponsiveLayout = {
        initialized: false,
        
        init() {
            if (this.initialized) {
                // console.warn('ResponsiveLayout already initialized, skipping duplicate init');
                return;
            }
            window.addEventListener('resize', () => {
                this.onResize();
            });
            this.initialized = true;
        },
        
        onResize() {
            // DO8.TXT: Auto-recalculate viewport size on resize
            if (ViewportControl.autoMode) {
                ViewportControl.applySize();
            } else {
                Renderer.updateViewport();
                Renderer.render();
            }
        },
        
        destroy() {
            if (this.initialized) {
                window.removeEventListener('resize', this.onResize);
                this.initialized = false;
            }
        }
    };

    // ================================================================
    // PUBLIC API
    // ================================================================
    return {
        // Board State
        BoardState,
        
        // Camera
        Camera,
        
        // Coordinate Transform
        CoordinateTransform,
        
        // Renderer
        Renderer,
        
        // Input Controller
        InputController,
        
        // Responsive Layout
        ResponsiveLayout,
        
        // Viewport Control (DO8.TXT)
        ViewportControl,
        
        // Initialize the entire engine
        init(canvasElement, onMoveCallback) {
            Renderer.init(canvasElement);
            InputController.init(canvasElement, onMoveCallback);
            ResponsiveLayout.init();
            Camera.reset();
            // DO8.TXT: Apply initial viewport size after DOM layout is complete
            // Use requestAnimationFrame to ensure container has valid dimensions
            requestAnimationFrame(() => {
                ViewportControl.applySize();
            });
        },
        
        // Update and render
        update() {
            // console.log('[Camera Before Render]', {
                // zoom: Camera.zoom,
                // x: Camera.x,
                // y: Camera.y
            // });
            Renderer.render();
            // console.log('[Camera After Render]', {
                // zoom: Camera.zoom,
                // x: Camera.x,
                // y: Camera.y
            // });
        }
    };
})();

// Export to global scope
window.SharedBoardEngine = SharedBoardEngine;
