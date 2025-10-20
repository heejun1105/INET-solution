/**
 * FloorPlanCore.js
 * 평면도 시스템의 핵심 캔버스 엔진
 * 
 * 책임:
 * - 캔버스 초기화 및 생명주기 관리
 * - 좌표계 표준화 및 변환
 * - 상태 관리 (Redux/Vuex 패턴)
 * - 렌더링 파이프라인
 * - 이벤트 조율
 */

export default class FloorPlanCore {
    // 상수 정의
    static MIN_ZOOM = 0.1;
    static MAX_ZOOM = 5.0;
    static DEFAULT_ZOOM = 1.0;
    static DEFAULT_GRID_SIZE = 20;
    static DEFAULT_CANVAS_WIDTH = 4000;
    static DEFAULT_CANVAS_HEIGHT = 2500;
    
    /**
     * @param {HTMLElement} container - 캔버스를 렌더링할 컨테이너
     * @param {Object} options - 초기화 옵션
     */
    constructor(container, options = {}) {
        if (!container) {
            throw new Error('Container element is required');
        }
        
        console.log('📦 FloorPlanCore 초기화 시작');
        
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        
        // 상태 초기화 (불변성 패턴)
        this.state = {
            // 캔버스 설정
            canvasWidth: options.canvasWidth || FloorPlanCore.DEFAULT_CANVAS_WIDTH,
            canvasHeight: options.canvasHeight || FloorPlanCore.DEFAULT_CANVAS_HEIGHT,
            
            // 뷰포트 상태
            zoom: options.zoom || FloorPlanCore.DEFAULT_ZOOM,
            panX: options.panX || 0,
            panY: options.panY || 0,
            
            // 그리드 설정
            gridSize: options.gridSize || FloorPlanCore.DEFAULT_GRID_SIZE,
            showGrid: options.showGrid !== false,
            snapToGrid: options.snapToGrid !== false,
            
            // 요소들
            elements: [],
            
            // 선택 상태
            selectedElements: [],
            hoveredElement: null,
            
            // 모드
            mode: 'select', // select, pan, draw
            tool: null, // rectangle, circle, line, etc.
            
            // 플래그
            isDirty: true, // 리렌더링 필요 여부
            isLoading: false,
            isSaving: false
        };
        
        // 이벤트 리스너 저장 (나중에 제거하기 위함)
        this.listeners = new Map();
        
        // 애니메이션 프레임 ID
        this.animationFrameId = null;
        
        // 초기화
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        this.createCanvas();
        this.setupEventListeners();
        this.startRenderLoop();
        
        console.log('✅ FloorPlanCore 초기화 완료');
    }
    
    /**
     * 캔버스 생성
     */
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'floorplan-canvas';
        this.canvas.style.cssText = `
            display: block;
            cursor: default;
            user-select: none;
            -webkit-user-select: none;
        `;
        
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        this.resize();
        
        console.log('🖼️ 캔버스 생성 완료');
    }
    
    /**
     * 캔버스 리사이즈
     */
    resize() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        
        this.ctx.scale(dpr, dpr);
        
        this.markDirty();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 리사이즈
        const resizeHandler = () => this.resize();
        window.addEventListener('resize', resizeHandler);
        this.listeners.set('resize', resizeHandler);
        
        console.log('👂 이벤트 리스너 설정 완료');
    }
    
    /**
     * 렌더링 루프 시작
     */
    startRenderLoop() {
        const render = () => {
            if (this.state.isDirty) {
                this.render();
                this.state.isDirty = false;
            }
            this.animationFrameId = requestAnimationFrame(render);
        };
        
        this.animationFrameId = requestAnimationFrame(render);
        
        console.log('🔄 렌더링 루프 시작');
    }
    
    /**
     * 렌더링 루프 중지
     */
    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * 렌더링 (메인 렌더링 파이프라인)
     */
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        // 1. 배경 클리어
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        // 2. 변환 적용 (줌/팬)
        ctx.save();
        ctx.translate(this.state.panX, this.state.panY);
        ctx.scale(this.state.zoom, this.state.zoom);
        
        // 3. 그리드 렌더링
        if (this.state.showGrid) {
            this.renderGrid(ctx);
        }
        
        // 4. 요소들 렌더링 (z-index 순서대로)
        this.renderElements(ctx);
        
        // 5. 선택 표시
        this.renderSelection(ctx);
        
        // 6. 변환 복원
        ctx.restore();
        
        // 7. UI 오버레이 (줌 레벨 등)
        this.renderOverlay(ctx, width, height);
    }
    
    /**
     * 그리드 렌더링
     */
    renderGrid(ctx) {
        const { gridSize, canvasWidth, canvasHeight, zoom } = this.state;
        
        ctx.save();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1 / zoom;
        
        // 세로선
        for (let x = 0; x <= canvasWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        
        // 가로선
        for (let y = 0; y <= canvasHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * 요소들 렌더링
     */
    renderElements(ctx) {
        // z-index로 정렬
        const sortedElements = [...this.state.elements].sort(
            (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
        );
        
        for (const element of sortedElements) {
            this.renderElement(ctx, element);
        }
    }
    
    /**
     * 개별 요소 렌더링
     */
    renderElement(ctx, element) {
        ctx.save();
        
        // 투명도 적용
        if (element.opacity != null) {
            ctx.globalAlpha = element.opacity;
        }
        
        // 회전 적용
        if (element.rotation) {
            const centerX = element.xCoordinate + (element.width || 0) / 2;
            const centerY = element.yCoordinate + (element.height || 0) / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((element.rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);
        }
        
        // 요소 타입별 렌더링
        switch (element.elementType) {
            case 'room':
                this.renderRoom(ctx, element);
                break;
            case 'building':
                this.renderBuilding(ctx, element);
                break;
            case 'wireless_ap':
                this.renderWirelessAp(ctx, element);
                break;
            case 'shape':
                this.renderShape(ctx, element);
                break;
            case 'other_space':
                this.renderOtherSpace(ctx, element);
                break;
            default:
                this.renderDefault(ctx, element);
        }
        
        // 라벨 렌더링
        if (element.showLabel !== false && element.label) {
            this.renderLabel(ctx, element);
        }
        
        ctx.restore();
    }
    
    /**
     * 교실 렌더링
     */
    renderRoom(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        // 배경
        ctx.fillStyle = element.backgroundColor || element.color || '#10b981';
        ctx.fillRect(x, y, w, h);
        
        // 테두리
        ctx.strokeStyle = element.borderColor || '#059669';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 건물 렌더링
     */
    renderBuilding(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 200;
        const h = element.height || 300;
        
        // 배경
        ctx.fillStyle = element.backgroundColor || element.color || '#3b82f6';
        ctx.fillRect(x, y, w, h);
        
        // 테두리
        ctx.strokeStyle = element.borderColor || '#1d4ed8';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);
    }
    
    /**
     * 무선AP 렌더링
     */
    renderWirelessAp(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const radius = element.width || 10;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = element.color || '#ef4444';
        ctx.fill();
        ctx.strokeStyle = element.borderColor || '#dc2626';
        ctx.lineWidth = element.borderWidth || 1;
        ctx.stroke();
    }
    
    /**
     * 도형 렌더링
     */
    renderShape(ctx, element) {
        const shapeType = element.shapeType || 'rectangle';
        
        switch (shapeType) {
            case 'rectangle':
                this.renderRectangleShape(ctx, element);
                break;
            case 'circle':
                this.renderCircleShape(ctx, element);
                break;
            case 'line':
                this.renderLineShape(ctx, element);
                break;
            case 'text':
                this.renderTextShape(ctx, element);
                break;
            default:
                this.renderDefault(ctx, element);
        }
    }
    
    /**
     * 사각형 도형
     */
    renderRectangleShape(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 100;
        
        if (element.backgroundColor) {
            ctx.fillStyle = element.backgroundColor;
            ctx.fillRect(x, y, w, h);
        }
        
        if (element.borderColor) {
            ctx.strokeStyle = element.borderColor;
            ctx.lineWidth = element.borderWidth || 1;
            ctx.strokeRect(x, y, w, h);
        }
    }
    
    /**
     * 원 도형
     */
    renderCircleShape(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const radius = element.width || 50;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        
        if (element.backgroundColor) {
            ctx.fillStyle = element.backgroundColor;
            ctx.fill();
        }
        
        if (element.borderColor) {
            ctx.strokeStyle = element.borderColor;
            ctx.lineWidth = element.borderWidth || 1;
            ctx.stroke();
        }
    }
    
    /**
     * 선 도형
     */
    renderLineShape(ctx, element) {
        const startX = element.startX || element.xCoordinate;
        const startY = element.startY || element.yCoordinate;
        const endX = element.endX || (element.xCoordinate + (element.width || 100));
        const endY = element.endY || (element.yCoordinate + (element.height || 0));
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = element.color || element.borderColor || '#000000';
        ctx.lineWidth = element.borderWidth || 2;
        ctx.stroke();
    }
    
    /**
     * 텍스트 도형
     */
    renderTextShape(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const text = element.textContent || '';
        
        ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
        ctx.fillStyle = element.color || '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y);
    }
    
    /**
     * 기타 공간 렌더링
     */
    renderOtherSpace(ctx, element) {
        this.renderRoom(ctx, element); // 교실과 동일하게 렌더링
    }
    
    /**
     * 기본 렌더링
     */
    renderDefault(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 50;
        const h = element.height || 50;
        
        ctx.fillStyle = element.color || '#cccccc';
        ctx.fillRect(x, y, w, h);
    }
    
    /**
     * 라벨 렌더링
     */
    renderLabel(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(element.label, x + w / 2, y + h / 2);
    }
    
    /**
     * 선택 표시 렌더링
     */
    renderSelection(ctx) {
        for (const element of this.state.selectedElements) {
            this.renderSelectionBox(ctx, element);
        }
        
        if (this.state.hoveredElement) {
            this.renderHoverBox(ctx, this.state.hoveredElement);
        }
    }
    
    /**
     * 선택 박스 렌더링
     */
    renderSelectionBox(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / this.state.zoom;
        ctx.setLineDash([5 / this.state.zoom, 5 / this.state.zoom]);
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        ctx.restore();
    }
    
    /**
     * 호버 박스 렌더링
     */
    renderHoverBox(ctx, element) {
        const x = element.xCoordinate;
        const y = element.yCoordinate;
        const w = element.width || 100;
        const h = element.height || 80;
        
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1 / this.state.zoom;
        ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
        ctx.restore();
    }
    
    /**
     * 오버레이 렌더링 (UI 정보)
     */
    renderOverlay(ctx, width, height) {
        // 줌 레벨 표시
        ctx.save();
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Zoom: ${(this.state.zoom * 100).toFixed(0)}%`, width - 10, height - 10);
        ctx.restore();
    }
    
    // ===== 좌표계 변환 =====
    
    /**
     * 화면 좌표 → 캔버스 좌표
     */
    screenToCanvas(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const x_screen = screenX - rect.left;
        const y_screen = screenY - rect.top;
        
        const x_canvas = (x_screen - this.state.panX) / this.state.zoom;
        const y_canvas = (y_screen - this.state.panY) / this.state.zoom;
        
        return { x: x_canvas, y: y_canvas };
    }
    
    /**
     * 캔버스 좌표 → 화면 좌표
     */
    canvasToScreen(canvasX, canvasY) {
        const rect = this.canvas.getBoundingClientRect();
        
        const x_screen = canvasX * this.state.zoom + this.state.panX + rect.left;
        const y_screen = canvasY * this.state.zoom + this.state.panY + rect.top;
        
        return { x: x_screen, y: y_screen };
    }
    
    /**
     * 그리드에 스냅
     */
    snapToGrid(x, y) {
        if (!this.state.snapToGrid) {
            return { x, y };
        }
        
        const gridSize = this.state.gridSize;
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
    
    // ===== 상태 관리 =====
    
    /**
     * 상태 업데이트 (불변성 보장)
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.markDirty();
    }
    
    /**
     * 줌 설정
     */
    setZoom(zoom, centerX = null, centerY = null) {
        const newZoom = Math.max(FloorPlanCore.MIN_ZOOM, Math.min(FloorPlanCore.MAX_ZOOM, zoom));
        
        if (centerX != null && centerY != null) {
            // 특정 점을 중심으로 줌
            const rect = this.canvas.getBoundingClientRect();
            const x_screen = centerX - rect.left;
            const y_screen = centerY - rect.top;
            
            const x_canvas = (x_screen - this.state.panX) / this.state.zoom;
            const y_canvas = (y_screen - this.state.panY) / this.state.zoom;
            
            const newPanX = x_screen - x_canvas * newZoom;
            const newPanY = y_screen - y_canvas * newZoom;
            
            this.setState({ zoom: newZoom, panX: newPanX, panY: newPanY });
        } else {
            this.setState({ zoom: newZoom });
        }
    }
    
    /**
     * 팬 설정
     */
    setPan(panX, panY) {
        this.setState({ panX, panY });
    }
    
    /**
     * 요소 추가
     */
    addElement(element) {
        const elements = [...this.state.elements, element];
        this.setState({ elements });
    }
    
    /**
     * 요소 업데이트
     */
    updateElement(elementId, updates) {
        const elements = this.state.elements.map(el =>
            el.id === elementId ? { ...el, ...updates } : el
        );
        this.setState({ elements });
    }
    
    /**
     * 요소 삭제
     */
    removeElement(elementId) {
        const elements = this.state.elements.filter(el => el.id !== elementId);
        this.setState({ elements });
    }
    
    /**
     * 모든 요소 설정
     */
    setElements(elements) {
        this.setState({ elements: [...elements] });
    }
    
    /**
     * 선택 설정
     */
    setSelection(elementIds) {
        const selectedElements = this.state.elements.filter(el =>
            elementIds.includes(el.id)
        );
        this.setState({ selectedElements });
    }
    
    /**
     * 리렌더링 필요 표시
     */
    markDirty() {
        this.state.isDirty = true;
    }
    
    // ===== 정리 =====
    
    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ FloorPlanCore 정리 시작');
        
        this.stopRenderLoop();
        
        // 이벤트 리스너 제거
        this.listeners.forEach((handler, event) => {
            window.removeEventListener(event, handler);
        });
        this.listeners.clear();
        
        // 캔버스 제거
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        console.log('✅ FloorPlanCore 정리 완료');
    }
}

