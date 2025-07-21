export default class ZoomManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.zoomLevel = 1.0; // 기본값 100%로 되돌림
        this.minZoom = 0.25; // 최소 25%
        this.maxZoom = 3.0;  // 최대 300%
        this.zoomStep = 0.1; // 확대/축소 단계를 0.1로 변경
        this.initialized = false;
        
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
        this.canvas.style.transform = `scale(${this.zoomLevel})`;
        
        // 확대/축소 시 캔버스 크기 동적 조정
        const container = this.canvas.parentElement;
        const baseWidth = container.offsetWidth;
        const baseHeight = Math.max(500, container.offsetHeight || 500);
        
        // 확대 시 더 큰 영역을 제공하고, 축소 시 작은 영역 제공
        const adjustedWidth = baseWidth / this.zoomLevel;
        const adjustedHeight = baseHeight / this.zoomLevel;
        
        this.canvas.style.width = `${adjustedWidth}px`;
        this.canvas.style.height = `${adjustedHeight}px`;
        this.canvas.style.minWidth = `${adjustedWidth}px`;
        this.canvas.style.minHeight = `${adjustedHeight}px`;
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
    
    // 캔버스 좌표 계산 메서드 - 동적 변화를 정확히 반영
    getCanvasCoordinates(e) {
        const canvas = this.canvas;
        
        // 매번 최신 상태로 getBoundingClientRect() 호출
        const rect = canvas.getBoundingClientRect();
        
        // 캔버스 내부의 스크롤 상태 확인
        const scrollLeft = canvas.scrollLeft || 0;
        const scrollTop = canvas.scrollTop || 0;
        
        // 부모 컨테이너들의 스크롤 확인
        let parentScrollX = 0;
        let parentScrollY = 0;
        let parent = canvas.parentElement;
        while (parent && parent !== document.body) {
            parentScrollX += parent.scrollLeft || 0;
            parentScrollY += parent.scrollTop || 0;
            parent = parent.parentElement;
        }
        
        // 기본 상대 좌표 계산
        let relativeX = e.clientX - rect.left;
        let relativeY = e.clientY - rect.top;
        
        // 스크롤 보정
        relativeX += scrollLeft + parentScrollX;
        relativeY += scrollTop + parentScrollY;
        
        // 줌 레벨 적용
        const adjustedX = relativeX / this.zoomLevel;
        const adjustedY = relativeY / this.zoomLevel;
        
        console.log('🎯 정밀한 좌표 계산:', {
            mouse: { clientX: e.clientX, clientY: e.clientY },
            canvasBounds: { 
                left: rect.left, 
                top: rect.top, 
                width: rect.width, 
                height: rect.height 
            },
            scrollInfo: {
                canvas: { left: scrollLeft, top: scrollTop },
                parent: { x: parentScrollX, y: parentScrollY }
            },
            beforeZoom: { x: relativeX, y: relativeY },
            zoomLevel: this.zoomLevel,
            finalCoords: { x: adjustedX, y: adjustedY },
            existingElements: {
                buildings: document.querySelectorAll('.building').length,
                rooms: document.querySelectorAll('.room').length
            }
        });
        
        return { x: adjustedX, y: adjustedY };
    }
} 