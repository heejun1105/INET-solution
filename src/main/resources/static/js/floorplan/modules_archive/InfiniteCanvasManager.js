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
        
        // 캔버스 경계 (월드 좌표) - 중앙 기준으로 설정
        this.bounds = {
            minX: -400,  // 왼쪽으로 확장 가능
            minY: -300,  // 위쪽으로 확장 가능
            maxX: 400,   // 오른쪽으로 확장 가능
            maxY: 300    // 아래쪽으로 확장 가능
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
        
        // 뷰포트 크기 즉시 설정 (깜빡임 방지)
        this.viewport.width = window.innerWidth;
        this.viewport.height = window.innerHeight - 60;
        
        // 2. 캔버스 요소 생성 (흰색 배경, 그림자 효과)
        this.canvas = document.createElement('div');
        this.canvas.id = 'infiniteCanvas';
        this.canvas.className = 'infinite-canvas';
        
        const canvasWidth = this.bounds.maxX - this.bounds.minX;
        const canvasHeight = this.bounds.maxY - this.bounds.minY;
        
        // 즉시 중앙 정렬을 위한 초기 transform 계산
        const initialTranslateX = this.viewport.width / 2;
        const initialTranslateY = this.viewport.height / 2;
        
        this.canvas.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: ${canvasWidth}px !important;
            height: ${canvasHeight}px !important;
            background: #ffffff !important;
            transform-origin: center center !important;
            will-change: transform !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
            margin: 0 !important;
            z-index: 100 !important;
            transform: translate(${initialTranslateX}px, ${initialTranslateY}px) scale(1.0) !important;
        `;
        
        // 3. 구조 조립
        this.wrapper.appendChild(this.canvas);
        this.container.appendChild(this.wrapper);
        
        // 4. 초기 transform 상태 동기화 (깜빡임 방지)
        this.transform.scale = 1.0;
        this.transform.translateX = initialTranslateX;
        this.transform.translateY = initialTranslateY;
        
        console.log('✅ 새 캔버스 생성 완료');
    }
    
    /**
     * 뷰포트 업데이트
     */
    updateViewport() {
        if (!this.container) return;
        
        // 컨테이너의 실제 크기 가져오기
        const rect = this.container.getBoundingClientRect();
        const offsetWidth = this.container.offsetWidth;
        const offsetHeight = this.container.offsetHeight;
        
        // 여러 방법으로 크기 확인
        this.viewport.width = rect.width || offsetWidth || 0;
        this.viewport.height = rect.height || offsetHeight || 0;
        
        console.log('📐 뷰포트 업데이트:', {
            rect: { width: rect.width, height: rect.height },
            offset: { width: offsetWidth, height: offsetHeight },
            final: { width: this.viewport.width, height: this.viewport.height },
            container: this.container
        });
        
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
     * 화면 좌표 → 캔버스 좌표 변환 (단순화된 버전)
     * 중앙 정렬과 좌표 변환의 충돌을 해결하기 위해 단순화
     */
    screenToCanvas(screenX, screenY) {
        const { scale, translateX, translateY } = this.transform;
        
        // 캔버스의 실제 화면 위치
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // 화면 좌표를 캔버스 상대 좌표로 변환
        const relativeX = screenX - canvasRect.left;
        const relativeY = screenY - canvasRect.top;
        
        // 단순한 좌표 변환: 상대 좌표를 스케일로 나누고 변환 적용
        // translateX/Y는 이미 중앙 정렬을 고려한 값이므로 추가 계산 불필요
        const canvasX = (relativeX / scale) - translateX;
        const canvasY = (relativeY / scale) - translateY;
        
        console.log('🔄 InfiniteCanvasManager.screenToCanvas (단순화):', {
            input: { screenX, screenY },
            canvasRect: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
            relative: { x: relativeX, y: relativeY },
            transform: { scale, translateX, translateY },
            output: { canvasX, canvasY },
            note: '단순화된 좌표 변환 - 중앙 정렬 충돌 해결',
            timestamp: Date.now()
        });
        
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * 캔버스 좌표 → 화면 좌표 변환 (단순화된 버전)
     */
    canvasToScreen(canvasX, canvasY) {
        const { scale, translateX, translateY } = this.transform;
        
        // 캔버스의 실제 화면 위치
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // 단순한 좌표 변환: 캔버스 좌표에 변환을 적용하고 스케일 곱하기
        const relativeX = (canvasX + translateX) * scale;
        const relativeY = (canvasY + translateY) * scale;
        
        // 화면 좌표로 변환
        const screenX = relativeX + canvasRect.left;
        const screenY = relativeY + canvasRect.top;
        
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
            
            // 캔버스 크기 업데이트
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
            
            // 중앙 정렬 유지
            this.canvas.style.marginLeft = `-${width / 2}px`;
            this.canvas.style.marginTop = `-${height / 2}px`;
            
            console.log(`📏 캔버스 크기 변경: ${width}px x ${height}px (중앙 정렬 유지)`);
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
     * 중앙 정렬 - 캔버스 중앙이 화면 중앙에 오도록 설정 (안정성 강화 버전)
     */
    centerView() {
        console.log('🎯 중앙 정렬 시작 (안정성 강화)');
        
        // 뷰포트 업데이트
        this.updateViewport();
        
        // 뷰포트 크기 확인
        if (this.viewport.width === 0 || this.viewport.height === 0) {
            console.warn('⚠️ 뷰포트 크기가 0입니다. 재시도합니다.');
            requestAnimationFrame(() => this.centerView());
            return;
        }
        
        // 컨테이너의 실제 크기와 위치 확인
        const containerRect = this.container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
            console.warn('⚠️ 컨테이너 크기가 0입니다. 재시도합니다.');
            requestAnimationFrame(() => this.centerView());
            return;
        }
        
        // 중앙 정렬 계산: 캔버스 중심이 컨테이너 중심에 오도록
        const canvasWidth = this.bounds.maxX - this.bounds.minX;
        const canvasHeight = this.bounds.maxY - this.bounds.minY;
        const translateX = (containerRect.width - canvasWidth) / 2;
        const translateY = (containerRect.height - canvasHeight) / 2;
        
        console.log('🎯 중앙 정렬 계산:', {
            containerRect: {
                width: containerRect.width,
                height: containerRect.height,
                left: containerRect.left,
                top: containerRect.top
            },
            canvasSize: { width: canvasWidth, height: canvasHeight },
            translate: { x: translateX, y: translateY },
            viewport: this.viewport
        });
        
        // CSS와 JavaScript 상태를 동시에 업데이트
        this.canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(1.0)`;
        this.transform.scale = 1.0;
        this.transform.translateX = translateX;
        this.transform.translateY = translateY;
        
        console.log('✅ 중앙 정렬 완료:', {
            translate: { x: translateX, y: translateY },
            containerSize: { width: containerRect.width, height: containerRect.height }
        });
    }
    
    /**
     * 줌 시 중앙 정렬 유지 (안정성 강화 버전)
     */
    zoomToCenter(newScale) {
        // 뷰포트 업데이트
        this.updateViewport();
        
        // 컨테이너의 실제 크기 확인
        const containerRect = this.container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
            console.warn('⚠️ 컨테이너 크기가 0입니다. 재시도합니다.');
            requestAnimationFrame(() => this.zoomToCenter(newScale));
            return;
        }
        
        // 줌 시에도 캔버스 중심이 화면 중심에 유지되도록 설정
        const canvasWidth = this.bounds.maxX - this.bounds.minX;
        const canvasHeight = this.bounds.maxY - this.bounds.minY;
        const scaledCanvasWidth = canvasWidth * newScale;
        const scaledCanvasHeight = canvasHeight * newScale;
        const translateX = (containerRect.width - scaledCanvasWidth) / 2;
        const translateY = (containerRect.height - scaledCanvasHeight) / 2;
        
        console.log('🔍 줌 시 중앙 정렬 (안정성 강화):', {
            newScale: newScale,
            canvasSize: { width: canvasWidth, height: canvasHeight },
            scaledSize: { width: scaledCanvasWidth, height: scaledCanvasHeight },
            translate: { x: translateX, y: translateY },
            containerSize: { width: containerRect.width, height: containerRect.height }
        });
        
        // 즉시 transform 적용 (깜빡임 없이)
        this.canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${newScale})`;
        this.transform.scale = newScale;
        this.transform.translateX = translateX;
        this.transform.translateY = translateY;
        
        // 콜백 호출
        if (this.onTransformChange) {
            this.onTransformChange();
        }
    }
    
    /**
     * 중앙 정렬 검증 및 보정
     */
    verifyAndCorrectAlignment() {
        if (!this.canvas || !this.container) {
            console.warn('⚠️ 캔버스 또는 컨테이너가 없습니다.');
            return;
        }
        
        // 실제 위치 확인
        const containerRect = this.container.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // 컨테이너 중앙점
        const containerCenterX = containerRect.left + containerRect.width / 2;
        const containerCenterY = containerRect.top + containerRect.height / 2;
        
        // 캔버스 중앙점 (transform 적용 후)
        const canvasCenterX = canvasRect.left + canvasRect.width / 2;
        const canvasCenterY = canvasRect.top + canvasRect.height / 2;
        
        // 오프셋 계산
        const offsetX = containerCenterX - canvasCenterX;
        const offsetY = containerCenterY - canvasCenterY;
        
        console.log('🔍 중앙 정렬 검증:', {
            containerCenter: { x: containerCenterX, y: containerCenterY },
            canvasCenter: { x: canvasCenterX, y: canvasCenterY },
            offset: { x: offsetX, y: offsetY },
            tolerance: 10
        });
        
        // 오프셋이 크면 보정
        if (Math.abs(offsetX) > 10 || Math.abs(offsetY) > 10) {
            console.log('🔧 중앙 정렬 보정 필요:', { offsetX, offsetY });
            
            // 현재 변환값에 오프셋 추가
            const currentTransform = this.getTransform();
            const correctedTranslateX = currentTransform.translateX + offsetX;
            const correctedTranslateY = currentTransform.translateY + offsetY;
            
            this.setTransform(currentTransform.scale, correctedTranslateX, correctedTranslateY);
            
            console.log('✅ 중앙 정렬 보정 완료:', {
                before: { translateX: currentTransform.translateX, translateY: currentTransform.translateY },
                after: { translateX: correctedTranslateX, translateY: correctedTranslateY }
            });
        } else {
            console.log('✅ 중앙 정렬 정상');
        }
    }
    
    /**
     * 중앙 정렬 보장 (대안 방법)
     */
    ensureCenterAlignment() {
        if (!this.canvas || !this.container) return;
        
        // 컨테이너와 캔버스의 실제 위치 확인
        const containerRect = this.container.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // 컨테이너 중앙점
        const containerCenterX = containerRect.left + containerRect.width / 2;
        const containerCenterY = containerRect.top + containerRect.height / 2;
        
        // 캔버스 중앙점
        const canvasCenterX = canvasRect.left + canvasRect.width / 2;
        const canvasCenterY = canvasRect.top + canvasRect.height / 2;
        
        // 오프셋 계산
        const offsetX = containerCenterX - canvasCenterX;
        const offsetY = containerCenterY - canvasCenterY;
        
        // 오프셋이 크면 조정
        if (Math.abs(offsetX) > 10 || Math.abs(offsetY) > 10) {
            console.log('🔧 중앙 정렬 보정:', {
                containerCenter: { x: containerCenterX, y: containerCenterY },
                canvasCenter: { x: canvasCenterX, y: canvasCenterY },
                offset: { x: offsetX, y: offsetY }
            });
            
            // 현재 변환값에 오프셋 추가
            const currentTransform = this.getTransform();
            const newTranslateX = currentTransform.translateX + offsetX;
            const newTranslateY = currentTransform.translateY + offsetY;
            
            this.setTransform(currentTransform.scale, newTranslateX, newTranslateY);
        }
    }
    
    /**
     * 강제 중앙 정렬 (CSS 직접 조작)
     */
    forceCenterAlignment() {
        if (!this.canvas || !this.container) return;
        
        // 컨테이너 크기
        const containerWidth = this.container.offsetWidth;
        const containerHeight = this.container.offsetHeight;
        
        // 캔버스 크기
        const canvasWidth = this.canvas.offsetWidth;
        const canvasHeight = this.canvas.offsetHeight;
        
        // 중앙 정렬을 위한 translate 계산
        const translateX = (containerWidth - canvasWidth) / 2;
        const translateY = (containerHeight - canvasHeight) / 2;
        
        console.log('🔧 강제 중앙 정렬:', {
            container: { width: containerWidth, height: containerHeight },
            canvas: { width: canvasWidth, height: canvasHeight },
            translate: { x: translateX, y: translateY }
        });
        
        // CSS transform 직접 설정
        this.canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${this.transform.scale})`;
        
        // 내부 상태도 업데이트
        this.transform.translateX = translateX;
        this.transform.translateY = translateY;
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
