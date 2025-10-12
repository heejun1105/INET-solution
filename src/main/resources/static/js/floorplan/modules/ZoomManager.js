export default class ZoomManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.zoomLevel = 1.0; // 기본값 100%로 되돌림
        this.minZoom = 0.25; // 최소 25%
        this.maxZoom = 3.0;  // 최대 300%
        this.zoomStep = 0.1; // 확대/축소 단계를 0.1로 변경
        this.initialized = false;
        
        // 고정 캔버스 크기 설정
        this.canvasWidth = 4000;
        this.canvasHeight = 2500;
        
        // 무한 캔버스 시스템 (DesignModeManager에서 주입됨)
        this.infiniteCanvasManager = null;
        
        // DOM 요소가 준비된 후에 초기화하도록 지연
        if (this.canvas) {
            this.delayedInit();
        }
    }
    
    delayedInit() {
        // DOM 요소들이 존재하는지 확인 후 초기화
        const checkElements = () => {
            const zoomIn = document.getElementById('zoomIn');
            const zoomOut = document.getElementById('zoomOut');
            const zoomReset = document.getElementById('zoomReset');
            const zoomLevel = document.getElementById('zoomLevel');
            
            if (zoomIn && zoomOut && zoomReset && zoomLevel) {
                this.initEventListeners();
                this.initializeCanvas();
                this.updateZoomDisplay();
                this.initialized = true;
                console.log('✅ ZoomManager 초기화 완료');
            } else {
                // 요소들이 아직 준비되지 않았으면 100ms 후 다시 시도
                setTimeout(checkElements, 100);
            }
        };
        
        checkElements();
    }
    
    initializeCanvas() {
        // 캔버스를 고정 크기로 설정
        this.canvas.style.width = `${this.canvasWidth}px`;
        this.canvas.style.height = `${this.canvasHeight}px`;
        this.canvas.style.minWidth = `${this.canvasWidth}px`;
        this.canvas.style.minHeight = `${this.canvasHeight}px`;
        this.canvas.style.transformOrigin = '0 0';
        
        // 캔버스 래퍼의 스크롤 위치를 중앙으로 설정
        this.centerCanvasView();
        
        console.log('🎨 캔버스 고정 크기 설정:', {
            width: this.canvasWidth,
            height: this.canvasHeight
        });
    }
    
    centerCanvasView() {
        const canvasWrapper = this.canvas.parentElement;
        if (canvasWrapper) {
            // 캔버스 중앙 좌표 계산
            const centerX = (this.canvasWidth - canvasWrapper.offsetWidth) / 2;
            const centerY = (this.canvasHeight - canvasWrapper.offsetHeight) / 2;
            
            // 스크롤 위치 설정 (음수 값 방지)
            const scrollX = Math.max(0, centerX);
            const scrollY = Math.max(0, centerY);
            
            canvasWrapper.scrollLeft = scrollX;
            canvasWrapper.scrollTop = scrollY;
            
            console.log('🎯 캔버스 중앙 뷰 설정:', {
                canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
                wrapperSize: { width: canvasWrapper.offsetWidth, height: canvasWrapper.offsetHeight },
                scrollPosition: { x: scrollX, y: scrollY }
            });
        }
    }
    
    initEventListeners() {
        // 확대 버튼
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoomIn();
        });
        
        // 축소 버튼
        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoomOut();
        });
        
        // 원래 크기 버튼
        document.getElementById('zoomReset').addEventListener('click', () => {
            this.resetZoom();
        });
        
        // 마우스 휠 확대/축소 비활성화 (버튼으로만 가능)
        // this.canvas.addEventListener('wheel', (e) => {
        //     e.preventDefault();
        //     
        //     if (e.deltaY < 0) {
        //         this.zoomIn();
        //     } else {
        //         this.zoomOut();
        //     }
        // });
        
        // 키보드 단축키 (Ctrl + +/-)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    this.zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.resetZoom();
                }
            }
        });
    }
    
    zoomIn() {
        const newZoom = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
        this.setZoom(newZoom);
    }
    
    zoomOut() {
        const newZoom = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
        this.setZoom(newZoom);
    }
    
    resetZoom() {
        this.setZoom(1.0);
    }
    
    setZoom(level) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        this.applyZoom();
        this.updateZoomDisplay();
        this.updateButtonStates();
    }
    
    applyZoom() {
        // 무한 캔버스 모드인 경우
        if (this.infiniteCanvasManager) {
            const transform = this.infiniteCanvasManager.getTransform();
            this.infiniteCanvasManager.setTransform(
                this.zoomLevel,
                transform.translateX,
                transform.translateY
            );
            
            console.log('🔍 무한 캔버스 줌 적용:', {
                zoomLevel: this.zoomLevel,
                transform: this.infiniteCanvasManager.getTransform()
            });
            return;
        }
        
        // 기본 모드 (기존 로직)
        const canvasWrapper = this.canvas.parentElement;
        
        // 줌 변경 전 현재 뷰포트의 중앙 위치 (캔버스 좌표 기준)
        const viewportCenterX = canvasWrapper.scrollLeft + canvasWrapper.offsetWidth / 2;
        const viewportCenterY = canvasWrapper.scrollTop + canvasWrapper.offsetHeight / 2;
        
        // transform: scale()만 적용하여 줌 효과 구현
        this.canvas.style.transform = `scale(${this.zoomLevel})`;
        
        // 줌 변경 후 뷰포트 중앙 위치 유지를 위한 스크롤 조정
        setTimeout(() => {
            // 줌 변경 후 같은 캔버스 좌표가 뷰포트 중앙에 오도록 스크롤 조정
            const newScrollX = viewportCenterX - canvasWrapper.offsetWidth / 2;
            const newScrollY = viewportCenterY - canvasWrapper.offsetHeight / 2;
            
            // 스크롤 위치 설정 (범위 내로 제한)
            const maxScrollX = Math.max(0, this.canvasWidth * this.zoomLevel - canvasWrapper.offsetWidth);
            const maxScrollY = Math.max(0, this.canvasHeight * this.zoomLevel - canvasWrapper.offsetHeight);
            
            canvasWrapper.scrollLeft = Math.max(0, Math.min(newScrollX, maxScrollX));
            canvasWrapper.scrollTop = Math.max(0, Math.min(newScrollY, maxScrollY));
        }, 0);
        
        console.log('🔍 뷰포트 중앙 기준 줌 적용:', {
            zoomLevel: this.zoomLevel,
            scale: `${this.zoomLevel}`,
            viewportCenter: { x: viewportCenterX, y: viewportCenterY },
            canvasSize: {
                width: this.canvasWidth,
                height: this.canvasHeight
            }
        });
    }
    
    updateZoomDisplay() {
        if (!this.initialized) return;
        
        const percentage = Math.round(this.zoomLevel * 100);
        const zoomLevelElement = document.getElementById('zoomLevel');
        if (zoomLevelElement) {
            zoomLevelElement.textContent = `${percentage}%`;
        }
    }
    
    updateButtonStates() {
        if (!this.initialized) return;
        
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        
        if (!zoomInBtn || !zoomOutBtn) return;
        
        // 최대 확대 시 확대 버튼 비활성화
        if (this.zoomLevel >= this.maxZoom) {
            zoomInBtn.style.opacity = '0.5';
            zoomInBtn.style.cursor = 'not-allowed';
        } else {
            zoomInBtn.style.opacity = '1';
            zoomInBtn.style.cursor = 'pointer';
        }
        
        // 최소 축소 시 축소 버튼 비활성화
        if (this.zoomLevel <= this.minZoom) {
            zoomOutBtn.style.opacity = '0.5';
            zoomOutBtn.style.cursor = 'not-allowed';
        } else {
            zoomOutBtn.style.opacity = '1';
            zoomOutBtn.style.cursor = 'pointer';
        }
    }
    
    // 현재 줌 레벨 반환
    getCurrentZoom() {
        return this.zoomLevel;
    }
    
    // 캔버스 좌표 계산 메서드 - 스크롤과 줌을 올바르게 처리
    getCanvasCoordinates(e) {
        const canvas = this.canvas;
        
        // 매번 최신 상태로 getBoundingClientRect() 호출
        const rect = canvas.getBoundingClientRect();
        
        // 캔버스 래퍼의 스크롤 상태 확인
        const canvasWrapper = canvas.parentElement;
        const scrollLeft = canvasWrapper.scrollLeft || 0;
        const scrollTop = canvasWrapper.scrollTop || 0;
        
        // 마우스 위치에서 캔버스의 뷰포트 상대 위치 계산
        let relativeX = e.clientX - rect.left;
        let relativeY = e.clientY - rect.top;
        
        // 줌 레벨만 고려한 캔버스 좌표 계산 (스크롤 보정 제거)
        // 뷰포트 기준 좌표만 줌 레벨로 나누어 실제 캔버스 좌표로 변환
        const adjustedX = relativeX / this.zoomLevel;
        const adjustedY = relativeY / this.zoomLevel;
        
        // 디버깅 로그 (문제 해결을 위해 임시 활성화)
        console.log('🎯 캔버스 좌표 계산:', {
            mouse: { clientX: e.clientX, clientY: e.clientY },
            canvasBounds: { left: rect.left, top: rect.top },
            scroll: { left: scrollLeft, top: scrollTop },
            relative: { x: relativeX, y: relativeY },
            zoomLevel: this.zoomLevel,
            final: { x: adjustedX, y: adjustedY }
        });
        
        return { x: adjustedX, y: adjustedY };
    }
    
    // 캔버스의 실제 크기 반환 (저장 기능용)
    getCanvasSize() {
        return {
            width: this.canvasWidth,
            height: this.canvasHeight
        };
    }
    
    /**
     * 화면에 맞춤 줌
     */
    zoomToFit() {
        // ⚠️ 무한 캔버스 모드일 때는 InfiniteCanvasManager가 줌을 담당
        if (this.infiniteCanvasManager) {
            console.log('🎨 무한 캔버스 모드 - zoomToFit() 스킵');
            return;
        }
        
        const canvas = this.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const elements = canvas.querySelectorAll('.building, .room, .shape, .other-space');
        
        if (elements.length === 0) {
            this.setZoom(1);
            return;
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            
            const x = rect.left - canvasRect.left;
            const y = rect.top - canvasRect.top;
            const right = x + rect.width;
            const bottom = y + rect.height;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
        });
        
        // 여백 추가
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        const scaleX = canvasRect.width / contentWidth;
        const scaleY = canvasRect.height / contentHeight;
        const scale = Math.min(scaleX, scaleY, 1); // 최대 100% 줌
        
        this.setZoom(scale);
        
        // 캔버스를 내용물의 중심으로 이동
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const canvasCenterX = canvasRect.width / 2;
        const canvasCenterY = canvasRect.height / 2;
        
        const offsetX = canvasCenterX - centerX * scale;
        const offsetY = canvasCenterY - centerY * scale;
        
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    }
} 