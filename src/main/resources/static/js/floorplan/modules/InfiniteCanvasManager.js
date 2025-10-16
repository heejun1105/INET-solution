/**
 * 무한 캔버스 관리자
 * diagrams.net 스타일의 무한 확장 캔버스 시스템 (간소화 버전)
 */
export default class InfiniteCanvasManager {
    constructor(container) {
        this.container = container;
        this.wrapper = null;
        this.canvas = null;
        
        // 변환 상태
        this.transform = {
            scale: 1.0,
            translateX: 0,
            translateY: 0
        };
        
        // 캔버스 경계 (월드 좌표) - 초기 크기를 매우 작게 시작
        this.bounds = {
            minX: 0,
            minY: 0,
            maxX: 800,
            maxY: 600
        };
        
        // 뷰포트
        this.viewport = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
        
        // 그리드 설정
        this.gridSize = 20;
        this.showGrid = true;
        
        // 렌더링 최적화
        this.isDirty = true;
        this.isRendering = false;
        
        // 변환 변경 콜백
        this.onTransformChange = null;
        
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        if (!this.container) {
            console.error('❌ Container element not found');
            return;
        }
        
        console.log('🌐 InfiniteCanvasManager 초기화 시작');
        
        // 새 캔버스 시스템 생성
        this.createNewCanvas();
        
        // 뷰포트 크기 설정
        this.updateViewport();
        
        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', () => this.updateViewport());
        
        console.log('✅ InfiniteCanvasManager initialized');
    }
    
    /**
     * 완전히 새로운 캔버스 생성
     */
    createNewCanvas() {
        console.log('🎨 새로운 무한 캔버스 생성 중...');
        
        // 1. 캔버스 래퍼 생성 (회색 배경)
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'infinite-canvas-wrapper';
        this.wrapper.id = 'infiniteCanvasWrapper';
        this.wrapper.style.cssText = `
            position: fixed;
            top: 60px;
            left: 0;
            width: 100vw;
            height: calc(100vh - 60px);
            overflow: hidden;
            cursor: default;
            background: #e5e5e5;
            z-index: 9999;
        `;
        
        // 2. 캔버스 요소 생성 (흰색 배경, 그림자 효과)
        this.canvas = document.createElement('div');
        this.canvas.id = 'infiniteCanvas';
        this.canvas.className = 'infinite-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: ${this.bounds.maxX - this.bounds.minX}px;
            height: ${this.bounds.maxY - this.bounds.minY}px;
            background: #ffffff;
            transform-origin: 0 0;
            will-change: transform;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        // 3. 구조 조립
        this.wrapper.appendChild(this.canvas);
        this.container.appendChild(this.wrapper);
        
        console.log('✅ 새 캔버스 생성 완료');
    }
    
    /**
     * 뷰포트 업데이트
     */
    updateViewport() {
        if (!this.container) return;
        
        const rect = this.container.getBoundingClientRect();
        this.viewport.width = rect.width;
        this.viewport.height = rect.height;
        
        this.markDirty();
    }
    
    /**
     * 변환 설정
     */
    setTransform(scale, translateX, translateY) {
        this.transform.scale = scale;
        this.transform.translateX = translateX;
        this.transform.translateY = translateY;
        
        this.applyTransform();
        this.markDirty();
        
        if (this.onTransformChange) {
            this.onTransformChange();
        }
    }
    
    /**
     * 변환 적용
     */
    applyTransform() {
        if (!this.canvas) return;
        
        const { scale, translateX, translateY } = this.transform;
        this.canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }
    
    /**
     * 화면 좌표 → 캔버스 좌표 변환
     * 통합된 좌표 변환 시스템의 핵심 메서드
     */
    screenToCanvas(screenX, screenY) {
        const { scale, translateX, translateY } = this.transform;
        
        // 캔버스의 실제 화면 위치를 고려
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasOffsetX = canvasRect.left;
        const canvasOffsetY = canvasRect.top;
        
        // 화면 좌표를 캔버스 상대 좌표로 변환
        const relativeX = screenX - canvasOffsetX;
        const relativeY = screenY - canvasOffsetY;
        
        // 단순화된 좌표 변환 (이중 변환 제거)
        // translateX, translateY를 제거하여 이중 변환 문제 해결
        const canvasX = relativeX / scale;
        const canvasY = relativeY / scale;
        
        console.log('🔄 InfiniteCanvasManager.screenToCanvas (수정됨):', {
            input: { screenX, screenY },
            canvasOffset: { x: canvasOffsetX, y: canvasOffsetY },
            relative: { x: relativeX, y: relativeY },
            transform: { scale, translateX, translateY },
            output: { canvasX, canvasY },
            note: 'translateX/Y 제거로 이중 변환 문제 해결',
            timestamp: Date.now()
        });
        
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * 캔버스 좌표 → 화면 좌표 변환
     */
    canvasToScreen(canvasX, canvasY) {
        const { scale, translateX, translateY } = this.transform;
        
        // 캔버스의 실제 화면 위치를 고려
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasOffsetX = canvasRect.left;
        const canvasOffsetY = canvasRect.top;
        
        // 단순화된 좌표 변환 (이중 변환 제거)
        // translateX, translateY를 제거하여 이중 변환 문제 해결
        const relativeX = canvasX * scale;
        const relativeY = canvasY * scale;
        
        const screenX = relativeX + canvasOffsetX;
        const screenY = relativeY + canvasOffsetY;
        
        return { x: screenX, y: screenY };
    }
    
    /**
     * 캔버스 경계 업데이트
     */
    updateBounds(newBounds) {
        if (newBounds) {
            // 새 경계로 완전히 교체
            this.bounds = { ...newBounds };
            console.log('📐 경계 업데이트:', this.bounds);
        }
        
        if (this.canvas) {
            const width = this.bounds.maxX - this.bounds.minX;
            const height = this.bounds.maxY - this.bounds.minY;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
            console.log(`📏 캔버스 크기 변경: ${width}px x ${height}px`);
        }
        
        this.markDirty();
    }
    
    /**
     * 캔버스 확장
     */
    expandCanvas(element) {
        if (!element) return;
        
        const padding = 500;
        const bounds = element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const elementLeft = parseFloat(element.style.left) || 0;
        const elementTop = parseFloat(element.style.top) || 0;
        const elementWidth = parseFloat(element.style.width) || bounds.width;
        const elementHeight = parseFloat(element.style.height) || bounds.height;
        
        let needsExpansion = false;
        const newBounds = { ...this.bounds };
        
        if (elementLeft + elementWidth + padding > this.bounds.maxX) {
            newBounds.maxX = Math.ceil((elementLeft + elementWidth + padding) / 100) * 100;
            needsExpansion = true;
        }
        
        if (elementTop + elementHeight + padding > this.bounds.maxY) {
            newBounds.maxY = Math.ceil((elementTop + elementHeight + padding) / 100) * 100;
            needsExpansion = true;
        }
        
        if (needsExpansion) {
            console.log('📏 캔버스 확장:', newBounds);
            this.updateBounds(newBounds);
        }
    }
    
    /**
     * 중앙 정렬
     */
    centerView() {
        const centerX = (this.bounds.maxX + this.bounds.minX) / 2;
        const centerY = (this.bounds.maxY + this.bounds.minY) / 2;
        
        const translateX = this.viewport.width / 2 - centerX * this.transform.scale;
        const translateY = this.viewport.height / 2 - centerY * this.transform.scale;
        
        this.setTransform(this.transform.scale, translateX, translateY);
    }
    
    /**
     * 렌더링 마크
     */
    markDirty() {
        this.isDirty = true;
        this.requestRender();
    }
    
    /**
     * 렌더링 요청
     */
    requestRender() {
        if (this.isRendering) return;
        
        this.isRendering = true;
        requestAnimationFrame(() => {
            this.render();
            this.isRendering = false;
        });
    }
    
    /**
     * 렌더링
     */
    render() {
        if (!this.isDirty) return;
        
        this.applyTransform();
        this.isDirty = false;
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this.wrapper && this.wrapper.parentElement) {
            this.wrapper.parentElement.removeChild(this.wrapper);
        }
        
        window.removeEventListener('resize', () => this.updateViewport());
        
        this.wrapper = null;
        this.canvas = null;
        
        console.log('✅ InfiniteCanvasManager destroyed');
    }
    
    /**
     * Transform getter
     */
    getTransform() {
        return { ...this.transform };
    }
    
    /**
     * Bounds getter
     */
    getBounds() {
        return { ...this.bounds };
    }
    
    /**
     * Viewport getter
     */
    getViewport() {
        return { ...this.viewport };
    }
}
